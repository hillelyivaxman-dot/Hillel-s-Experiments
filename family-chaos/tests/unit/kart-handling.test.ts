import { describe, expect, it } from 'vitest';
import { kartGame, KART } from '../../server/games/kart';
import { BTN } from '../../shared/protocol';
import { getTrack, pointAt } from '../../shared/tracks';
import { runGame } from './helpers';

// Arcade handling quality, measured from the car's snapshots (position, heading, steering).
const DT = 1 / 30;
interface S { t: number; x: number; y: number; a: number; st: number; dr: number }

function drive(seconds: number, bot: (t: number, s: S) => { x: number; b: number }, track = 0) {
  const log: S[] = [];
  runGame(kartGame, 1, { laps: 5, track }, (id, snap, t) => {
    const c = snap.c.find((q: any) => q.id === id);
    const s = { t, x: c.x, y: c.y, a: c.a, st: c.st, dr: c.dr ?? 0 };
    log.push(s);
    const o = bot(t, s);
    return { x: o.x, y: 0, b: o.b };
  }, seconds);
  return log;
}

/** Autopilot until the car is fast and straight (on the figure-eight's long arms), then `scenario` runs with t = 0. */
function driveFromSpeed(seconds: number, scenario: (rel: number, s: S) => { x: number; b: number }) {
  const tr = getTrack(2);
  const n = tr.pts.length;
  let from = 0, t0 = -1, prev: S | null = null;
  const log: S[] = [];
  runGame(kartGame, 1, { laps: 9, track: 2 }, (id, snap, t) => {
    const c = snap.c.find((q: any) => q.id === id);
    const s: S = { t, x: c.x, y: c.y, a: c.a, st: c.st, dr: c.dr ?? 0 };
    const speed = prev ? Math.hypot(s.x - prev.x, s.y - prev.y) / DT : 0;
    prev = s;
    if (t0 >= 0) { const rel = { ...s, t: t - t0 }; log.push(rel); const o = scenario(t - t0, rel); return { x: o.x, y: 0, b: o.b }; }
    let best = from, bd = Infinity;
    for (let k = -20; k <= 60; k++) { const i = (((from + k) % n) + n) % n, p = tr.pts[i]; const d = (p.x - s.x) ** 2 + (p.y - s.y) ** 2; if (d < bd) { bd = d; best = i; } }
    from = best;
    const ahead = pointAt(tr, (tr.cum[best] + 120) / tr.length);
    let diff = Math.atan2(ahead.y - s.y, ahead.x - s.x) - s.a;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (t > 2 && speed > 300 && Math.abs(diff) < 0.1 && Math.abs(c.st) < 0.15) { t0 = t; const rel = { ...s, t: 0 }; log.push(rel); const o = scenario(0, rel); return { x: o.x, y: 0, b: o.b }; }
    return { x: Math.max(-1, Math.min(1, diff * 2.5)), y: 0, b: BTN.A };
  }, seconds + 30);
  return log;
}
const speedAt = (log: S[], i: number) => (i > 0 ? Math.hypot(log[i].x - log[i - 1].x, log[i].y - log[i - 1].y) / DT : 0);
const dAng = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

describe('kart handling', () => {
  it('never snaps or spins: yaw per tick stays under the speed-dependent limit, even with wild steering', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    let cur = 0;
    const log = drive(30, (t) => { if (Math.round(t * 30) % 6 === 0) cur = rnd(); return { x: cur, b: BTN.A }; }, 1);
    let worst = 0;
    for (let i = 1; i < log.length; i++) worst = Math.max(worst, Math.abs(dAng(log[i - 1].a, log[i].a)));
    const limit = (KART.TURN_LOW * 1.25 + KART.ASSIST) * DT + 0.01;
    expect(worst).toBeLessThan(limit);
  });

  it('digital steering (arrows) ramps in instead of jumping; analog is immediate enough', () => {
    const log = drive(3, (t) => ({ x: t > 1 ? 1 : 0, b: BTN.A }));
    const i0 = log.findIndex((s) => s.t > 1);
    expect(log[i0 + 2].st).toBeLessThan(0.7); // not an instant 100%
    expect(log[i0 + 15].st).toBeGreaterThanOrEqual(0.95); // but full lock within half a second
  });

  it('is responsive: heading starts changing within a tenth of a second and reaches a decent yaw rate', () => {
    const log = drive(4, (t) => ({ x: t > 1.5 ? 1 : 0, b: BTN.A }));
    const i0 = log.findIndex((s) => s.t > 1.5);
    const turned = Math.abs(dAng(log[i0].a, log[i0 + 3].a));
    expect(turned).toBeGreaterThan(0.01);
    const rate = Math.abs(dAng(log[i0 + 5].a, log[i0 + 20].a)) / (15 * DT);
    expect(rate).toBeGreaterThan(1.2);
    expect(rate).toBeLessThan(KART.TURN_LOW * 1.1);
  });

  it('full lock at speed makes a wide stable arc (yaw lower than at low speed) and keeps moving', () => {
    const log = driveFromSpeed(2.5, (rel) => ({ x: -1, b: BTN.A }));
    expect(log.length).toBeGreaterThan(30);
    const speedBefore = speedAt(log, 2);
    const yaw = Math.abs(dAng(log[10].a, log[25].a)) / (15 * DT);
    expect(speedBefore).toBeGreaterThan(280);
    expect(yaw).toBeLessThan(KART.TURN_LOW);
    expect(yaw).toBeGreaterThan(1.3);
    expect(speedAt(log, 40)).toBeGreaterThan(speedBefore * 0.4); // cornering costs speed but never stalls
  });

  it('brakes hard: from speed to a near stop in about a second', () => {
    const log = driveFromSpeed(2.5, () => ({ x: 0, b: BTN.B }));
    const v0 = speedAt(log, 1);
    expect(v0).toBeGreaterThan(250);
    expect(speedAt(log, 18)).toBeLessThan(v0 * 0.2 + 30); // stopped within ~0.6 s (holding brake then reverses slowly, as in arcade racers)
    expect(speedAt(log, 45)).toBeLessThan(KART.MAX * 0.4); // reverse stays slow
  });

  it('drift flag appears only when braking while steering at speed', () => {
    const log = driveFromSpeed(3, (rel) => ({ x: rel > 0.6 ? 1 : 0, b: rel < 0.6 ? BTN.A : rel < 1.8 ? BTN.A | BTN.B : BTN.A }));
    expect(log.filter((s) => s.t < 0.6).every((s) => s.dr === 0)).toBe(true);
    expect(log.filter((s) => s.t > 0.8 && s.t < 1.7).some((s) => s.dr === 1)).toBe(true);
    expect(log.filter((s) => s.t > 2.4).every((s) => s.dr === 0)).toBe(true);
  });
});
