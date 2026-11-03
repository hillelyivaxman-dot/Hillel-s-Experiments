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
    room.handle(host, { t: 'admin', act: { a: 'tournament', games: ['reaction', 'tag'] } });
    advance(50);
    expect(state().tour!.games).toEqual(['reaction', 'tag']);
    advance(TIMING.COUNTDOWN_MS + 300);
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    advance(50);
    room.handle(host, { t: 'admin', act: { a: 'tour_skip' } });
    advance(50);
    expect(state().gameId).toBe('tag');
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
    expect(games).not.toContain('tag'); // needs 3+
    expect(games).not.toContain('potato');
  });
});

describe('tournament hold / resume', () => {
  it('while held the next game does not start by itself; resuming starts it shortly after', () => {
    const { host, room, advance, state } = setup(['A', 'B']);
    room.handle(host, { t: 'admin', act: { a: 'tournament', games: ['reaction', 'balloon'] } });
    advance(TIMING.COUNTDOWN_MS + 300);
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    advance(50);
    room.handle(host, { t: 'admin', act: { a: 'tour_hold', hold: true } });
    advance(TIMING.TOUR_PAUSE_MS + 3000);
    expect(state().phase).toBe('results');
    expect(state().tour!.held).toBe(true);
    room.handle(host, { t: 'admin', act: { a: 'tour_hold', hold: false } });
    advance(3300);
    expect(state().gameId).toBe('balloon');
  });
});

describe('knockout tournament', () => {
  it('the last place of a game is out; with one winner left the tournament ends and crowns them', () => {
    const { host, room, advance, phones, rooms, state } = setup(['A', 'B', 'C']);
    room.handle(host, { t: 'admin', act: { a: 'tournament', mode: 'knockout', games: ['balloon'] } });
    advance(50);
    expect(state().tour).toMatchObject({ mode: 'knockout', done: false });
    expect(state().tour!.alive).toHaveLength(3);
    advance(TIMING.COUNTDOWN_MS + 300);
    // only the first phone pumps twice and banks: it scores, the other two stay at 0 and tie for last
    let s = 1;
    const send = (b: number) => { rooms.route(phones[0], { t: 'input', s: s++, x: 0, y: 0, b }); advance(60); };
    send(1); send(0); send(1); send(0); send(2); send(0);
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    advance(50);
    const tour = state().tour!;
    expect(tour.done).toBe(true);
    expect(tour.alive).toEqual([state().players[0].id]);
    expect(tour.champion).toBe(state().players[0].id);
  });

  it('a no-show forfeits, and only survivors are in the next game', () => {
    const { host, room, advance, phones, rooms, state } = setup(['A', 'B', 'C', 'D']);
    room.handle(host, { t: 'admin', act: { a: 'tournament', mode: 'knockout', games: ['balloon'] } });
    advance(50);
    rooms.disconnect(phones[3]); // D leaves before the first game starts
    advance(TIMING.COUNTDOWN_MS + 300);
    let s = 1;
    const send = (p: number, b: number) => { rooms.route(phones[p], { t: 'input', s: s++, x: 0, y: 0, b }); advance(60); };
    // A banks 2 pumps, B banks 1 pump, C does nothing -> C is last
    send(0, 1); send(0, 0); send(0, 1); send(0, 0); send(0, 2); send(0, 0);
    send(1, 1); send(1, 0); send(1, 2); send(1, 0);
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    advance(50);
    const ids = state().players.map((p) => p.id);
    expect(state().tour!.alive).toEqual([ids[0], ids[1]]); // C out (last), D out (no-show)
    expect(state().tour!.done).toBe(false);
  });
});
