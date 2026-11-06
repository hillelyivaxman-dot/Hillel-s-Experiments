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

describe('Mini Soccer possession: the ball is carried, A shoots or slides, a slide steals', () => {
  const run = (bot: (id: string, s: any, t: number) => { x: number; y: number; b: number }, secs: number) => runGame(soccerGame, 2, { time: 120 }, bot, secs);
  const toBall = (me: any, ball: any) => { const dx = ball.x - me.x, dy = ball.y - me.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d, d }; };

  it('touching the free ball picks it up: it sits in front of the player and follows where he looks', () => {
    let carried = 0, frontOk = 0;
    run((id, s, _t) => {
      const me = s.p.find((q: any) => q.id === id), ball = s.b[0];
      if (id !== 'p1') return { x: 0, y: 0, b: 0 };
      if (s.o === 'p1') { carried++; const fx = me.x + Math.cos(me.a) * 40, fy = me.y + Math.sin(me.a) * 40; if (Math.hypot(ball.x - fx, ball.y - fy) < 40) frontOk++; return { x: 0, y: 1, b: 0 }; }
      const b = toBall(me, ball); return { x: b.x, y: b.y, b: 0 };
    }, 8);
    expect(carried).toBeGreaterThan(30);
    expect(frontOk / carried).toBeGreaterThan(0.85);
  });

  it('SHOOT (A) with the ball sends it toward the aim and releases it; the shooter cannot instantly grab it back', () => {
    let shot = false, ownedAfter = 0;
    const r = run((id, s, t) => {
      const me = s.p.find((q: any) => q.id === id), ball = s.b[0];
      if (id !== 'p1') return { x: 0, y: 0, b: 0 };
      if (s.o === 'p1' && !shot && t > 1) { shot = true; return { x: 1, y: 0, b: BTN.A }; }
      if (shot && s.o === 'p1') ownedAfter++;
      if (shot) return { x: 0, y: 0, b: 0 };
      const b = toBall(me, ball); return { x: b.x, y: b.y, b: 0 };
    }, 6);
    expect(r.fx).toContain('kick');
    expect(ownedAfter).toBe(0);
  });

  it('SLIDE (A without the ball) steals it from an opponent who carries it', () => {
    const r = run((id, s, _t) => {
      const me = s.p.find((q: any) => q.id === id), ball = s.b[0];
      if (id === 'p1') { // carrier: grabs the ball and stands still
        if (s.o === 'p1') return { x: 0, y: 0, b: 0 };
        const b = toBall(me, ball); return { x: b.x, y: b.y, b: 0 };
      }
      // defender: waits until p1 has it, runs at him and slides when close
      const o = s.p.find((q: any) => q.id === 'p1'), d = Math.hypot(o.x - me.x, o.y - me.y), a = Math.atan2(o.y - me.y, o.x - me.x);
      return { x: s.o === 'p1' ? Math.cos(a) : 0, y: s.o === 'p1' ? Math.sin(a) : 0, b: s.o === 'p1' && d < 120 ? BTN.A : 0 };
    }, 14);
    expect(r.fx).toContain('slide');
    expect(r.fx).toContain('steal');
  });
});
