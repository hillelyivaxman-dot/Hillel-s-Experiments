// Website accounts: email + password, stored in our own database.
// * Passwords: scrypt (memory-hard KDF from Node's crypto) with a random salt; never stored in plain text.
// * Sessions: random 256-bit token in an HttpOnly, SameSite=Lax cookie; only its SHA-256 is stored.
// * Brute force: per-IP rate limit + temporary lock per email after repeated failures.
// * Stats are written by the server from authoritative match results only.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ACHIEVEMENTS, type PlayerStats } from '../shared/achievements';
import { AVATAR_COUNT } from '../shared/protocol';
import type { Db } from './db';
import { Bucket, clamp, cleanName, safeEqual, token } from './util';

const scrypt = (pw: string, salt: Buffer, len: number, o: ScryptOptions) =>
  new Promise<Buffer>((res, rej) => scryptCb(pw, salt, len, o, (e, k) => (e ? rej(e) : res(k))));

const KDF = { N: 16384, r: 8, p: 1, len: 64 };
export const COOKIE = 'fc_session';
const SESSION_DAYS = 30;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, KDF.len, { N: KDF.N, r: KDF.r, p: KDF.p });
  return `scrypt$${KDF.N}$${KDF.r}$${KDF.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64');
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), want.length, { N: +n, r: +r, p: +p });
  return got.length === want.length && timingSafeEqual(got, want);
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export type Role = 'OWNER' | 'ADMIN' | 'HOST' | 'PLAYER';
export interface PublicUser { id: number; email: string; nickname: string; avatar: number; role: Role }
export interface PlayRecord { userId: number; game: string; place: number; players: number; stars: number }

export class AccountError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export class Accounts {
  private ipBuckets = new Map<string, Bucket>();
  private failures = new Map<string, { n: number; until: number }>();

  constructor(readonly db: Db, private clock: () => number = Date.now) {}

  private limit(ip: string) {
    let b = this.ipBuckets.get(ip);
    if (!b) { b = new Bucket(0.2, 10); this.ipBuckets.set(ip, b); } // 10 burst, then 1 per 5 s
    if (this.ipBuckets.size > 10_000) this.ipBuckets.clear();
    if (!b.take(1, this.clock())) throw new AccountError('rate_limited', 429);
  }

  async register(ip: string, email: unknown, password: unknown, nickname: unknown, avatar: unknown) {
    this.limit(ip);
    const em = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(em) || em.length > 254) throw new AccountError('bad_email');
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) throw new AccountError('weak_password');
    const nick = cleanName(nickname);
    if (!nick) throw new AccountError('bad_name');
    const av = clamp(Math.floor(Number(avatar) || 0), 0, AVATAR_COUNT - 1);
    const hash = await hashPassword(password);
    const rows = await this.db.query<{ id: number }>(
      'insert into users (email, pass_hash, nickname, avatar) values ($1, $2, $3, $4) on conflict (email) do nothing returning id',
      [em, hash, nick, av],
    );
    if (!rows.length) throw new AccountError('email_taken', 409);
    return this.newSession(Number(rows[0].id));
  }

  async login(ip: string, email: unknown, password: unknown) {
    this.limit(ip);
    const em = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const f = this.failures.get(em);
    if (f && f.until > this.clock()) throw new AccountError('locked', 429);
    const rows = await this.db.query<{ id: number; pass_hash: string }>('select id, pass_hash from users where email = $1', [em]);
    // verify against a dummy hash when the user does not exist, so timing doesn't reveal accounts
    const ok = typeof password === 'string' && password.length <= 200 &&
      (await verifyPassword(password, rows[0]?.pass_hash ?? DUMMY_HASH)) && !!rows.length;
    if (!ok) {
      const n = (f?.n ?? 0) + 1;
      this.failures.set(em, { n, until: n >= 8 ? this.clock() + 15 * 60_000 : 0 });
      if (this.failures.size > 10_000) this.failures.clear();
      throw new AccountError('bad_login', 401);
    }
    this.failures.delete(em);
    return this.newSession(Number(rows[0].id));
  }

  private async newSession(userId: number) {
    const tok = randomBytes(32).toString('base64url');
    const exp = new Date(this.clock() + SESSION_DAYS * 86400_000);
    await this.db.query('insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)', [sha(tok), userId, exp]);
    return { token: tok, userId };
  }

  async userFromToken(tok: string | undefined | null): Promise<PublicUser | null> {
    if (!tok || tok.length > 100) return null;
    const rows = await this.db.query<PublicUser & { id: number }>(
      'select u.id, u.email, u.nickname, u.avatar, u.role from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > $2',
      [sha(tok), new Date(this.clock())],
    );
    return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
  }

  /**
   * First-run owner setup: whoever is signed in and knows the one-time setup code becomes OWNER (only while no owner exists).
   * The code is OWNER_SETUP_CODE (a Render environment variable) or, if unset, a random code printed once in the server log.
   */
  private ownerCode: string | null = null;
  async ownerSetupCode(): Promise<string | null> {
    const has = (await this.db.query<{ n: number }>("select count(*)::int as n from users where role = 'OWNER'"))[0]?.n > 0;
    if (has) return null;
    return (this.ownerCode ??= process.env.OWNER_SETUP_CODE || token(9));
  }
  async claimOwner(userId: number, code: unknown) {
    const real = await this.ownerSetupCode();
    if (!real) throw new AccountError('owner_exists', 409);
    if (typeof code !== 'string' || !safeEqual(code.trim(), real)) throw new AccountError('bad_code', 403);
    await this.db.query("update users set role = 'OWNER' where id = $1 and not exists (select 1 from users where role = 'OWNER')", [userId]);
  }

  // ---- tournaments & trophies (see Room.persist) ----
  async saveTournament(userId: number, id: string | null, title: string, mode: string, status: string, body: string): Promise<string> {
    const tid = id ?? token(9);
    await this.db.query(
      `insert into tournaments (id, owner_user, title, mode, status, state) values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set title = $3, mode = $4, status = $5, state = $6, updated_at = now() where tournaments.owner_user = $2`,
      [tid, userId, title.slice(0, 60), mode, status, body]);
    return tid;
  }
  async loadTournament(userId: number, id: string): Promise<string | null> {
    const r = await this.db.query<{ state: string }>('select state from tournaments where id = $1 and owner_user = $2', [id, userId]);
    return r[0]?.state ?? null;
  }
  async listTournaments(userId: number) {
    const rows = await this.db.query<{ id: string; title: string; mode: string; status: string; updated_at: Date | string; state: string }>(
      'select id, title, mode, status, updated_at, state from tournaments where owner_user = $1 order by updated_at desc limit 12', [userId]);
    return rows.map((r) => { let idx = 0, total = 0; try { const s = JSON.parse(r.state); idx = s.idx + 1; total = s.total; } catch { /* */ } return { id: r.id, title: r.title, mode: r.mode, status: r.status, at: new Date(r.updated_at).toISOString(), progress: `${Math.min(idx, total)}/${total}` }; });
  }
  async deleteTournament(userId: number, id: string) { await this.db.query('delete from tournaments where id = $1 and owner_user = $2', [id, userId]); }
  async addTrophy(userId: number, tournamentId: string, title: string, mode: string) {
    await this.db.query('insert into trophies (user_id, tournament_id, title, mode) select $1, $2, $3, $4 where not exists (select 1 from trophies where user_id = $1 and tournament_id = $2)', [userId, tournamentId, title.slice(0, 60), mode]);
  }

  async logout(tok: string | undefined | null) {
    if (tok) await this.db.query('delete from sessions where token_hash = $1', [sha(tok)]);
  }

  async updateProfile(userId: number, nickname: unknown, avatar: unknown) {
    if (nickname !== undefined) {
      const n = cleanName(nickname);
      if (!n) throw new AccountError('bad_name');
      await this.db.query('update users set nickname = $1 where id = $2', [n, userId]);
    }
    if (avatar !== undefined) {
      await this.db.query('update users set avatar = $1 where id = $2', [clamp(Math.floor(Number(avatar) || 0), 0, AVATAR_COUNT - 1), userId]);
    }
  }

  async changePassword(userId: number, current: unknown, next: unknown) {
    const rows = await this.db.query<{ pass_hash: string }>('select pass_hash from users where id = $1', [userId]);
    if (!rows[0] || typeof current !== 'string' || !(await verifyPassword(current, rows[0].pass_hash))) throw new AccountError('bad_login', 401);
    if (typeof next !== 'string' || next.length < 8 || next.length > 200) throw new AccountError('weak_password');
    await this.db.query('update users set pass_hash = $1 where id = $2', [await hashPassword(next), userId]);
    await this.db.query('delete from sessions where user_id = $1', [userId]); // sign out everywhere
    return this.newSession(userId);
  }

  async deleteAccount(userId: number, password: unknown) {
    const rows = await this.db.query<{ pass_hash: string }>('select pass_hash from users where id = $1', [userId]);
    if (!rows[0] || typeof password !== 'string' || !(await verifyPassword(password, rows[0].pass_hash))) throw new AccountError('bad_login', 401);
    await this.db.query('delete from users where id = $1', [userId]); // cascades to sessions + plays
  }

  async recordPlays(rows: PlayRecord[]) {
    for (const r of rows) {
      await this.db.query('insert into plays (user_id, game, place, players, stars) values ($1, $2, $3, $4, $5)',
        [r.userId, r.game, r.place, r.players, r.stars]);
    }
  }

  async profile(user: PublicUser) {
    const per = await this.db.query<{ game: string; plays: string | number; wins: string | number; stars: string | number }>(
      `select game, count(*) as plays, sum(case when place = 1 then 1 else 0 end) as wins, sum(stars) as stars
       from plays where user_id = $1 group by game`, [user.id]);
    const stats: PlayerStats = { games: 0, wins: 0, stars: 0, perGame: {} };
    for (const r of per) {
      const plays = Number(r.plays), wins = Number(r.wins);
      stats.perGame[r.game] = { plays, wins };
      stats.games += plays;
      stats.wins += wins;
      stats.stars += Number(r.stars);
    }
    const history = await this.db.query<{ game: string; place: number; players: number; stars: number; at: Date | string }>(
      'select game, place, players, stars, at from plays where user_id = $1 order by at desc, id desc limit 20', [user.id]);
    const favorites = Object.entries(stats.perGame).sort((a, b) => b[1].plays - a[1].plays).slice(0, 3).map(([g]) => g);
    return {
      user: { nickname: user.nickname, avatar: user.avatar, email: user.email, role: user.role },
      stats,
      achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, done: a.test(stats) })),
      favorites,
      trophies: (await this.db.query<{ title: string; mode: string; at: Date | string }>('select title, mode, at from trophies where user_id = $1 order by at desc limit 20', [user.id])).map((t) => ({ ...t, at: new Date(t.at).toISOString() })),
      history: history.map((h) => ({ ...h, at: new Date(h.at).toISOString() })),
    };
  }
}

// A valid scrypt hash of a random password, used to equalise timing for unknown emails.
let DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
void hashPassword(randomBytes(12).toString('hex')).then((h) => { DUMMY_HASH = h; });

// ---------------- HTTP API ----------------

export function readCookie(req: IncomingMessage, name = COOKIE): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function sessionCookie(tok: string, secure: boolean, maxAgeSec = SESSION_DAYS * 86400) {
  return `${COOKIE}=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 4096) throw new AccountError('too_large', 413);
    chunks.push(c as Buffer);
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw new AccountError('bad_json');
  }
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

/** Handles /api/auth/* and /api/me*. Returns false when the path is not an account route. */
export async function handleAccountApi(
  acc: Accounts | null, req: IncomingMessage, res: ServerResponse, path: string, ip: string, secure: boolean,
): Promise<boolean> {
  if (path === '/api/admin/status' && req.method === 'GET') { // public, no secrets: tells /admin what is missing
    const user = acc ? await acc.userFromToken(readCookie(req)) : null;
    return send(res, 200, {
      accounts: acc ? acc.db.kind : 'off', persistent: acc?.db.persistent ?? false,
      signedIn: !!user, role: user?.role ?? null, nickname: user?.nickname ?? null,
      ownerClaimed: acc ? (await acc.ownerSetupCode()) === null : false,
      codeFromEnv: !!process.env.OWNER_SETUP_CODE,
    }), true;
  }
  if (!path.startsWith('/api/auth/') && !path.startsWith('/api/me') && !path.startsWith('/api/tournaments')) return false;
  if (!acc) { send(res, 503, { error: 'accounts_unavailable' }); return true; }
  try {
    if (req.method === 'POST') {
      // CSRF: JSON body only (forces a CORS preflight cross-site) and same-origin Origin header when present
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new AccountError('bad_request');
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new AccountError('bad_origin', 403);
    }
    const tok = readCookie(req);
    if (path === '/api/auth/register' && req.method === 'POST') {
      const b = await readJson(req);
      const s = await acc.register(ip, b.email, b.password, b.nickname, b.avatar);
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(s.token, secure) }), true;
    }
    if (path === '/api/auth/login' && req.method === 'POST') {
      const b = await readJson(req);
      const s = await acc.login(ip, b.email, b.password);
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(s.token, secure) }), true;
    }
    if (path === '/api/auth/logout' && req.method === 'POST') {
      await acc.logout(tok);
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', secure, 0) }), true;
    }
    const user = await acc.userFromToken(tok);
    if (path === '/api/me' && req.method === 'GET') {
      return send(res, 200, user ? { signedIn: true, persistent: acc.db.persistent, ...(await acc.profile(user)) } : { signedIn: false, persistent: acc.db.persistent }), true;
    }
    if (!user) throw new AccountError('signed_out', 401);
    if (path === '/api/me' && req.method === 'POST') {
      const b = await readJson(req);
      await acc.updateProfile(user.id, b.nickname, b.avatar);
      return send(res, 200, { ok: true }), true;
    }
    if (path === '/api/me/password' && req.method === 'POST') {
      const b = await readJson(req);
      const s = await acc.changePassword(user.id, b.current, b.next);
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(s.token, secure) }), true;
    }
    if (path === '/api/tournaments' && req.method === 'GET') return send(res, 200, { tournaments: await acc.listTournaments(user.id) }), true;
    if (path === '/api/tournaments/delete' && req.method === 'POST') { const b = await readJson(req); await acc.deleteTournament(user.id, String(b.id)); return send(res, 200, { ok: true }), true; }
    if (path === '/api/me/owner' && req.method === 'POST') {
      const b = await readJson(req);
      await acc.claimOwner(user.id, b.code);
      return send(res, 200, { ok: true }), true;
    }
    if (path === '/api/me/delete' && req.method === 'POST') {
      const b = await readJson(req);
      await acc.deleteAccount(user.id, b.password);
      return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', secure, 0) }), true;
    }
    send(res, 404, { error: 'not_found' });
  } catch (e) {
    if (e instanceof AccountError) send(res, e.status, { error: e.code });
    else { console.error('account api', e); send(res, 500, { error: 'server' }); }
  }
  return true;
}
