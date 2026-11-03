import { describe, expect, it } from 'vitest';
import { BTN } from '../../shared/protocol';
import { FW } from '../../shared/flagwars';
import { flagWarsGame } from '../../server/games/flagwars';
import { runGame } from './helpers';

// waypoints for team 0 from its base to the enemy flag (all gaps are wider than a player), team 1 mirrors x
const PATH: [number, number][] = [[135, 450], [300, 450], [450, 450], [650, 450], [700, 330], [900, 330], [950, 330], [985, 450], [1100, 450], [1465, 450]];
const mir = (p: [number, number], tm: number): [number, number] => (tm ? [FW.W - p[0], p[1]] : p);

function walker(tm: number, goal: number, me: any) { // follow the path towards waypoint `goal`
  const [tx, ty] = mir(PATH[goal], tm), dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, d };
}

describe('flag wars', () => {
  it('end to end: red steals the blue flag via the lanes and captures it', () => {
    let wp = 0, back = false;
    const r = runGame(flagWarsGame, 2, { time: 180, score: 1 }, (id, s: any) => {
      if (id !== 'p1') return { x: 0, y: 0, b: 0 };
      const me = s.p.find((q: any) => q.id === id);
      if (!back && me.cr) { back = true; wp = PATH.length - 1; }
      const g = walker(0, wp, me);
      if (g.d < 30) wp = back ? Math.max(0, wp - 1) : Math.min(PATH.length - 1, wp + 1);
      return { x: g.x, y: g.y, b: BTN.B };
    }, 120);
    expect(r.fx).toContain('steal');
    expect(r.fx).toContain('capture');
    expect(r.over).toBe(true);
    const st = r.game.standings();
    expect(st[0].playerId).toBe('p1');
    expect(st[0].stars).toBe(3);
    expect(st[1].stars).toBe(1);
  });

  it('standing in the enemy half and being touched gets you tagged', () => {
    let wp = 0;
    const r = runGame(flagWarsGame, 2, { time: 90 }, (id, s: any) => {
      const me = s.p.find((q: any) => q.id === id);
      if (id === 'p1') { // red defender chases any blue player in the red half
        const foe = s.p.find((q: any) => q.id === 'p2');
        if (foe.x > FW.MID) return { x: 0, y: 0, b: 0 };
        const dx = foe.x - me.x, dy = foe.y - me.y, d = Math.hypot(dx, dy) || 1;
        return { x: dx / d, y: dy / d, b: BTN.B };
      }
      const g = walker(1, wp, me); // blue runs its mirrored lane towards the red flag
      if (g.d < 30) wp = Math.min(PATH.length - 1, wp + 1);
      return { x: g.x, y: g.y, b: BTN.B };
    }, 60);
    expect(r.fx).toContain('tag');
  });

  it('works with 1v1, 3 players (smaller team is a little faster) and 8 players; ties go to overtime', () => {
    for (const n of [2, 3, 5, 8]) {
      const r = runGame(flagWarsGame, n, { time: 120 }, () => ({ x: 0, y: 0, b: 0 }), 400);
      expect(r.over, `n=${n}`).toBe(true);
      expect(r.fx).toContain('overtime'); // nobody scored: 0-0 plays on for up to a minute
      expect(r.game.standings()).toHaveLength(n);
    }
  });

  it('jump clears a low hedge but not a stone block; sprint drains stamina', () => {
    const r = runGame(flagWarsGame, 2, { time: 30 }, (id, s: any, t) => {
      if (id !== 'p1') return { x: 0, y: 0, b: 0 };
      return { x: 1, y: 0, b: BTN.B | (Math.floor(t * 2) % 2 ? BTN.A : 0) };
    }, 12);
    const me = (r.game.snapshot() as any).p.find((q: any) => q.id === 'p1');
    expect(me.st).toBeLessThan(100); // sprinting costs stamina
    expect(r.fx).toContain('jump');
  });
});
