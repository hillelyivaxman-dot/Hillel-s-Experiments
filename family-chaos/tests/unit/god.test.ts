import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Accounts, AccountError } from '../../server/accounts';
import { openDb, type Db } from '../../server/db';
import { Rooms } from '../../server/rooms';
import { TIMING } from '../../server/room';
import { GOD_POWERS } from '../../shared/protocol';
import { fakeClient } from './helpers';

function setup(names = ['Dana', 'Yoni', 'Noa']) {
  let now = 3_000_000;
  const rooms = new Rooms(() => now);
  const host = fakeClient();
  rooms.route(host, { t: 'host_create' });
  const code = host.last('hosted')!.code;
  const room = rooms.get(code)!;
  const phones = names.map((n) => { const c = fakeClient(); rooms.route(c, { t: 'join', code, name: n, avatar: 1 }, `ip-${n}`); return c; });
  const advance = (ms: number) => { for (let i = 0; i < Math.ceil(ms / TIMING.TICK_MS); i++) { now += TIMING.TICK_MS; rooms.tick(); } };
  return { rooms, host, room, phones, advance, state: () => host.last('room')!.room };
}

describe('GOD ADMIN crown (server-side authorisation)', () => {
  it('a client that is not the verified owner can never use a power (even by sending the message)', () => {
    const { rooms, host, phones, advance, state } = setup();
    for (const p of [host, ...phones]) { rooms.route(p, { t: 'god', power: 'bonus' } as never); expect(p.last('error')?.code).toBe('not_allowed'); }
    advance(50);
    expect(state().players.every((p) => p.stars === 0)).toBe(true);
    // a forged flag in the message body is ignored: only the server-set `owner` field counts
    rooms.route(host, { t: 'god', power: 'bonus', owner: true } as never);
    expect(host.last('error')?.code).toBe('not_allowed');
  });

  it('the owner can use every power in party mode', () => {
    const { rooms, host, room, advance, state } = setup();
    host.owner = true;
    room.handle(host, { t: 'admin', act: { a: 'start' } });
    advance(TIMING.COUNTDOWN_MS + 500);
    for (const power of GOD_POWERS) {
      if (power === 'end') continue;
      host.inbox.length = 0;
      rooms.route(host, { t: 'god', power });
      expect(host.last('error'), power).toBeUndefined();
    }
    advance(100);
    expect(state().players.reduce((a, p) => a + p.stars, 0)).toBeGreaterThan(0); // bonus gave stars
    rooms.route(host, { t: 'god', power: 'end' });
    advance(100);
    expect(state().phase).toBe('results');
    expect(room.godLog.length).toBeGreaterThanOrEqual(GOD_POWERS.length);
  });

  it('freeze pauses the match and it resumes by itself; slow-mo scales game time', () => {
    const { rooms, host, room, advance, state } = setup();
    host.owner = true;
    room.handle(host, { t: 'admin', act: { a: 'start' } });
    advance(TIMING.COUNTDOWN_MS + 500);
    rooms.route(host, { t: 'god', power: 'freeze' });
    advance(100);
    expect(state().phase).toBe('paused');
    advance(3200);
    expect(state().phase).toBe('playing');
  });

  it('is disabled in competitive tournaments', () => {
    const { rooms, host, room, advance } = setup();
    host.owner = true;
    room.handle(host, { t: 'admin', act: { a: 'tournament', count: 3 } });
    advance(100);
    rooms.route(host, { t: 'god', power: 'bonus' });
    expect(host.last('error')?.code).toBe('competitive');
  });
});

describe('owner claim (first-run setup code)', () => {
  let db: Db; let acc: Accounts;
  beforeAll(async () => { db = (await openDb({ memory: true }))!; acc = new Accounts(db); }, 60_000);
  afterAll(async () => { await db.close(); });
  it('the setup code turns exactly one signed-in user into OWNER; others and wrong codes are refused', async () => {
    const a = await acc.register('1.1.1.1', 'o@example.com', 'password123', 'Owner', 1);
    const b = await acc.register('1.1.1.2', 'p@example.com', 'password123', 'Pal', 2);
    expect((await acc.userFromToken(a.token))!.role).toBe('PLAYER');
    const code = (await acc.ownerSetupCode())!;
    expect(code.length).toBeGreaterThan(8);
    await expect(acc.claimOwner(a.userId, 'wrong')).rejects.toBeInstanceOf(AccountError);
    await acc.claimOwner(a.userId, code);
    expect((await acc.userFromToken(a.token))!.role).toBe('OWNER');
    expect(await acc.ownerSetupCode()).toBeNull(); // no code once an owner exists
    await expect(acc.claimOwner(b.userId, code)).rejects.toMatchObject({ code: 'owner_exists' });
    expect((await acc.userFromToken(b.token))!.role).toBe('PLAYER');
  });
});
