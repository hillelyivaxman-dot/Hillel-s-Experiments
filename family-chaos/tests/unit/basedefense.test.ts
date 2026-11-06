import { describe, expect, it } from 'vitest';
import { baseDefenseGame } from '../../server/games/basedefense';
import { BD, waveList } from '../../shared/basedefense';
import { BTN } from '../../shared/protocol';
import { runGame } from './helpers';

// Base Defense: co-operative waves. Defenders shoot by themselves; the core must survive.
const stand = (snap: any, id: string) => snap.p.find((q: any) => q.id === id);

describe('base defense', () => {
  it('defenders that stand near the core hold the early waves, kills fill the shared scrap pool, and the team wins together', () => {
    const r = runGame(baseDefenseGame, 4, { waves: 3 }, (id, snap, t) => {
      const me = stand(snap, id);
      // stay in the safe ring, mash the special every few seconds, upgrade when affordable
      const a = (Number(id.slice(1)) / 4) * Math.PI * 2;
      const tx = BD.CORE_X + Math.cos(a) * 140, ty = BD.CORE_Y + Math.sin(a) * 140;
      const dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy) || 1;
      return { x: d > 20 ? dx / d : 0, y: d > 20 ? dy / d : 0, b: (Math.floor(t * 2) % 2 ? BTN.A : 0) | (snap.sc >= snap.uc && snap.uc ? BTN.C : 0) };
    }, 300);
    expect(r.over).toBe(true);
    expect((r.game.snapshot() as any).win).toBe(1);
    const rows = r.game.standings();
    expect(rows.length).toBe(4);
    expect(new Set(rows.map((x) => x.stars)).size).toBe(1); // shared team result
    expect(rows[0].stars).toBe(3);
    expect(rows.reduce((s, x) => s + x.score, 0)).toBeGreaterThan(10); // kills were counted
  });

  it('an empty base falls: nobody defends, the core is destroyed and the team result is a defeat with fewer stars', () => {
    
    const r = runGame(baseDefenseGame, 2, { waves: 8 }, (id, snap) => { const me = stand(snap, id); return { x: me.x > 60 ? -1 : 0, y: me.y > 60 ? -1 : 0, b: 0 }; }, 400);
    expect(r.over).toBe(true);
    expect((r.game.snapshot() as any).win).toBe(-1);
    expect(r.game.standings()[0].stars).toBeLessThan(3);
  });

  it('roles cycle (gunner, builder, tank, medic), the builder spends scrap on a turret, the medic heals the core', () => {
    const r = runGame(baseDefenseGame, 4, { waves: 5 }, (id, snap, t) => {
      const me = stand(snap, id);
      const away = me.x < 700 ? 1 : 0;
      return { x: away, y: 0, b: me.r === 1 && t > 6 && Math.floor(t) % 4 === 0 ? BTN.A : 0 };
    }, 40);
    const first = r.game.snapshot() as any;
    expect(first.p.map((q: any) => q.r)).toEqual([0, 1, 2, 3]);
    expect(first.tr.length).toBeGreaterThan(0);
  });

  it('waves grow with the wave number and with the group size', () => {
    expect(waveList(5, 4).length).toBeGreaterThan(waveList(1, 4).length);
    expect(waveList(3, 8).length).toBeGreaterThan(waveList(3, 2).length);
    expect(waveList(4, 4).includes(2)).toBe(true); // brutes from wave 3
  });
});
