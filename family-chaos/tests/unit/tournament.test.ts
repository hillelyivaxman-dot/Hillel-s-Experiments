import { describe, expect, it } from 'vitest';
import { Rooms } from '../../server/rooms';
import { TIMING } from '../../server/room';
import { fakeClient } from './helpers';

function setup(names: string[]) {
  let now = 2_000_000;
  const rooms = new Rooms(() => now);
  const host = fakeClient();
  rooms.route(host, { t: 'host_create' });
  const code = host.last('hosted')!.code;
  const room = rooms.get(code)!;
  const phones = names.map((n) => { const c = fakeClient(); rooms.route(c, { t: 'join', code, name: n, avatar: 1 }, `ip-${n}`); return c; });
  const advance = (ms: number) => { for (let i = 0; i < Math.ceil(ms / TIMING.TICK_MS); i++) { now += TIMING.TICK_MS; rooms.tick(); } };
  return { host, room, advance, phones, rooms, state: () => host.last('room')!.room };
}

describe('party tournament', () => {
  it('plays a series of games, awards points per place, advances by itself and crowns a champion', () => {
    const { host, room, advance, state } = setup(['Dana', 'Yoni', 'Noa']);
    room.handle(host, { t: 'admin', act: { a: 'tournament', count: 3 } });
    advance(50);
    expect(state().tour).toMatchObject({ total: 3, idx: 0, done: false });
    const order = state().tour!.games;
    expect(order).toHaveLength(3);
    for (let g = 0; g < 3; g++) {
      expect(state().gameId).toBe(order[g]);
      advance(TIMING.COUNTDOWN_MS + 500);
      room.handle(host, { t: 'admin', act: { a: 'end' } });
      advance(100);
      expect(state().phase).toBe('results');
      if (g < 2) { expect(state().tour!.nextAt).not.toBeNull(); advance(TIMING.TOUR_PAUSE_MS + 200); } // starts the next game by itself
    }
    const tour = state().tour!;
    expect(tour.done).toBe(true);
    expect(tour.champion).toBeTruthy();
    expect(Object.values(tour.points).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    room.handle(host, { t: 'admin', act: { a: 'lobby' } });
    advance(50);
    expect(state().tour).toBeNull();
  });

  it('skip starts the next game now; cancel ends the series; the lobby clears it', () => {
    const { host, room, advance, state } = setup(['A', 'B', 'C']);
    room.handle(host, { t: 'admin', act: { a: 'tournament', games: ['bumper', 'potato'] } });
    advance(50);
    expect(state().tour!.games).toEqual(['bumper', 'potato']);
    advance(TIMING.COUNTDOWN_MS + 300);
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    advance(50);
    room.handle(host, { t: 'admin', act: { a: 'tour_skip' } });
    advance(50);
    expect(state().gameId).toBe('potato');
    advance(TIMING.COUNTDOWN_MS + 300);
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    advance(50);
    expect(state().tour!.done).toBe(true);
    room.handle(host, { t: 'admin', act: { a: 'tour_cancel' } });
    advance(50);
    expect(state().tour).toBeNull();
  });

  it('only picks games the current player count can play', () => {
    const { host, room, state, advance } = setup(['Solo']);
    room.handle(host, { t: 'admin', act: { a: 'tournament', count: 8 } });
    advance(50);
    const games = state().tour!.games;
    expect(games).not.toContain('potato'); // needs 3+
    expect(games).not.toContain('flagwars'); // needs 2+
  });
});

describe('tournament hold / resume', () => {
  it('while held the next game does not start by itself; resuming starts it shortly after', () => {
    const { host, room, advance, state } = setup(['A', 'B']);
    room.handle(host, { t: 'admin', act: { a: 'tournament', games: ['bumper', 'kart'] } });
    advance(TIMING.COUNTDOWN_MS + 300);
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    advance(50);
    room.handle(host, { t: 'admin', act: { a: 'tour_hold', hold: true } });
    advance(TIMING.TOUR_PAUSE_MS + 3000);
    expect(state().phase).toBe('results');
    expect(state().tour!.held).toBe(true);
    room.handle(host, { t: 'admin', act: { a: 'tour_hold', hold: false } });
    advance(3300);
    expect(state().gameId).toBe('kart');
  });
});

describe('knockout tournament', () => {
  it('the last place of a game is out each round until one player remains, who is crowned; eliminated players do not play on', () => {
    const { host, room, advance, state } = setup(['A', 'B', 'C']);
    room.handle(host, { t: 'admin', act: { a: 'tournament', mode: 'knockout', games: ['kart'] } });
    advance(50);
    expect(state().tour).toMatchObject({ mode: 'knockout', done: false });
    expect(state().tour!.alive).toHaveLength(3);
    for (let round = 0; round < 2; round++) {
      advance(TIMING.COUNTDOWN_MS + 300);
      room.handle(host, { t: 'admin', act: { a: 'end' } });
      advance(50);
      if (state().tour!.done) break;
      const alive = state().tour!.alive;
      expect(alive.length).toBe(3 - (round + 1));
      room.handle(host, { t: 'admin', act: { a: 'tour_skip' } });
      advance(50);
      expect(state().inGame.every((id) => alive.includes(id))).toBe(true); // only survivors play
    }
    const tour = state().tour!;
    expect(tour.done).toBe(true);
    expect(tour.alive).toHaveLength(1);
    expect(tour.champion).toBe(tour.alive[0]);
  });

  it('a player who is not there for the next game forfeits', () => {
    const { host, room, advance, phones, rooms, state } = setup(['A', 'B', 'C', 'D']);
    room.handle(host, { t: 'admin', act: { a: 'tournament', mode: 'knockout', games: ['kart'] } });
    advance(TIMING.COUNTDOWN_MS + 300);
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    advance(50);
    const alive1 = state().tour!.alive;
    expect(alive1).toHaveLength(3);
    const absent = state().players.find((p) => alive1.includes(p.id))!;
    rooms.disconnect(phones[state().players.indexOf(absent)]); // leaves during the break
    room.handle(host, { t: 'admin', act: { a: 'tour_skip' } });
    advance(TIMING.COUNTDOWN_MS + 300);
    expect(state().inGame).not.toContain(absent.id);
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    advance(50);
    expect(state().tour!.alive).not.toContain(absent.id); // forfeited
    expect(state().tour!.alive.length).toBeLessThan(alive1.length);
  });
});
