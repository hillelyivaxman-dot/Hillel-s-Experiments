import type { GameContext, GameModule, PlayerInput } from '../../server/games/types';
import type { Client } from '../../server/room';
import type { S2C } from '../../shared/protocol';
import { rng } from '../../server/util';

export interface FakeClient extends Client {
  inbox: S2C[];
  closed: boolean;
  last<T extends S2C['t']>(t: T): Extract<S2C, { t: T }> | undefined;
}

export function fakeClient(): FakeClient {
  const c: FakeClient = {
    role: 'none', room: null, playerId: null, rtt: 0, inbox: [], closed: false,
    send(m) { c.inbox.push(m); },
    close() { c.closed = true; },
    last(t) { return [...c.inbox].reverse().find((m) => m.t === t) as never; },
  };
  return c;
}

/** Runs a game module headless with scripted inputs. */
export function runGame(
  mod: GameModule,
  n: number,
  options: Record<string, number>,
  bot: (id: string, snap: any, t: number) => PlayerInput,
  maxSeconds = 400,
  seed = 7,
) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, color: '#fff', avatar: 0 }));
  const inputs = new Map<string, PlayerInput>(players.map((p) => [p.id, { x: 0, y: 0, b: 0 }]));
  const fx: string[] = [];
  let clock = 0;
  const ctx: GameContext = {
    players, options, rand: rng(seed), input: (id) => inputs.get(id)!, connected: () => true,
    rtt: () => 0, hostRtt: () => 0, now: () => clock, hud: () => {}, buzz: () => {}, fx: (k) => { fx.push(k); },
  };
  const g = mod.create(ctx);
  const dt = 1 / 30;
  let t = 0;
  while (!g.isOver() && t < maxSeconds) {
    const snap = g.snapshot();
    for (const p of players) {
      const prev = inputs.get(p.id)!;
      const next = bot(p.id, snap, t);
      const rising = next.b & ~prev.b;
      inputs.set(p.id, next);
      for (let bit = 1; bit <= 8; bit <<= 1) if (rising & bit) g.onPress?.(p.id, bit, clock);
    }
    g.tick(dt);
    t += dt;
    clock += 1000 * dt;
  }
  return { game: g, t, fx, over: g.isOver() };
}
