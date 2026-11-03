import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Accounts, AccountError } from '../../server/accounts';
import { openDb, type Db } from '../../server/db';
import { Rooms } from '../../server/rooms';
import { TIMING } from '../../server/room';
import { fakeClient } from './helpers';

let db: Db;
let acc: Accounts;
let ipN = 0;
const ip = () => `10.0.0.${++ipN}`;
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return (e as AccountError).code; } };

beforeAll(async () => {
  db = await openDb({ memory: true }); // real Postgres (PGlite) in memory
  acc = new Accounts(db);
}, 60_000);
afterAll(async () => { await db.close(); });

describe('accounts', () => {
  it('registers, stores only a password hash, and the session token identifies the user', async () => {
    const s = await acc.register(ip(), 'Dana@Example.com', 'correct horse', 'Dana', 3);
    const u = await acc.userFromToken(s.token);
    expect(u).toMatchObject({ email: 'dana@example.com', nickname: 'Dana', avatar: 3 });
    const [row] = await db.query<{ pass_hash: string }>('select pass_hash from users where email = $1', ['dana@example.com']);
    expect(row.pass_hash).toMatch(/^scrypt\$/);
    expect(row.pass_hash).not.toContain('correct horse');
    const [sess] = await db.query<{ token_hash: string }>('select token_hash from sessions limit 1');
    expect(sess.token_hash).not.toBe(s.token); // only the SHA-256 of the token is stored
  });

  it('validates input and rejects duplicate emails', async () => {
    expect(await code(acc.register(ip(), 'dana@example.com', 'another pass', 'D2', 0))).toBe('email_taken');
    expect(await code(acc.register(ip(), 'not-an-email', 'password1', 'X', 0))).toBe('bad_email');
    expect(await code(acc.register(ip(), 'x@y.co', 'short', 'X', 0))).toBe('weak_password');
    expect(await code(acc.register(ip(), 'x@y.co', 'password1', 'shit', 0))).toBe('bad_name');
  });

  it('logs in with the right password only, and locks an email after repeated failures', async () => {
    expect(await code(acc.login(ip(), 'dana@example.com', 'correct horse'))).toBe('ok');
    expect(await code(acc.login(ip(), 'dana@example.com', 'wrong'))).toBe('bad_login');
    expect(await code(acc.login(ip(), 'nobody@example.com', 'whatever1'))).toBe('bad_login');
    await acc.register(ip(), 'lock@example.com', 'right password', 'Lock', 0);
    for (let i = 0; i < 8; i++) await code(acc.login(ip(), 'lock@example.com', 'nope'));
    expect(await code(acc.login(ip(), 'lock@example.com', 'right password'))).toBe('locked');
  });

  it('rate-limits a single IP', async () => {
    const one = '192.168.9.9';
    const results = [];
    for (let i = 0; i < 14; i++) results.push(await code(acc.login(one, 'ratelimit@example.com', 'wrong')));
    expect(results).toContain('rate_limited');
  });

  it('logout and password change invalidate sessions', async () => {
    const s = await acc.login(ip(), 'dana@example.com', 'correct horse');
    await acc.logout(s.token);
    expect(await acc.userFromToken(s.token)).toBeNull();
    const s1 = await acc.login(ip(), 'dana@example.com', 'correct horse');
    const s2 = await acc.changePassword(s1.userId, 'correct horse', 'new secret pass');
    expect(await acc.userFromToken(s1.token)).toBeNull();
    expect(await acc.userFromToken(s2.token)).not.toBeNull();
    expect(await code(acc.login(ip(), 'dana@example.com', 'new secret pass'))).toBe('ok');
  });

  it('builds profile stats, favourites, history and achievements from saved results', async () => {
    const s = await acc.register(ip(), 'stats@example.com', 'password123', 'Stats', 1);
    await acc.recordPlays([
      { userId: s.userId, game: 'kart', place: 1, players: 4, stars: 3 },
      { userId: s.userId, game: 'kart', place: 2, players: 4, stars: 2 },
      { userId: s.userId, game: 'bumper', place: 3, players: 3, stars: 1 },
    ]);
    const u = (await acc.userFromToken(s.token))!;
    const p = await acc.profile(u);
    expect(p.stats).toMatchObject({ games: 3, wins: 1, stars: 6 });
    expect(p.favorites[0]).toBe('kart');
    expect(p.history).toHaveLength(3);
    const done = p.achievements.filter((a) => a.done).map((a) => a.id);
    expect(done).toEqual(expect.arrayContaining(['first_game', 'first_win', 'kart_win']));
    expect(done).not.toContain('bumper_win');
  });

  it('deleting the account removes the user, sessions and history', async () => {
    const s = await acc.register(ip(), 'bye@example.com', 'password123', 'Bye', 0);
    await acc.recordPlays([{ userId: s.userId, game: 'kart', place: 1, players: 2, stars: 3 }]);
    expect(await code(acc.deleteAccount(s.userId, 'wrong pass'))).toBe('bad_login');
    await acc.deleteAccount(s.userId, 'password123');
    expect(await acc.userFromToken(s.token)).toBeNull();
    expect(await db.query('select * from plays where user_id = $1', [s.userId])).toHaveLength(0);
  });
});

describe('rooms save results for signed-in players only', () => {
  it('guest + member play; only the member gets a history row', async () => {
    const s = await acc.register(ip(), 'member@example.com', 'password123', 'Member', 2);
    let now = 5_000_000;
    const rooms = new Rooms(() => now);
    const saved: unknown[][] = [];
    rooms.onPlays = (rows) => { saved.push(rows); void acc.recordPlays(rows); };
    const host = fakeClient();
    rooms.route(host, { t: 'host_create' });
    const roomCode = host.last('hosted')!.code;
    const member = fakeClient();
    member.userId = s.userId;
    rooms.route(member, { t: 'join', code: roomCode, name: 'Member', avatar: 2 }, 'a');
    rooms.route(fakeClient(), { t: 'join', code: roomCode, name: 'Guest', avatar: 1 }, 'b');
    const room = rooms.get(roomCode)!;
    room.handle(host, { t: 'admin', act: { a: 'start' } });
    for (let i = 0; i < 200; i++) { now += TIMING.TICK_MS; rooms.tick(); }
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    rooms.tick();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 50));
    const p = await acc.profile((await acc.userFromToken(s.token))!);
    expect(p.stats.games).toBe(1);
    expect(p.history[0].game).toBe('bumper');
  });
});
