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
  for (const n of names) rooms.route(fakeClient(), { t: 'join', code, name: n, avatar: 1 }, `ip-${n}`);
  const advance = (ms: number) => { for (let i = 0; i < Math.ceil(ms / TIMING.TICK_MS); i++) { now += TIMING.TICK_MS; rooms.tick(); } };
  return { host, room, advance, state: () => host.last('room')!.room };
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
