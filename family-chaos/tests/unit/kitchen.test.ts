import { describe, expect, it } from 'vitest';
import { KITCHEN, STATIONS } from '../../shared/kitchen';
import { BTN } from '../../shared/protocol';
import { kitchenGame } from '../../server/games/kitchen';
import { runGame } from './helpers';

type Step = { go: string } | { at: [number, number] } | { press: true } | { hold: number } | { wait: number };

/** A scripted cook: walks to stations, taps A, holds B, waits. One tick of release between presses. */
function cook(steps: Step[]) {
  let i = 0, t0 = -1, phase: 'run' | 'release' = 'run';
  return (id: string, s: any, t: number) => {
    const none = { x: 0, y: 0, b: 0 };
    const st = steps[i];
    if (!st) return none;
    const me = s.p.find((p: any) => p.id === id);
    if (phase === 'release') { phase = 'run'; return none; }
    if ('go' in st) {
      const def = STATIONS.find((d) => d.id === st.go)!;
      const [rx, ry] = def.pos[s.lo];
      const cx = rx + def.w / 2, cy = ry + def.h / 2;
      const nx = Math.max(rx, Math.min(me.x, rx + def.w)), ny = Math.max(ry, Math.min(me.y, ry + def.h));
      // arrived = close enough AND this station is the one the game would pick (crates sit side by side)
      const near = STATIONS.map((d) => { const [x0, y0] = d.pos[s.lo]; return { id: d.id, d: Math.hypot(me.x - Math.max(x0, Math.min(me.x, x0 + d.w)), me.y - Math.max(y0, Math.min(me.y, y0 + d.h))) }; }).sort((a, b) => a.d - b.d)[0];
      if (Math.hypot(me.x - nx, me.y - ny) < 40 && near.id === st.go) { i++; t0 = -1; return none; }
      const dx = cx - me.x, dy = cy - me.y, d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d, b: 0 };
    }
    if ('at' in st) { // waypoint (to walk around the island of counters)
      const dx = st.at[0] - me.x, dy = st.at[1] - me.y, d = Math.hypot(dx, dy);
      if (d < 30) { i++; return none; }
      return { x: dx / d, y: dy / d, b: 0 };
    }
    if ('press' in st) { i++; phase = 'release'; return { x: 0, y: 0, b: BTN.A }; }
    if (t0 < 0) t0 = t;
    const dur = 'hold' in st ? st.hold : st.wait;
    if (t - t0 >= dur) { i++; t0 = -1; return none; }
    return { x: 0, y: 0, b: 'hold' in st ? BTN.B : 0 };
  };
}

const firstOrder = (seed: number) => {
  const r = runGame(kitchenGame, 1, { time: 180 }, () => ({ x: 0, y: 0, b: 0 }), 2, seed);
  return (r.game.snapshot() as any).o[0]?.r as string | undefined;
};
const findSeed = (recipe: string) => { for (let s = 1; s < 200; s++) if (firstOrder(s) === recipe) return s; throw new Error('no seed'); };

const salad: Step[] = [
  { go: 'plates' }, { press: true }, { go: 'n1' }, { press: true }, // plate -> counter
  { go: 'c-tomato' }, { press: true }, { go: 'b1' }, { press: true }, { hold: 3.3 }, { press: true }, { go: 'n1' }, { press: true }, // tomato: chop, onto plate
  { go: 'c-lettuce' }, { press: true }, { go: 'b2' }, { press: true }, { hold: 3.3 }, { press: true }, { go: 'n1' }, { press: true }, // lettuce
  { press: true }, { go: 'serve' }, { press: true }, // pick up the plate, serve
];

describe('crazy kitchen', () => {
  it('a cook takes, chops, plates and serves a salad order: points are scored and the order is gone', () => {
    const seed = findSeed('salad');
    const r = runGame(kitchenGame, 1, { time: 180 }, cook(salad), 75, seed); // before the first order can expire (80 s)
    const snap = r.game.snapshot() as any;
    expect(r.fx).toContain('chopped');
    expect(r.fx).toContain('serve');
    expect(snap.sv).toBe(1);
    expect(snap.sc).toBeGreaterThanOrEqual(18);
    expect(r.fx).not.toContain('wrong');
  });

  it('serving the wrong dish (or an empty plate) is rejected and scores nothing', () => {
    const r = runGame(kitchenGame, 1, { time: 180 }, cook([{ go: 'plates' }, { press: true }, { go: 'serve' }, { press: true }, { wait: 30 }]), 40, 3);
    expect(r.fx).toContain('wrong');
    expect((r.game.snapshot() as any).sc).toBe(0);
  });

  it('a patty on the stove cooks, then burns if left alone, and a burnt patty cannot go on a plate', () => {
    const r = runGame(kitchenGame, 1, { time: 180 }, cook([{ go: 'c-patty' }, { press: true }, { at: [400, 300] }, { at: [400, 520] }, { at: [755, 540] }, { go: 's1' }, { press: true }, { wait: 14 }]), 30, 5);
    expect(r.fx).toContain('almost');
    expect(r.fx).toContain('cooked');
    expect(r.fx).toContain('burnt');
    const snap = r.game.snapshot() as any;
    expect(snap.c.find((c: any) => c[0] === 's1')[1]).toBe('patty.b');
    // pick up the burnt patty and try to add it to a plate waiting on a counter: refused, the plate stays empty
    const r2 = runGame(kitchenGame, 1, { time: 180 }, cook([
      { go: 'plates' }, { press: true }, { go: 'n1' }, { press: true },
      { go: 'c-patty' }, { press: true }, { at: [400, 300] }, { at: [400, 520] }, { at: [755, 540] }, { go: 's1' }, { press: true }, { wait: 13 }, { press: true },
      { at: [755, 540] }, { at: [400, 520] }, { at: [400, 300] }, { go: 'n1' }, { press: true }, { wait: 1 },
    ]), 45, 5);
    const snap2 = r2.game.snapshot() as any;
    expect(snap2.p[0].h).toBe('patty.b'); // still in hand: the plate refused it
    expect(snap2.c.find((c: any) => c[0] === 'n1')[1]).toBe('plate:'); // and the plate is still empty
  });

  it('orders arrive, expire when ignored (with a penalty that never goes below zero), and the kitchen reshuffles at half time', () => {
    const r = runGame(kitchenGame, 2, { time: 120 }, () => ({ x: 0, y: 0, b: 0 }), 130);
    expect(r.fx).toContain('order');
    expect(r.fx).toContain('late');
    expect(r.fx).toContain('shuffle');
    expect(r.over).toBe(true);
    const snap = r.game.snapshot() as any;
    expect(snap.lo).toBe(1);
    expect(snap.sc).toBe(0);
    expect(snap.o.length).toBeLessThanOrEqual(4);
  });

  it('stations are solid: players never end up inside one, and stay in the kitchen', { timeout: 30000 }, () => {
    let inside = 0;
    runGame(kitchenGame, 3, { time: 60 }, (id, s, t) => {
      for (const p of s.p) for (const d of STATIONS) {
        const [rx, ry] = d.pos[s.lo];
        if (p.x > rx + 1 && p.x < rx + d.w - 1 && p.y > ry + 1 && p.y < ry + d.h - 1) inside++;
        expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(KITCHEN.W); expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(KITCHEN.H);
      }
      return { x: Math.sin(t + id.length), y: Math.cos(t * 1.7 + id.length), b: 0 };
    }, 60);
    expect(inside).toBe(0);
  });

  it('co-op result: everyone shares one score and the same star tier', () => {
    const seed = findSeed('salad');
    const r = runGame(kitchenGame, 2, { time: 30 }, (id, s, t) => (id === 'p1' ? cook(salad)(id, s, t) : { x: 0, y: 0, b: 0 }), 40, seed);
    const st = r.game.standings();
    expect(st).toHaveLength(2);
    expect(st[0].score).toBe(st[1].score);
    expect(st[0].tie).toBe(st[1].tie);
    expect(st[0].stars).toBe(st[1].stars);
    expect(st[0].stars).toBeGreaterThanOrEqual(0);
  });
});
