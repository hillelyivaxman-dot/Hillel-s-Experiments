import { describe, expect, it } from 'vitest';
import { computeLayout, MIN_BTN, stickVector, type PadStyle, type SizePref } from '../../client/src/controller/layout';

// Real phone viewports (CSS px) minus a ~44px HUD, portrait and landscape, plus odd sizes.
const SIZES: [number, number][] = [];
for (const [w, h] of [[320, 568], [360, 740], [375, 667], [390, 844], [393, 852], [412, 891], [412, 915], [428, 926], [430, 932], [768, 1024], [820, 1180]]) {
  SIZES.push([w, h - 44], [h, w - 44]);
}
SIZES.push([300, 220], [640, 260], [1024, 300]);

describe('controller layout engine', () => {
  for (const style of ['racing', 'fighter', 'platform', 'party'] as PadStyle[]) {
    for (const n of [1, 2, 3, 4]) {
      it(`${style} with ${n} button(s): inside the area, no overlap, big enough — every size/pref/side`, () => {
        for (const [w, h] of SIZES) for (const size of ['s', 'm', 'l'] as SizePref[]) for (const mirrored of [false, true]) {
          const L = computeLayout({ w, h, buttons: n, style, size, mirrored, stick: true });
          const ctx = `${w}x${h} ${size} ${mirrored ? 'mirrored' : ''}`;
          expect(L.buttons, ctx).toHaveLength(n);
          for (const b of L.buttons) {
            expect(b.r * 2, ctx).toBeGreaterThanOrEqual(MIN_BTN);
            expect(b.x - b.r, ctx).toBeGreaterThanOrEqual(0);
            expect(b.y - b.r, ctx).toBeGreaterThanOrEqual(0);
            expect(b.x + b.r, ctx).toBeLessThanOrEqual(w);
            expect(b.y + b.r, ctx).toBeLessThanOrEqual(h);
            // buttons stay out of the stick region
            const s = L.stickRegion!;
            const inside = b.x > s.x && b.x < s.x + s.w;
            expect(inside, `${ctx} button centre inside stick region`).toBe(false);
          }
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
            const a = L.buttons[i], b = L.buttons[j];
            expect(Math.hypot(a.x - b.x, a.y - b.y), `${ctx} overlap ${i}/${j}`).toBeGreaterThanOrEqual(a.r + b.r);
          }
          if (size !== 's' && h >= 300 && w >= 360) expect(L.buttons[0].r * 2, `${ctx} primary`).toBeGreaterThanOrEqual(n >= 4 && h > w ? 60 : 72);
        }
      });
    }
  }

  it('mirroring swaps the sides', () => {
    const a = computeLayout({ w: 800, h: 360, buttons: 3, style: 'racing', size: 'm', mirrored: false, stick: true });
    const b = computeLayout({ w: 800, h: 360, buttons: 3, style: 'racing', size: 'm', mirrored: true, stick: true });
    expect(a.stickRegion!.x).toBe(0);
    expect(b.stickRegion!.x).toBeGreaterThan(300);
    expect(a.buttons[0].x).toBeGreaterThan(400);
    expect(b.buttons[0].x).toBeLessThan(400);
  });

  it('size preference changes button size', () => {
    const r = (size: SizePref) => computeLayout({ w: 844, h: 346, buttons: 2, style: 'fighter', size, mirrored: false, stick: true }).buttons[0].r;
    expect(r('s')).toBeLessThan(r('m'));
    expect(r('m')).toBeLessThan(r('l'));
  });
});

describe('stick response', () => {
  it('dead zone gives exactly zero, then ramps smoothly from zero', () => {
    expect(stickVector(5, 3, 60)).toEqual({ x: 0, y: 0 });
    const just = stickVector(10, 0, 60);
    expect(just.x).toBeGreaterThan(0);
    expect(just.x).toBeLessThan(0.1);
  });
  it('full deflection = 1, diagonals keep direction and stay inside the unit circle', () => {
    expect(stickVector(60, 0, 60)).toEqual({ x: 1, y: 0 });
    expect(stickVector(200, 0, 60)).toEqual({ x: 1, y: 0 });
    const d = stickVector(50, 50, 60);
    expect(d.x).toBeCloseTo(d.y, 5);
    expect(Math.hypot(d.x, d.y)).toBeLessThanOrEqual(1.001);
    expect(Math.hypot(d.x, d.y)).toBeGreaterThan(0.95);
  });
});
