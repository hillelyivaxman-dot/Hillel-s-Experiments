import { describe, expect, it } from 'vitest';
import { bikeGame, boatGame } from '../../server/games/kart';
import { BTN } from '../../shared/protocol';
import { getTrack, pointAt, trackFeatures } from '../../shared/tracks';
import { runGame } from './helpers';

// Boats and bikes must play differently from karts: they have their own hazards and their own special button.
function pilot(game: typeof boatGame, mode: 'boat' | 'bike', track: number, press: (snap: any, me: any, t: number) => number) {
  const tr = getTrack(track), n = tr.pts.length, prog = new Map<string, number>();
  return runGame(game, 1, { laps: 1, track }, (id, snap: any, t) => {
    const me = snap.c.find((c: any) => c.id === id);
    const from = prog.get(id) ?? 0; let best = from, bd = Infinity;
    for (let k = -20; k <= 60; k++) { const i = (((from + k) % n) + n) % n, p = tr.pts[i]; const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2; if (d < bd) { bd = d; best = i; } }
    prog.set(id, best);
    const ahead = pointAt(tr, (tr.cum[best] + 90) / tr.length);
    let diff = Math.atan2(ahead.y - me.y, ahead.x - me.x) - me.a;
    while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
    return { x: Math.max(-1, Math.min(1, diff * 2.5)), y: 0, b: press(snap, me, t) };
  }, 200);
}

describe('bike racing', () => {
  it('has ramps and hurdles on every track, and none of the kart/boat features', () => {
    for (const tk of [0, 1, 2]) { const f = trackFeatures(tk, 'bike'); expect(f.ramps.length).toBeGreaterThan(1); expect(f.hurdles.length).toBeGreaterThan(5); expect(f.currents.length + f.rocks.length).toBe(0); }
  });
  it('hopping over hurdles builds a combo; a rider who never hops crashes into them', () => {
    const F = trackFeatures(0, 'bike');
    const hop = (_s: any, me: any, t: number) => (F.hurdles.some((h) => { const dx = h.x - me.x, dy = h.y - me.y, d = Math.hypot(dx, dy); return d < 110 && d > 30 && Math.cos(Math.atan2(dy, dx) - me.a) > 0.7; }) && Math.floor(t * 30) % 2 === 0 ? BTN.A : 0);
    const good = pilot(bikeGame, 'bike', 0, hop), bad = pilot(bikeGame, 'bike', 0, () => 0);
    const n = (r: { fx: string[] }, k: string) => r.fx.filter((x) => x === k).length;
    expect(n(good, 'clear')).toBeGreaterThanOrEqual(3);
    expect(n(good, 'crash')).toBeLessThan(n(bad, 'crash'));
    expect(n(bad, 'crash')).toBeGreaterThanOrEqual(2);
    expect(n(good, 'ramp')).toBeGreaterThan(0); // the ramps launch you
  });
});

describe('boat racing', () => {
  it('has streams, rocks and whirlpools (and no ramps/hurdles); surge makes a boat faster', () => {
    for (const tk of [0, 1, 2]) { const f = trackFeatures(tk, 'boat'); expect(f.currents.some((c) => c.push > 0)).toBe(true); expect(f.currents.some((c) => c.push < 0)).toBe(true); expect(f.rocks.length).toBeGreaterThan(4); expect(f.whirls.length).toBeGreaterThan(0); expect(f.ramps.length + f.hurdles.length).toBe(0); }
    const plain = pilot(boatGame, 'boat', 0, () => 0);
    const surge = pilot(boatGame, 'boat', 0, (_s, _m, t) => (Math.floor(t * 30) % 90 === 0 ? BTN.A : Math.floor(t * 30) % 90 === 1 ? 0 : 0));
    // a tap every 3 s (cooldown 2.6 s) must have fired and helped
    expect(surge.fx).toContain('surge');
    expect(plain.over && surge.over).toBe(true);
    expect(surge.t).toBeLessThan(plain.t);
  });
});
