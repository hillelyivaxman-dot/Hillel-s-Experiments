import { describe, expect, it } from 'vitest';
import { BTN } from '../../shared/protocol';
import { VANISH } from '../../shared/vanish';
import { vanishGame } from '../../server/games/vanish';
import { runGame } from './helpers';

const idle = () => ({ x: 0, y: 0, b: 0 });

describe('vanishing floor', () => {
  it('the floor decays by itself: standing still, everybody eventually falls and the last one standing wins', () => {
    const r = runGame(vanishGame, 3, {}, idle, 300);
    expect(r.over).toBe(true);
    expect(r.fx).toContain('crack');
    expect(r.fx).toContain('gone');
    expect(r.fx.filter((k) => k === 'fall').length).toBeGreaterThanOrEqual(2);
    const st = r.game.standings();
    expect(st).toHaveLength(3);
    for (let i = 1; i < st.length; i++) expect((st[i - 1].tie ?? 0) >= (st[i].tie ?? 0)).toBe(true); // survivors first
  });

  it('walking off the edge of the arena drops you', () => {
    const r = runGame(vanishGame, 2, {}, (id) => (id === 'p1' ? { x: 1, y: 0, b: 0 } : idle()), 8);
    expect(r.fx).toContain('fall');
    const snap = r.game.snapshot() as any;
    expect(snap.p.find((p: any) => p.id === 'p1').al).toBe(0);
  });

  it('JUMP lifts the player (safe in the air) and has a cooldown; DASH has a cooldown too', () => {
    let maxZ = 0;
    const r = runGame(vanishGame, 2, {}, (id, s, t) => {
      if (id === 'p1') maxZ = Math.max(maxZ, s.p.find((p: any) => p.id === 'p1').z);
      return id === 'p1' ? { x: 0, y: 0, b: (Math.floor(t * 10) % 2 ? BTN.A : 0) | (Math.floor(t * 8) % 2 ? BTN.B : 0) } : idle();
    }, 6);
    expect(maxZ).toBeGreaterThan(40);
    expect(r.fx.filter((k) => k === 'jump').length).toBeLessThanOrEqual(Math.ceil(6 / VANISH.JUMP_CD) + 1);
    expect(r.fx.filter((k) => k === 'dash').length).toBeLessThanOrEqual(Math.ceil(6 / VANISH.DASH_CD) + 1);
    expect(r.fx.filter((k) => k === 'dash').length).toBeGreaterThanOrEqual(1);
  });

  it('players bump into each other', () => {
    // two players run at each other through the middle
    const r = runGame(vanishGame, 2, {}, (id, s) => {
      const me = s.p.find((p: any) => p.id === id), other = s.p.find((p: any) => p.id !== id);
      const dx = other.x - me.x, dy = other.y - me.y, d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d, b: 0 };
    }, 5);
    expect(r.fx).toContain('bump');
  });
});
