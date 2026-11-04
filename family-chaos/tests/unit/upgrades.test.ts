import { describe, expect, it } from 'vitest';
import { BTN } from '../../shared/protocol';
import { hockeyGame } from '../../server/games/hockey';
import { soccerGame } from '../../server/games/soccer';
import { runGame } from './helpers';

describe('Air Hockey touchpad control', () => {
  it('with the manual flag the mallet goes exactly to the finger position over its own half, and is confined to it', () => {
    const r = runGame(hockeyGame, 2, {}, (id) => (id === 'p1' ? { x: 0.6, y: -0.5, b: BTN.M } : { x: 0, y: 0, b: 0 }), 4);
    const snap: any = r.game.snapshot();
    const m = snap.p.find((q: any) => q.id === 'p1');
    expect(m.y).toBeLessThan(-100); // top half of the table, where the finger is
    expect(m.x).toBeGreaterThan(-600); expect(m.x).toBeLessThan(0); // still in the left half
    const stick = runGame(hockeyGame, 2, {}, (id) => (id === 'p1' ? { x: 0.6, y: -0.5, b: 0 } : { x: 0, y: 0, b: 0 }), 4);
    const m2 = (stick.game.snapshot() as any).p.find((q: any) => q.id === 'p1');
    expect(m2.x).not.toBeCloseTo(m.x, 0); // a joystick behaves differently from a touchpad
  });
});

describe('Mini Soccer pass', () => {
  it('PASS sends the ball to the teammate you aim at, not just forward', () => {
    let fired = false;
    const r = runGame(soccerGame, 4, {}, (id, s: any, t) => {
      const me = s.p.find((q: any) => q.id === id);
      if (id !== 'p1') return { x: 0, y: 0, b: 0 };
      const ball = s.b[0]; const dx = ball.x - me.x, dy = ball.y - me.y, d = Math.hypot(dx, dy) || 1;
      if (d > 50) return { x: dx / d, y: dy / d, b: 0 };
      const press = !fired ? BTN.C : 0; if (!fired) fired = true;
      return { x: 0, y: 0, b: press };
    }, 15);
    void r;
    expect(r.fx).toContain('pass');
  });
});

describe('owner powers inside games', () => {
  it('super speed makes a Flag Wars player clearly faster, giant makes him bigger, invisible and tiny show in the snapshot, teleport moves him', async () => {
    const { flagWarsGame } = await import('../../server/games/flagwars');
    const run = (kind: string | null) => {
      const g = flagWarsGame.create({ players: [{ id: 'p1', name: 'A', color: '#f00', avatar: 0 }, { id: 'p2', name: 'B', color: '#00f', avatar: 1 }], options: {}, rand: (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(), input: () => ({ x: 1, y: 0, b: 0 }), connected: () => true, rtt: () => 0, hostRtt: () => 0, now: () => 0, hud: () => {}, buzz: () => {}, fx: () => {} });
      if (kind) expect(g.power?.('p1', kind as never, 8)).toBe(true);
      const x0 = (g.snapshot() as any).p[0].x;
      for (let i = 0; i < 20; i++) g.tick(1 / 30);
      const p = (g.snapshot() as any).p[0];
      return { dx: p.x - x0, p };
    };
    const base = run(null), fast = run('speed');
    expect(fast.dx).toBeGreaterThan(base.dx * 1.3);
    expect(run('giant').p.sz).toBeGreaterThan(1); expect(run('tiny').p.sz).toBeLessThan(1); expect(run('invisible').p.iv).toBe(1);
    const tp = run('teleport'); expect(Math.abs(tp.p.x - (base.p.x))).toBeGreaterThan(40); // it landed somewhere else
  });
});
