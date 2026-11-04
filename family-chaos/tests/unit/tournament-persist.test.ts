import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Accounts } from '../../server/accounts';
import { openDb, type Db } from '../../server/db';
import { Rooms } from '../../server/rooms';
import { TIMING } from '../../server/room';
import { fakeClient } from './helpers';

let db: Db, acc: Accounts;
beforeAll(async () => { db = (await openDb({ memory: true }))!; acc = new Accounts(db); }, 60_000);
afterAll(async () => { await db.close(); });

function room(owner: number, names: string[], userIds: Record<string, number> = {}) {
  let now = 9_000_000;
  const rooms = new Rooms(() => now);
  rooms.tourStore = { save: (u, id, t, m, s, b) => acc.saveTournament(u, id, t, m, s, b), load: (u, id) => acc.loadTournament(u, id), trophy: (u, id, t, m) => acc.addTrophy(u, id, t, m) };
  const host = fakeClient(); host.userId = owner;
  rooms.route(host, { t: 'host_create' });
  const code = host.last('hosted')!.code, r = rooms.get(code)!;
  const phones = names.map((n) => { const c = fakeClient(); if (userIds[n]) c.userId = userIds[n]; rooms.route(c, { t: 'join', code, name: n, avatar: 1 }, `ip-${n}`); return c; });
  const advance = (ms: number) => { for (let i = 0; i < Math.ceil(ms / TIMING.TICK_MS); i++) { now += TIMING.TICK_MS; rooms.tick(); } };
  return { host, r, phones, advance, state: () => host.last('room')!.room };
}
const settle = () => new Promise((res) => setTimeout(res, 120));

describe('tournaments are saved in the database and survive a restart', () => {
  it('multi-day league: saved after each game, resumed in a brand-new room with the points matched by account/name, and a trophy for the champion', async () => {
    const u1 = await acc.register('9.9.9.1', 'host@example.com', 'password123', 'Host', 1);
    const u2 = await acc.register('9.9.9.2', 'dana@example.com', 'password123', 'Dana', 2);
    const A = room(u1.userId, ['Host', 'Dana', 'Guest'], { Host: u1.userId, Dana: u2.userId });
    A.r.handle(A.host, { t: 'admin', act: { a: 'tournament', mode: 'multiday', games: ['kart', 'bumper'], rounds: 2 } });
    A.advance(50);
    expect(A.state().tour).toMatchObject({ mode: 'multiday', total: 4, done: false });
    expect(A.state().tour!.games).toEqual(['kart', 'bumper', 'kart', 'bumper']); // a fixed schedule, repeated
    A.advance(TIMING.COUNTDOWN_MS + 300);
    A.r.handle(A.host, { t: 'admin', act: { a: 'end' } });
    A.advance(50); await settle();
    const list = await acc.listTournaments(u1.userId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ mode: 'multiday', status: 'active', progress: '1/4' });
    const pointsDay1 = { ...A.state().tour!.points };
    const total1 = Object.values(pointsDay1).reduce((a, b) => a + b, 0);
    expect(total1).toBeGreaterThan(0);
    // "restart": a brand new Rooms instance and a new room (another day); Dana and Host come back, Guest does not
    A.r.handle(A.host, { t: 'admin', act: { a: 'tour_cancel' } }); // pausing a multi-day series keeps it saved
    A.advance(50); await settle();
    expect(await acc.listTournaments(u1.userId)).toHaveLength(1);
    const B = room(u1.userId, ['Host', 'Dana'], { Host: u1.userId, Dana: u2.userId });
    B.r.handle(B.host, { t: 'admin', act: { a: 'tour_resume', id: list[0].id } });
    await settle(); B.advance(50);
    const t = B.state().tour!;
    expect(t.id).toBe(list[0].id);
    expect(t.idx).toBe(1); // next game of the schedule
    expect(B.state().gameId).toBe('bumper');
    const pid = (name: string) => B.state().players.find((p) => p.name === name)!.id;
    const idA = (name: string) => A.state().players.find((p) => p.name === name)!.id;
    expect(t.points[pid('Host')]).toBe(pointsDay1[idA('Host')]); // points carried over by account
    expect(t.points[pid('Dana')]).toBe(pointsDay1[idA('Dana')]);
    expect(t.absent?.some((a) => a.name === 'Guest')).toBe(true); // the guest who did not come back is shown as absent
    // somebody else cannot load it
    const u3 = await acc.register('9.9.9.3', 'eve@example.com', 'password123', 'Eve', 3);
    expect(await acc.loadTournament(u3.userId, list[0].id)).toBeNull();
    // finish the remaining games: champion gets a trophy
    for (let g = 0; g < 3 && !B.state().tour!.done; g++) {
      B.advance(TIMING.COUNTDOWN_MS + 300); B.r.handle(B.host, { t: 'admin', act: { a: 'end' } }); B.advance(50);
      if (!B.state().tour!.done) { B.r.handle(B.host, { t: 'admin', act: { a: 'tour_skip' } }); B.advance(50); }
    }
    await settle();
    expect(B.state().tour!.done).toBe(true);
    const champ = B.state().players.find((p) => p.id === B.state().tour!.champion)!;
    const prof = await acc.profile((await db.query<any>('select id, email, nickname, avatar, role from users where nickname = $1', [champ.name]))[0]);
    expect(prof.trophies.length).toBe(1);
  });

  it('only fitting games are scheduled: a game that cannot take this many players is skipped and reported', () => {
    const R = room(0, ['A', 'B', 'C', 'D', 'E', 'F']);
    R.r.handle(R.host, { t: 'admin', act: { a: 'tournament', mode: 'league', games: ['hockey', 'kart', 'flagwars'], rounds: 1 } });
    R.advance(50);
    const t = R.state().tour!;
    expect(t.games).not.toContain('hockey'); // air hockey takes at most 4
    expect(t.skipped).toContain('hockey');
    expect(t.games).toEqual(['kart', 'flagwars']);
  });
});
