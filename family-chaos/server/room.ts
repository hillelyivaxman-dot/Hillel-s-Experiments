import { CATALOG, defaultOptions, getMeta } from '../shared/catalog';
import {
  type TourState, GOD_COSMETIC, GOD_PLAYER, GOD_POWERS, type GodPower,
  AVATAR_COUNT, PLAYER_COLORS,
  type AdminAction, type C2S, type ErrorCode, type PlayerInfo, type ResultRow, type RoomPhase, type RoomState, type S2C,
} from '../shared/protocol';
import { GAMES } from './games';
import type { PlayerPower } from './games/powers';
import type { GameContext, GameInstance, PlayerInput } from './games/types';
import { clamp, cleanName, num, rng, safeEqual, token } from './util';

/** A connected socket, abstracted so rooms can be unit-tested without WebSockets. */
/** Persistence for tournaments (implemented by Accounts on top of the database). */
export interface TourStore {
  save(userId: number, id: string | null, title: string, mode: string, status: string, body: string): Promise<string>;
  load(userId: number, id: string): Promise<string | null>;
  trophy(userId: number, tournamentId: string, title: string, mode: string): Promise<void>;
}

export interface Client {
  send(m: S2C): void;
  close(): void;
  role: 'none' | 'host' | 'watch' | 'player';
  room: Room | null;
  playerId: string | null;
  rtt: number;
  /** Signed-in website account behind this socket (from the session cookie), if any. */
  userId?: number | null;
  /** Verified site owner (role OWNER in the accounts database). Set by the server, never by the client. */
  owner?: boolean;
}

interface PlayerRec {
  info: PlayerInfo;
  token: string;
  client: Client | null;
  input: PlayerInput;
  seq: number;
  tapIds: number[];
  disconnectedAt: number;
  lastHud: string;
  reportedBy: Set<string>;
  userId: number | null;
}

export const TIMING = {
  TICK_MS: 1000 / 30,
  COUNTDOWN_MS: 6000, // rules + 3-2-1 (the overlay shows the rules, the number appears for the last 3 s)
  TOUR_PAUSE_MS: 12_000, // results screen time between tournament games
  DROP_AFTER_MS: 90_000, // remove disconnected players (outside of a running game)
};
const STARS = [3, 2, 1];

let pidCounter = 0;

export class Room {
  readonly hostKey = token();
  readonly createdAt: number;
  lastActivity: number;
  password: string | null = null;
  maxPlayers = 8;
  phase: RoomPhase = 'lobby';
  selectedGame = CATALOG.find((g) => g.status === 'playable')!.id;
  options: Record<string, number> = defaultOptions(getMeta(this.selectedGame)!);
  leaderId: string | null = null;
  readonly players = new Map<string, PlayerRec>();
  readonly hosts = new Set<Client>();
  readonly watchers = new Set<Client>();
  readonly banned = new Set<string>(); // kicked tokens
  game: GameInstance | null = null;
  gameId: string | null = null;
  participants: string[] = [];
  countdownEndsAt: number | null = null;
  results: ResultRow[] | null = null;
  tour: TourState | null = null;
  private lastRttPush = 0;
  private phoneFx: unknown[] = [];
  private phoneAcc = 0;
  chaos = false;
  private god = { freezeUntil: 0, scaleUntil: 0, scale: 1, mirrorUntil: 0 };
  godLog: { at: number; userId: number | null; power: string }[] = [];
  private fx: { k: string; [key: string]: unknown }[] = [];
  private frameNo = 0;
  private dirty = false;
  private seed = 1;

  /** Called with saved-match rows for signed-in players (set by the server when accounts are enabled). */
  onPlays: ((rows: { userId: number; game: string; place: number; players: number; stars: number }[]) => void) | null = null;

  /** The session cookie was resolved after the socket joined: attach the account to that player. */
  setUser(playerId: string, userId: number) {
    const p = this.players.get(playerId);
    if (p) p.userId = userId;
  }

  constructor(readonly code: string, private clock: () => number = Date.now) {
    this.createdAt = this.lastActivity = clock();
    this.seed = (Math.random() * 2 ** 31) | 0;
  }

  // ---------- connections ----------

  attachHost(c: Client) {
    c.role = 'host';
    c.room = this;
    this.hosts.add(c);
    this.dirty = true;
  }

  attachWatcher(c: Client) {
    c.role = 'watch';
    c.room = this;
    this.watchers.add(c);
    c.send({ t: 'room', room: this.state() });
  }

  join(c: Client, m: Extract<C2S, { t: 'join' }>): ErrorCode | null {
    const now = this.clock();
    // reconnect with session token (no duplicate players)
    if (typeof m.token === 'string' && m.token) {
      if (this.banned.has(m.token)) return 'not_allowed';
      for (const p of this.players.values()) {
        if (safeEqual(p.token, m.token)) {
          if (p.client && p.client !== c) { p.client.room = null; p.client.close(); }
          this.bind(c, p);
          return null;
        }
      }
    }
    if (this.password !== null && (typeof m.password !== 'string' || !safeEqual(m.password, this.password))) return 'bad_password';
    if (this.players.size >= this.maxPlayers) return 'room_full';
    let name = cleanName(m.name);
    if (!name) return 'bad_name';
    const taken = new Set([...this.players.values()].map((p) => p.info.name.toLowerCase()));
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${name.slice(0, 11)} ${i}`;
    const used = new Set([...this.players.values()].map((p) => p.info.color));
    const color = PLAYER_COLORS.find((col) => !used.has(col)) ?? PLAYER_COLORS[this.players.size % PLAYER_COLORS.length];
    const id = `p${++pidCounter}`;
    const rec: PlayerRec = {
      info: { id, name, avatar: clamp(Math.floor(num(m.avatar)), 0, AVATAR_COUNT - 1), color, connected: true, ready: false, stars: 0 },
      token: token(), client: null, input: { x: 0, y: 0, b: 0 }, seq: -1, tapIds: [], disconnectedAt: 0, lastHud: '',
      reportedBy: new Set(),
      userId: c.userId ?? null,
    };
    this.players.set(id, rec);
    if (!this.leaderId) this.leaderId = id;
    this.bind(c, rec);
    this.lastActivity = now;
    this.fxPush('join', { id });
    return null;
  }

  private bind(c: Client, p: PlayerRec) {
    c.role = 'player';
    c.room = this;
    c.playerId = p.info.id;
    p.client = c;
    if (c.userId) p.userId = c.userId;
    p.info.connected = true;
    p.seq = -1;
    c.send({ t: 'joined', code: this.code, playerId: p.info.id, token: p.token });
    p.lastHud = '';
    this.dirty = true;
  }

  detach(c: Client) {
    if (c.role === 'host') this.hosts.delete(c);
    if (c.role === 'watch') this.watchers.delete(c);
    if (c.role === 'player' && c.playerId) {
      const p = this.players.get(c.playerId);
      if (p && p.client === c) {
        p.client = null;
        p.info.connected = false;
        p.info.ready = false;
        p.input = { x: 0, y: 0, b: 0 };
        p.disconnectedAt = this.clock();
      }
    }
    c.room = null;
    this.dirty = true;
  }

  get connectedCount() {
    return [...this.players.values()].filter((p) => p.info.connected).length;
  }

  isEmpty() {
    return this.hosts.size === 0 && this.watchers.size === 0 && this.connectedCount === 0;
  }

  // ---------- messages ----------

  handle(c: Client, m: C2S) {
    this.lastActivity = this.clock();
    const p = c.role === 'player' && c.playerId ? this.players.get(c.playerId) : undefined;
    switch (m.t) {
      case 'input': {
        if (!p) return;
        const s = num(m.s, -1);
        if (s <= p.seq) return; // duplicate / out of order
        p.seq = s;
        const prevB = p.input.b;
        const b = Math.floor(num(m.b)) & 0x1f;
        p.input = { x: clamp(num(m.x), -1, 1), y: clamp(num(m.y), -1, 1), b };
        const rising = b & ~prevB;
        if (rising && this.game && this.phase === 'playing' && this.participants.includes(p.info.id) && this.game.onPress) {
          const at = this.clock();
          for (let bit = 1; bit <= 8; bit <<= 1) if (rising & bit) this.game.onPress(p.info.id, bit, at); // (bit 16 is a mode flag, not a press)
        }
        return;
      }
      case 'tap': {
        if (!p || !this.game || this.phase !== 'playing' || !this.participants.includes(p.info.id)) return;
        const id = num(m.id, -1);
        if (p.tapIds.includes(id)) return;
        p.tapIds.push(id);
        if (p.tapIds.length > 32) p.tapIds.shift();
        this.game.onTap?.(p.info.id, Math.floor(num(m.v)), this.clock());
        return;
      }
      case 'ready':
        if (p) { p.info.ready = !!m.v; this.dirty = true; }
        return;
      case 'profile': {
        if (!p) return;
        if (m.name !== undefined) {
          const n = cleanName(m.name);
          if (!n) return c.send({ t: 'error', code: 'bad_name' });
          p.info.name = n;
        }
        if (m.avatar !== undefined) p.info.avatar = clamp(Math.floor(num(m.avatar)), 0, AVATAR_COUNT - 1);
        this.dirty = true;
        return;
      }
      case 'report': {
        const target = this.players.get(String(m.playerId));
        if (!p || !target || target === p) return;
        target.reportedBy.add(p.info.id);
        const others = this.players.size - 1;
        if (target.reportedBy.size >= Math.max(2, Math.ceil(others / 2))) {
          target.info.name = `Player ${target.info.id.slice(1)}`;
          target.reportedBy.clear();
          this.dirty = true;
        }
        console.log(`[report] room=${this.code} target=${target.info.id} by=${p.info.id}`);
        return;
      }
      case 'leave':
        if (p) {
          this.removePlayer(p.info.id);
          c.room = null;
        }
        return;
      case 'god':
        return this.godPower(c, String(m.power), m.target);
      case 'ping':
        if (typeof m.rtt === 'number') c.rtt = clamp(m.rtt, 0, 2000);
        c.send({ t: 'pong', c: num(m.c), s: this.clock() });
        return;
      case 'admin': {
        const isHost = c.role === 'host';
        const isLeader = !!p && p.info.id === this.leaderId;
        if (!isHost && !isLeader) return c.send({ t: 'error', code: 'not_allowed' });
        const err = this.admin(m.act);
        if (err) c.send({ t: 'error', code: err });
        return;
      }
    }
  }

  admin(act: AdminAction): ErrorCode | null {
    if (!act || typeof act !== 'object') return 'bad_message';
    switch (act.a) {
      case 'select': {
        const meta = getMeta(String(act.game));
        if (!meta || meta.status !== 'playable' || !GAMES[meta.id]) return 'not_allowed';
        if (this.phase !== 'lobby' && this.phase !== 'results') return 'in_game';
        this.selectedGame = meta.id;
        this.options = defaultOptions(meta);
        break;
      }
      case 'option': {
        const meta = getMeta(this.selectedGame)!;
        const opt = meta.options.find((o) => o.key === act.key);
        if (!opt || !opt.values.includes(act.value)) return 'bad_message';
        if (this.phase !== 'lobby' && this.phase !== 'results') return 'in_game';
        this.options[opt.key] = act.value;
        break;
      }
      case 'again':
      case 'start': {
        if (this.phase !== 'lobby' && this.phase !== 'results') return 'in_game';
        if (this.tour && !this.tour.done && this.phase === 'results') return this.advanceTour(); // "play again" during a tournament = next game now
        if (this.tour?.done) this.tour = null;
        return this.startGame();
      }
      case 'tournament': return this.startTour(act.count, act.games, act.mode, act.rounds);
      case 'tour_resume': { void this.resumeTour(String(act.id)).then((e) => { if (e) this.hosts.forEach((h) => h.send({ t: 'error', code: e })); }); return null; }
      case 'tour_skip':
        if (!this.tour || this.tour.done || this.phase !== 'results') return 'not_allowed';
        return this.advanceTour();
      case 'tour_hold':
        if (!this.tour || this.tour.done) return 'not_allowed';
        this.tour.held = !!act.hold;
        if (!this.tour.held && this.phase === 'results' && this.tour.nextAt) this.tour.nextAt = this.clock() + 3000;
        this.dirty = true;
        break;
      case 'tour_cancel':
        if (!this.tour) return 'not_allowed';
        if (this.tour.mode === 'multiday' && !this.tour.done) this.persist(); // "cancel" a multi-day series = pause it: it stays saved and can be resumed
        this.tour = null; this.tourId = null; this.dirty = true;
        break;
      case 'pause':
        if (this.phase !== 'playing') return 'not_allowed';
        this.phase = 'paused';
        break;
      case 'resume':
        if (this.phase !== 'paused') return 'not_allowed';
        this.phase = 'playing';
        break;
      case 'end':
        if (!this.game) return 'not_allowed';
        this.finishGame();
        return null;
      case 'lobby':
        this.tour = null;
        this.game = null;
        this.gameId = null;
        this.phase = 'lobby';
        this.results = null;
        this.countdownEndsAt = null;
        for (const p of this.players.values()) p.info.ready = false;
        break;
      case 'kick': {
        const p = this.players.get(String(act.playerId));
        if (!p) return 'bad_message';
        this.banned.add(p.token);
        p.client?.send({ t: 'kicked' });
        const cl = p.client;
        this.removePlayer(p.info.id);
        if (cl) { cl.room = null; cl.close(); }
        break;
      }
      case 'leader':
        if (!this.players.has(String(act.playerId))) return 'bad_message';
        this.leaderId = String(act.playerId);
        break;
      case 'room':
        if (act.maxPlayers !== undefined) this.maxPlayers = clamp(Math.floor(num(act.maxPlayers, 8)), 2, 12);
        if (act.password !== undefined) {
          const pw = typeof act.password === 'string' ? act.password.trim().slice(0, 32) : '';
          this.password = pw ? pw : null;
        }
        break;
      default:
        return 'bad_message';
    }
    this.dirty = true;
    return null;
  }

  private removePlayer(id: string) {
    this.players.delete(id);
    this.participants = this.participants.filter((x) => x !== id);
    if (this.leaderId === id) {
      const next = [...this.players.values()].find((p) => p.info.connected) ?? [...this.players.values()][0];
      this.leaderId = next ? next.info.id : null;
    }
    this.dirty = true;
  }

  // ---------- GOD ADMIN (crown) ----------

  /** Executes a crown power. Authorised ONLY by the server-verified `c.owner`; refused during tournaments (competitive). */
  private godPower(c: Client, power: string, target?: string) {
    if (!c.owner) return c.send({ t: 'error', code: 'not_allowed' });
    if (this.tour && !this.tour.done) return c.send({ t: 'error', code: 'competitive' });
    if (power !== 'chaos' && !(GOD_POWERS as readonly string[]).includes(power)) return c.send({ t: 'error', code: 'bad_message' });
    const now = this.clock();
    const live = this.phase === 'playing' || this.phase === 'paused';
    const cosmetic = (GOD_COSMETIC as readonly string[]).includes(power);
    // chaos mode: the owner switches it on for a party room; it is shown to every screen and phone, and only then can powers change the game
    if (power === 'chaos') {
      this.chaos = !this.chaos; this.dirty = true; this.fxPush('god_say', { he: this.chaos ? 'מצב כאוס פעיל!' : 'מצב כאוס כבוי', en: this.chaos ? 'CHAOS MODE ON!' : 'Chaos mode off' });
      this.godLog.push({ at: now, userId: c.userId ?? null, power }); console.log(`GOD power=chaos(${this.chaos}) user=${c.userId ?? '?'} room=${this.code}`);
      return;
    }
    if (!cosmetic && !this.chaos) return c.send({ t: 'error', code: 'chaos_off' });
    const need = ['freeze', 'slowmo', 'turbo', 'mirror', 'end', ...GOD_PLAYER];
    if (need.includes(power) && !live) return c.send({ t: 'error', code: 'not_allowed' });
    const ids = [...this.players.values()].filter((p) => p.info.connected).map((p) => p.info.id);
    const pick = () => (target && this.players.has(target) ? target : ids[Math.floor(rng(this.seed++)() * ids.length)]);
    if ((GOD_PLAYER as readonly string[]).includes(power)) {
      const id = pick(), who = id ? this.players.get(id) : null;
      if (!id || !who || !this.game?.power) return c.send({ t: 'error', code: 'unsupported' });
      if (!this.participants.includes(id)) return c.send({ t: 'error', code: 'unsupported' });
      if (!this.game.power(id, power as PlayerPower, 8)) return c.send({ t: 'error', code: 'unsupported' });
      const NAMES: Record<string, [string, string]> = { speed: ['מהירות־על', 'Super speed'], jump: ['קפיצה גבוהה', 'High jump'], giant: ['ענק', 'Giant'], tiny: ['ננס', 'Tiny'], teleport: ['טלפורט', 'Teleport'], invisible: ['בלתי נראה', 'Invisible'], swap: ['החלפת מקומות', 'Swap places'] };
      this.fxPush('god_say', { he: `${NAMES[power][0]}: ${who.info.name}`, en: `${NAMES[power][1]}: ${who.info.name}` });
      this.godLog.push({ at: now, userId: c.userId ?? null, power }); console.log(`GOD power=${power} target=${id} user=${c.userId ?? '?'} room=${this.code}`);
      return;
    }
    switch (power as GodPower) {
      case 'confetti': case 'quake': case 'flash': this.fxPush(`god_${power}`); break;
      case 'announce': this.fxPush('god_announce'); break;
      case 'freeze': if (this.phase === 'playing') { this.phase = 'paused'; this.god.freezeUntil = now + 3000; this.dirty = true; } break;
      case 'slowmo': this.god.scale = 0.5; this.god.scaleUntil = now + 6000; break;
      case 'turbo': this.god.scale = 1.5; this.god.scaleUntil = now + 6000; break;
      case 'mirror': this.god.mirrorUntil = now + 6000; break;
      case 'bonus': { const id = pick(); const p = id ? this.players.get(id) : null; if (p) { p.info.stars += 3; this.dirty = true; } break; }
      case 'steal': {
        const ps = [...this.players.values()].sort((a, b) => b.info.stars - a.info.stars);
        if (ps.length > 1 && ps[0].info.stars > 0) { const n = Math.min(2, ps[0].info.stars); ps[0].info.stars -= n; ps[ps.length - 1].info.stars += n; this.dirty = true; }
        break;
      }
      case 'leader': { const id = pick(); if (id) { this.leaderId = id; this.dirty = true; } break; }
      case 'end': if (this.game) this.finishGame(); break;
    }
    this.godLog.push({ at: now, userId: c.userId ?? null, power });
    if (this.godLog.length > 200) this.godLog.shift();
    console.log(`GOD power=${power} user=${c.userId ?? '?'} room=${this.code}`);
  }

  // ---------- tournaments (party / knockout / league / multi-day) ----------

  /** Where saved tournaments live (set by Rooms when a database exists). */
  tourStore: TourStore | null = null;
  private tourId: string | null = null;

  /** The signed-in account behind the host screen (or, failing that, the room leader): owner of saved tournaments. */
  private ownerUserId(): number | null {
    for (const h of this.hosts) if (h.userId) return h.userId;
    const l = this.leaderId ? this.players.get(this.leaderId) : null;
    return l?.userId ?? null;
  }
  private keyOf(p: PlayerRec) { return p.userId ? `u:${p.userId}` : `n:${p.info.name.toLowerCase()}`; }

  /** Writes the series to the database (survives Render restarts). No database or not signed in: it stays in memory. */
  private persist() {
    const t = this.tour, uid = this.ownerUserId();
    if (!t || !this.tourStore || !uid) return;
    const points: Record<string, { name: string; points: number }> = {};
    for (const p of this.players.values()) points[this.keyOf(p)] = { name: p.info.name, points: t.points[p.info.id] ?? 0 };
    for (const a of t.absent ?? []) points[`n:${a.name.toLowerCase()}`] ??= { name: a.name, points: a.points };
    if (!this.tourId) this.tourId = token(9); // decided now, so two quick saves never create two rows
    t.id = this.tourId;
    const body = JSON.stringify({ mode: t.mode, idx: t.idx, total: t.total, games: t.games, points, done: t.done, title: t.title });
    this.tourStore.save(uid, this.tourId, t.title ?? 'Tournament', t.mode, t.done ? 'done' : 'active', body)
      .then(() => { this.dirty = true; })
      .catch((e) => console.error('save tournament', e));
    if (t.done && t.champion && !this.trophyGiven) {
      this.trophyGiven = true;
      const champ = this.players.get(t.champion);
      if (champ?.userId) this.tourStore.trophy(champ.userId, this.tourId, t.title ?? 'Tournament', t.mode).catch((e) => console.error('trophy', e));
    }
  }
  private trophyGiven = false;

  /** Knockout picks individual-ranking games only (co-op games have no loser). */
  private koPool: string[] | null = null;
  private pickKnockoutGame(alive: number, last?: string): string | null {
    const pool = CATALOG.filter((g) => g.status === 'playable' && GAMES[g.id] && alive >= g.minPlayers && alive <= g.maxPlayers && (g.id !== last || this.koPool?.length === 1) && (!this.koPool || this.koPool.includes(g.id))).map((g) => g.id);
    return pool.length ? pool[Math.floor(rng(this.seed++)() * pool.length)] : null;
  }

  private startTour(count?: number, games?: string[], mode: TourState['mode'] = 'party', rounds?: number): ErrorCode | null {
    if (this.phase !== 'lobby' && this.phase !== 'results') return 'in_game';
    const n = [...this.players.values()].filter((p) => p.info.connected).length;
    this.trophyGiven = false; this.tourId = null;
    const fits = (g: string) => { const m = getMeta(g); return !!m && m.status === 'playable' && !!GAMES[g] && n >= m.minPlayers && n <= m.maxPlayers; };
    const skipped = (games ?? []).filter((g) => !fits(g));
    const base = { points: Object.fromEntries([...this.players.keys()].map((id) => [id, 0])), nextAt: null, held: false, done: false, champion: null, alive: [] as string[], skipped, title: `${mode} ${new Date().toISOString().slice(0, 10)}` };
    if (mode === 'knockout') {
      if (n < 2) return 'not_allowed';
      this.koPool = games?.filter(fits).length ? games.filter(fits) : null;
      const first = this.pickKnockoutGame(n);
      if (!first) return 'not_allowed';
      const alive = [...this.players.values()].filter((p) => p.info.connected).map((p) => p.info.id);
      this.tour = { ...base, mode, alive, total: alive.length - 1, idx: 0, games: [first] };
      this.selectGame(first);
      const err = this.startGame();
      if (err) this.tour = null; else this.persist();
      return err;
    }
    // party / league / multiday: the organiser's picks first, the rest (if any) filled up at random
    const pool = CATALOG.filter((g) => fits(g.id)).map((g) => g.id);
    let list = (games ?? []).filter(fits);
    const want = Math.max(2, Math.min(12, Math.floor(num(count, mode === 'party' ? 5 : Math.max(list.length || 4, 1) * Math.max(1, Math.floor(num(rounds, 2)))))));
    const rand = rng(this.seed++);
    if (mode === 'league' || mode === 'multiday') { // a fixed schedule: the chosen games, repeated round after round
      const cycle = list.length ? list : pool.slice(0, 4);
      list = Array.from({ length: want }, (_, i) => cycle[i % cycle.length]);
    } else {
      list = list.slice(0, 12);
      while (list.length < (games?.length ? list.length : want) && pool.length) {
        const bag = pool.filter((g) => g !== list[list.length - 1]);
        const from = bag.length ? bag : pool;
        list.push(from[Math.floor(rand() * from.length)]);
      }
      if (games?.length && count && list.length < count) while (list.length < count && pool.length) { const bag = pool.filter((g) => g !== list[list.length - 1]); const from = bag.length ? bag : pool; list.push(from[Math.floor(rand() * from.length)]); } // "mixed": picks + random fill
    }
    if (list.length < 1) return 'not_allowed';
    this.tour = { ...base, mode, total: list.length, idx: 0, games: list };
    this.selectGame(list[0]);
    const err = this.startGame();
    if (err) this.tour = null; else this.persist();
    return err;
  }

  /** Continue a saved tournament (another day / after a restart): points are matched to the players in this room by account or name. */
  async resumeTour(id: string): Promise<ErrorCode | null> {
    const uid = this.ownerUserId();
    if (!this.tourStore || !uid) return 'not_allowed';
    if (this.phase !== 'lobby' && this.phase !== 'results') return 'in_game';
    const raw = await this.tourStore.load(uid, id);
    if (!raw) return 'not_allowed';
    const saved = JSON.parse(raw) as { mode: TourState['mode']; idx: number; total: number; games: string[]; points: Record<string, { name: string; points: number }>; done: boolean; title?: string };
    if (saved.done) return 'not_allowed';
    const points: Record<string, number> = {}, seen = new Set<string>();
    for (const p of this.players.values()) { const k = this.keyOf(p); points[p.info.id] = saved.points[k]?.points ?? 0; seen.add(k); }
    const absent = Object.entries(saved.points).filter(([k]) => !seen.has(k)).map(([, v]) => v);
    const nextIdx = Math.min(saved.idx + 1, saved.games.length - 1);
    this.tourId = id; this.trophyGiven = false;
    const alive = this.players.size ? [...this.players.keys()] : [];
    this.tour = { mode: saved.mode, alive: saved.mode === 'knockout' ? alive : [], total: saved.total, idx: nextIdx, games: saved.games, points, nextAt: null, held: false, done: false, champion: null, id, title: saved.title, absent, skipped: [] };
    this.selectGame(saved.games[nextIdx]);
    const err = this.startGame();
    if (err) this.tour = null; else { this.persist(); this.dirty = true; }
    return err;
  }

  private selectGame(id: string) {
    const meta = getMeta(id)!;
    this.selectedGame = meta.id;
    this.options = defaultOptions(meta);
  }

  private advanceTour(): ErrorCode | null {
    const t = this.tour;
    if (!t || t.done) return 'not_allowed';
    if (t.mode === 'knockout') {
      if (t.alive.length <= 1) { this.endTour(); return null; }
      const g = this.pickKnockoutGame(t.alive.length, t.games[t.idx]);
      if (!g) { this.endTour(); return null; }
      t.idx++; t.nextAt = null; t.games.push(g);
      this.selectGame(g);
      const err = this.startGame();
      if (err) this.endTour();
      return null;
    }
    while (t.idx + 1 < t.total) {
      t.idx++; t.nextAt = null;
      this.selectGame(t.games[t.idx]);
      if (!this.startGame()) return null;
    }
    this.endTour();
    return null;
  }

  private endTour() {
    const t = this.tour!;
    t.done = true; t.nextAt = null;
    const best = Object.entries(t.points).sort((a, b) => b[1] - a[1])[0];
    t.champion = t.mode === 'knockout' && t.alive.length === 1 ? t.alive[0] : best && this.players.has(best[0]) ? best[0] : null;
    this.dirty = true;
    this.persist();
  }

  // ---------- game lifecycle ----------

  startGame(): ErrorCode | null {
    const meta = getMeta(this.selectedGame);
    const mod = meta && GAMES[meta.id];
    if (!meta || !mod || meta.status !== 'playable') return 'not_allowed';
    const ko = this.tour && !this.tour.done && this.tour.mode === 'knockout' ? this.tour.alive : null;
    const ready = [...this.players.values()].filter((p) => p.info.connected && (!ko || ko.includes(p.info.id))).slice(0, meta.maxPlayers);
    if (ready.length < meta.minPlayers) return 'not_allowed';
    this.participants = ready.map((p) => p.info.id);
    for (const p of ready) { p.seq = -1; p.input = { x: 0, y: 0, b: 0 }; }
    const rand = rng(this.seed++);
    const room = this;
    const ctx: GameContext = {
      players: ready.map((p) => ({ id: p.info.id, name: p.info.name, color: p.info.color, avatar: p.info.avatar })),
      options: { ...this.options },
      rand,
      input: (id) => {
        const p = room.players.get(id);
        if (!p || !p.info.connected) return { x: 0, y: 0, b: 0 };
        return room.god.mirrorUntil > room.clock() ? { x: -p.input.x, y: -p.input.y, b: p.input.b } : p.input;
      },
      connected: (id) => !!room.players.get(id)?.info.connected,
      rtt: (id) => room.players.get(id)?.client?.rtt ?? 0,
      hostRtt: () => Math.min(...[...room.hosts].map((h) => h.rtt), 400),
      now: () => room.clock(),
      hud: (id, h) => {
        const p = room.players.get(id);
        if (!p?.client) return;
        const s = JSON.stringify(h);
        if (s === p.lastHud) return;
        p.lastHud = s;
        p.client.send({ t: 'hud', h });
      },
      buzz: (id, ms) => room.players.get(id)?.client?.send({ t: 'buzz', ms: clamp(ms, 10, 1000) }),
      fx: (k, data) => room.fxPush(k, data),
    };
    this.game = mod.create(ctx);
    this.gameId = meta.id;
    this.results = null;
    this.phase = 'countdown';
    this.countdownEndsAt = this.clock() + TIMING.COUNTDOWN_MS;
    this.fx = [];
    this.dirty = true;
    return null;
  }

  private finishGame() {
    if (!this.game) return;
    const rows = this.game.standings().filter((r) => this.players.has(r.playerId));
    const results: ResultRow[] = [];
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      const tie = r.tie ?? i;
      const prevTie = prev ? prev.tie ?? i - 1 : undefined;
      const place = prev && tie === prevTie ? results[i - 1].place : i + 1;
      const stars = r.stars ?? (rows.length > 1 ? STARS[place - 1] ?? 0 : 0);
      results.push({ playerId: r.playerId, place, score: r.score, stars, detail: r.detail });
      const p = this.players.get(r.playerId);
      if (p) {
        p.info.stars += stars;
        if (place === 1) p.client?.send({ t: 'buzz', ms: 500 });
      }
    });
    this.sendFrame(); // final frame
    this.results = results;
    if (this.onPlays && this.gameId) {
      const game = this.gameId;
      const saved = results.flatMap((r) => {
        const uid = this.players.get(r.playerId)?.userId;
        return uid ? [{ userId: uid, game, place: r.place, players: results.length, stars: r.stars }] : [];
      });
      if (saved.length) this.onPlays(saved);
    }
    if (this.tour && !this.tour.done) {
      const PTS = [10, 7, 5, 3, 2, 1];
      for (const r of results) this.tour.points[r.playerId] = (this.tour.points[r.playerId] ?? 0) + (PTS[r.place - 1] ?? 1);
      if (this.tour.mode === 'knockout') {
        const t = this.tour, played = new Set(this.participants);
        const last = Math.max(...results.map((r) => r.place));
        const losers = new Set(results.filter((r) => r.place === last).map((r) => r.playerId));
        if (losers.size >= results.length) losers.clear(); // everybody tied: nobody is out, play another game
        for (const id of t.alive) if (!played.has(id)) losers.add(id); // no-shows forfeit
        t.alive = t.alive.filter((id) => !losers.has(id) && this.players.has(id));
        t.total = t.idx + 1 + Math.max(0, t.alive.length - 1);
        if (t.alive.length <= 1) this.endTour(); else t.nextAt = this.clock() + TIMING.TOUR_PAUSE_MS;
      } else if (this.tour.idx + 1 < this.tour.total) this.tour.nextAt = this.clock() + TIMING.TOUR_PAUSE_MS;
      else this.endTour();
      if (this.tour && !this.tour.done) this.persist();
    }
    this.phase = 'results';
    this.game = null;
    this.countdownEndsAt = null;
    this.dirty = true;
  }

  private fxPush(k: string, data?: Record<string, unknown>) {
    if (this.fx.length < 64) this.fx.push({ k, ...data });
  }

  private sendFrame() {
    if (!this.game || !this.gameId) return;
    const f = { ...(this.game.snapshot() as object), ev: this.fx };
    this.fx = [];
    const msg: S2C = { t: 'frame', g: this.gameId, n: ++this.frameNo, f };
    for (const h of this.hosts) h.send(msg);
    for (const w of this.watchers) w.send(msg);
    // games with a personal 3D view (Kart Chaos): participants' phones get the world too, at a lower rate
    const hz = GAMES[this.gameId]?.phoneHz;
    if (hz) {
      this.phoneFx.push(...(f as { ev: unknown[] }).ev);
      if (this.phoneFx.length > 64) this.phoneFx.splice(0, this.phoneFx.length - 64);
      this.phoneAcc += TIMING.TICK_MS / 1000;
      if (this.phoneAcc >= 1 / hz - 1e-6) {
        this.phoneAcc = 0;
        const pm: S2C = { t: 'frame', g: this.gameId, n: this.frameNo, f: { ...f, ev: this.phoneFx } };
        this.phoneFx = [];
        for (const id of this.participants) this.players.get(id)?.client?.send(pm);
      }
    }
  }

  /** Called by the server loop ~30 times per second. */
  tick(dt = TIMING.TICK_MS / 1000) {
    const now = this.clock();
    if (this.phase === 'countdown' && this.countdownEndsAt !== null && now >= this.countdownEndsAt) {
      this.phase = 'playing';
      this.countdownEndsAt = null;
      this.dirty = true;
    }
    if (this.tour?.nextAt && !this.tour.held && this.phase === 'results' && now >= this.tour.nextAt) this.advanceTour();
    if (this.god.freezeUntil && now >= this.god.freezeUntil) { this.god.freezeUntil = 0; if (this.phase === 'paused') { this.phase = 'playing'; this.dirty = true; } }
    if (this.god.scaleUntil && now >= this.god.scaleUntil) { this.god.scaleUntil = 0; this.god.scale = 1; }
    if (this.game && this.phase === 'playing') {
      dt *= this.god.scale;
      this.game.tick(dt);
      if (this.game.isOver()) this.finishGame();
    }
    if (this.game) this.sendFrame();
    // a leader whose phone went to sleep must not leave everybody without controls: hand the crown on after a few seconds
    if (this.leaderId) {
      const ld = this.players.get(this.leaderId);
      if (ld && !ld.info.connected && now - ld.disconnectedAt > 8000) {
        const next = [...this.players.values()].find((q) => q.info.connected);
        if (next) { this.leaderId = next.info.id; this.dirty = true; }
      }
    }
    // drop long-gone players while not in a match
    if (this.phase === 'lobby' || this.phase === 'results') {
      for (const p of [...this.players.values()]) {
        if (!p.info.connected && now - p.disconnectedAt > TIMING.DROP_AFTER_MS) this.removePlayer(p.info.id);
      }
    }
    if (now - this.lastRttPush > 3000) { this.lastRttPush = now; if (this.phase !== 'playing') this.dirty = true; } // keeps the owner's ping column fresh
    if (this.dirty) this.broadcastRoom();
  }

  state(): RoomState {
    return {
      code: this.code,
      phase: this.phase,
      players: [...this.players.values()].map((p) => ({ ...p.info, rtt: Math.round(p.client?.rtt ?? 0) })),
      leaderId: this.leaderId,
      selectedGame: this.selectedGame,
      gameId: this.gameId,
      inGame: [...this.participants],
      options: { ...this.options },
      maxPlayers: this.maxPlayers,
      hasPassword: this.password !== null,
      countdownEndsAt: this.countdownEndsAt,
      results: this.results,
      hostConnected: this.hosts.size > 0,
      chaos: this.chaos,
      tour: this.tour ? { ...this.tour, points: { ...this.tour.points }, alive: [...this.tour.alive] } : null,
    };
  }

  broadcastRoom() {
    this.dirty = false;
    const msg: S2C = { t: 'room', room: this.state() };
    for (const h of this.hosts) h.send(msg);
    for (const w of this.watchers) w.send(msg);
    for (const p of this.players.values()) p.client?.send(msg);
  }
}
