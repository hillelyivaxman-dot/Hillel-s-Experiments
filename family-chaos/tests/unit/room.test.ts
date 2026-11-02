import { describe, expect, it } from 'vitest';
import { Rooms } from '../../server/rooms';
import { TIMING } from '../../server/room';
import { BTN, type RoomState } from '../../shared/protocol';
import { fakeClient } from './helpers';

function setup() {
  let now = 1_000_000;
  const rooms = new Rooms(() => now);
  const host = fakeClient();
  rooms.route(host, { t: 'host_create' });
  const code = host.last('hosted')!.code;
  const room = rooms.get(code)!;
  const join = (name: string, extra: object = {}) => {
    const c = fakeClient();
    rooms.route(c, { t: 'join', code, name, avatar: 1, ...extra } as never, `ip-${name}`);
    return c;
  };
  const advance = (ms: number) => {
    const steps = Math.ceil(ms / TIMING.TICK_MS);
    for (let i = 0; i < steps; i++) { now += TIMING.TICK_MS; rooms.tick(); }
  };
  const state = (): RoomState => host.last('room')!.room;
  return { rooms, host, code, room, join, advance, state };
}

describe('rooms & lobby', () => {
  it('creates a room with a 4-letter code and lets players join', () => {
    const { code, join, state } = setup();
    expect(code).toMatch(/^[A-Z]{4}$/);
    const a = join('Dana');
    const b = join('Yoni');
    expect(a.last('joined')).toBeTruthy();
    expect(b.last('joined')).toBeTruthy();
    expect(state().players.map((p) => p.name)).toEqual(['Dana', 'Yoni']);
    expect(state().leaderId).toBe(a.last('joined')!.playerId);
    expect(new Set(state().players.map((p) => p.color)).size).toBe(2);
  });

  it('rejects unknown rooms, bad passwords, full rooms and offensive names', () => {
    const { rooms, join, host, room } = setup();
    const c = fakeClient();
    rooms.route(c, { t: 'join', code: 'ZZZZ', name: 'x', avatar: 0 });
    expect(c.last('error')!.code).toBe('no_room');
    room.handle(host, { t: 'admin', act: { a: 'room', password: 'secret', maxPlayers: 2 } });
    expect(join('Bad').last('error')!.code).toBe('bad_password');
    expect(join('Ok', { password: 'secret' }).last('joined')).toBeTruthy();
    expect(join('Ok2', { password: 'secret' }).last('joined')).toBeTruthy();
    expect(join('Third', { password: 'secret' }).last('error')!.code).toBe('room_full');
    room.handle(host, { t: 'admin', act: { a: 'room', maxPlayers: 8 } });
    expect(join('fuck you', { password: 'secret' }).last('error')!.code).toBe('bad_name');
  });

  it('reconnecting with the session token reuses the player (no duplicates)', () => {
    const { rooms, code, join, state } = setup();
    const a = join('Dana');
    const tok = a.last('joined')!.token;
    rooms.disconnect(a);
    const a2 = fakeClient();
    rooms.route(a2, { t: 'join', code, name: 'Dana', avatar: 1, token: tok });
    expect(a2.last('joined')!.playerId).toBe(a.last('joined')!.playerId);
    expect(state().players).toHaveLength(1);
    expect(state().players[0].connected).toBe(true);
  });

  it('only the host screen or the room leader can run admin actions', () => {
    const { join, room, state } = setup();
    const a = join('Leader');
    const b = join('Guest');
    room.handle(b, { t: 'admin', act: { a: 'select', game: 'kart' } });
    expect(b.last('error')!.code).toBe('not_allowed');
    room.handle(a, { t: 'admin', act: { a: 'select', game: 'kart' } });
    room.broadcastRoom();
    expect(state().selectedGame).toBe('kart');
    room.handle(a, { t: 'admin', act: { a: 'leader', playerId: b.last('joined')!.playerId } });
    room.handle(a, { t: 'admin', act: { a: 'select', game: 'bumper' } });
    expect(a.last('error')!.code).toBe('not_allowed');
  });

  it('cannot start coming-soon games', () => {
    const { host, join, room } = setup();
    join('A'); join('B');
    room.handle(host, { t: 'admin', act: { a: 'select', game: 'soccer' } });
    expect(host.last('error')!.code).toBe('not_allowed');
  });

  it('kicked players cannot come back with their token', () => {
    const { rooms, code, host, join, room, state } = setup();
    const a = join('A');
    join('B');
    const pid = a.last('joined')!.playerId;
    room.handle(host, { t: 'admin', act: { a: 'kick', playerId: pid } });
    expect(a.inbox.some((m) => m.t === 'kicked')).toBe(true);
    const again = fakeClient();
    rooms.route(again, { t: 'join', code, name: 'A', avatar: 0, token: a.last('joined')!.token });
    expect(again.last('error')!.code).toBe('not_allowed');
    room.broadcastRoom();
    expect(state().players).toHaveLength(1);
  });
});

describe('full match through the room', () => {
  it('two phones control two different characters, game ends, stars are awarded, back to lobby', () => {
    const { host, join, room, advance, state } = setup();
    const a = join('Dana');
    const b = join('Yoni');
    room.handle(host, { t: 'admin', act: { a: 'select', game: 'bumper' } });
    room.handle(host, { t: 'admin', act: { a: 'option', key: 'lives', value: 1 } });
    room.handle(host, { t: 'admin', act: { a: 'start' } });
    advance(100);
    expect(state().phase).toBe('countdown');
    const frame0 = host.last('frame')!.f as any;
    advance(TIMING.COUNTDOWN_MS);
    expect(state().phase).toBe('playing');

    // Dana pushes right, Yoni pushes up: each moves their own critter
    room.handle(a, { t: 'input', s: 1, x: 1, y: 0, b: 0 });
    room.handle(b, { t: 'input', s: 1, x: 0, y: -1, b: 0 });
    advance(500);
    const f = host.last('frame')!.f as any;
    const pa = a.last('joined')!.playerId, pb = b.last('joined')!.playerId;
    const p0a = frame0.p.find((p: any) => p.id === pa), p1a = f.p.find((p: any) => p.id === pa);
    const p0b = frame0.p.find((p: any) => p.id === pb), p1b = f.p.find((p: any) => p.id === pb);
    expect(p1a.x - p0a.x).toBeGreaterThan(50);
    expect(Math.abs(p1a.y - p0a.y)).toBeLessThan(20);
    expect(p0b.y - p1b.y).toBeGreaterThan(50);

    // stale/duplicate input (seq 1 again) is ignored
    room.handle(a, { t: 'input', s: 1, x: -1, y: 0, b: BTN.A });
    // Dana keeps driving right off the arena => Yoni wins
    advance(6000);
    expect(state().phase).toBe('results');
    const res = state().results!;
    expect(res[0].playerId).toBe(pb);
    expect(res[0].stars).toBe(3);
    expect(state().players.find((p) => p.id === pb)!.stars).toBe(3);

    room.handle(host, { t: 'admin', act: { a: 'lobby' } });
    advance(50);
    expect(state().phase).toBe('lobby');
    // switch game without a new room
    room.handle(host, { t: 'admin', act: { a: 'select', game: 'reaction' } });
    room.handle(host, { t: 'admin', act: { a: 'start' } });
    advance(50);
    expect(state().gameId).toBe('reaction');
  });

  it('pause freezes the simulation and players who disconnect mid-game keep their slot', () => {
    const { rooms, host, join, room, advance, state } = setup();
    const a = join('A');
    join('B');
    room.handle(host, { t: 'admin', act: { a: 'start' } });
    advance(TIMING.COUNTDOWN_MS + 100);
    room.handle(host, { t: 'admin', act: { a: 'pause' } });
    advance(50);
    const t1 = (host.last('frame')!.f as any).t;
    advance(1000);
    expect((host.last('frame')!.f as any).t).toBe(t1);
    rooms.disconnect(a);
    advance(TIMING.DROP_AFTER_MS + 1000);
    expect(state().players).toHaveLength(2);
    room.handle(host, { t: 'admin', act: { a: 'resume' } });
    room.handle(host, { t: 'admin', act: { a: 'end' } });
    advance(50);
    expect(state().phase).toBe('results');
    advance(TIMING.DROP_AFTER_MS + 1000);
    expect(state().players).toHaveLength(1);
  });
});
