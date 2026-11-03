// Pure controller layout engine (no DOM): given the real pad area in CSS pixels, compute where
// the stick lives and where every action button goes. Guarantees (unit-tested over many sizes):
// every button is fully inside the area, buttons never overlap, and they are at least MIN_BTN px.

export type PadStyle = 'racing' | 'fighter' | 'platform' | 'party';
export type SizePref = 's' | 'm' | 'l';

export interface LayoutInput {
  w: number; // pad area width (safe areas already removed)
  h: number;
  buttons: number; // 0..4, ordered by importance: [0] = primary
  style: PadStyle;
  size: SizePref;
  mirrored: boolean; // left-handed: stick on the right, buttons on the left
  stick: boolean;
}

export interface Circle { x: number; y: number; r: number }
export interface PadLayout {
  stickRegion: { x: number; y: number; w: number; h: number } | null;
  stickRest: { x: number; y: number }; // where the idle stick is drawn
  stickRadius: number; // knob travel radius
  buttons: Circle[];
}

export const MIN_BTN = 56; // minimum touch target (CSS px)
const GAP = 12;
const SIZE_K: Record<SizePref, number> = { s: 0.8, m: 1, l: 1.2 };

/** Relative size of buttons 0..3, and direction of buttons 1..3 around the primary (degrees;
 *  0 = towards the stick, 90 = up, >90 = up-and-outwards). Directions differ by >= 55 degrees so
 *  neighbouring buttons can never overlap. Portrait uses a more vertical cluster (narrow region). */
const SCALE: Record<PadStyle, number[]> = {
  racing: [1.12, 0.86, 0.8, 0.74], // GAS, BRAKE, TURBO, ITEM
  fighter: [1.05, 0.84, 0.8, 0.74], // ATTACK, SPECIAL, DODGE
  platform: [1.1, 0.84, 0.8, 0.74], // JUMP, ACTION, SPECIAL
  party: [1.05, 0.84, 0.8, 0.74],
};
const ANGLES: Record<PadStyle, number[][]> = {
  racing: [[], [], [0], [0, 80], [0, 62, 124]],
  fighter: [[], [], [60], [85, 15], [90, 30, 150]],
  platform: [[], [], [20], [15, 85], [10, 70, 130]],
  party: [[], [], [45], [10, 85], [0, 60, 120]],
};
const PORTRAIT_ANGLES: number[][] = [[], [], [90], [95, 30], [0, 90, 45]];
/** Distance multipliers (portrait 4 buttons = 2x2 grid: the diagonal one sits sqrt(2) away). */
const PORTRAIT_DIST: number[][] = [[], [], [1], [1, 1], [1, 1, 1.42]];

export function computeLayout(inp: LayoutInput): PadLayout {
  const { w, h } = inp;
  const n = Math.max(0, Math.min(4, inp.buttons));
  const portrait = h > w;
  // stick takes ~46% of the width (a little more in portrait where thumbs reach further)
  const stickW = inp.stick ? Math.round(w * (n === 0 ? 1 : portrait ? 0.5 : 0.46)) : 0;
  const btnW = w - stickW;
  // regions in "outer = right" orientation; mirrored afterwards
  const stickRegion = inp.stick ? { x: 0, y: 0, w: stickW, h } : null;
  const bx0 = stickW, by0 = 0;

  const stickRadius = Math.round(Math.max(40, Math.min(78, Math.min(stickW || w, h) * 0.2)));
  const stickRest = { x: stickW * 0.5, y: Math.min(h - stickRadius * 1.6, h * 0.6) };

  const arr = { scale: SCALE[inp.style], angle: (portrait ? PORTRAIT_ANGLES : ANGLES[inp.style])[n], dist: portrait ? PORTRAIT_DIST[n] : [] as number[] };
  let base = Math.min(btnW, h) * ([0.62, 0.62, 0.48, 0.44, 0.4][n]) * SIZE_K[inp.size];
  base = Math.min(base, 170 * SIZE_K[inp.size]);

  let buttons: Circle[] = [];
  for (let iter = 0; iter < 40; iter++) {
    buttons = place(n, base, arr, bx0, by0, btnW, h);
    if (fits(buttons, bx0, by0, btnW, h)) break;
    base *= 0.92;
  }

  if (inp.mirrored) {
    for (const b of buttons) b.x = w - b.x;
    if (stickRegion) stickRegion.x = w - stickRegion.w;
    stickRest.x = w - stickRest.x;
  }
  return { stickRegion: stickRegion && { ...stickRegion }, stickRest, stickRadius, buttons };
}

function place(n: number, base: number, arr: { scale: number[]; angle: number[]; dist: number[] }, x0: number, y0: number, w: number, h: number): Circle[] {
  if (n === 0) return [];
  const r0 = Math.max(MIN_BTN / 2, (base * arr.scale[0]) / 2);
  const margin = Math.max(10, r0 * 0.25);
  // primary near the bottom-outer corner where the right thumb rests, but not jammed into it
  const p: Circle = {
    x: x0 + w - margin - r0 - (n === 1 ? (w - 2 * r0) * 0.22 : 0),
    y: y0 + h - margin - r0 - (n === 1 ? (h - 2 * r0) * 0.3 : h * 0.04),
    r: r0,
  };
  const out = [p];
  for (let i = 1; i < n; i++) {
    const r = Math.max(MIN_BTN / 2, (base * arr.scale[i]) / 2);
    const ang = ((arr.angle[i - 1] ?? 0) * Math.PI) / 180;
    const d = (r0 + r + GAP) * (arr.dist[i - 1] ?? 1);
    // angle 0 points inwards (towards the stick = -x), 90 points up (-y)
    out.push({ x: p.x - Math.cos(ang) * d, y: p.y - Math.sin(ang) * d, r });
  }
  // shift the whole cluster back inside the region if needed
  const minX = Math.min(...out.map((b) => b.x - b.r)), maxX = Math.max(...out.map((b) => b.x + b.r));
  const minY = Math.min(...out.map((b) => b.y - b.r)), maxY = Math.max(...out.map((b) => b.y + b.r));
  const dx = minX < x0 + 6 ? x0 + 6 - minX : maxX > x0 + w - 6 ? x0 + w - 6 - maxX : 0;
  const dy = minY < y0 + 6 ? y0 + 6 - minY : maxY > y0 + h - 6 ? y0 + h - 6 - maxY : 0;
  for (const b of out) { b.x += dx; b.y += dy; }
  return out;
}

function fits(bs: Circle[], x0: number, y0: number, w: number, h: number): boolean {
  for (const b of bs) {
    if (b.x - b.r < x0 + 4 || b.x + b.r > x0 + w - 4 || b.y - b.r < y0 + 4 || b.y + b.r > y0 + h - 4) return false;
  }
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    if (Math.hypot(bs[i].x - bs[j].x, bs[i].y - bs[j].y) < bs[i].r + bs[j].r + 6) return false;
  }
  return true;
}

/** Stick response: radial dead zone with rescaling (no jump at the edge), clamped to the unit circle. */
export function stickVector(dx: number, dy: number, radius: number, deadZone = 0.14): { x: number; y: number } {
  const d = Math.hypot(dx, dy) / radius;
  if (d <= deadZone) return { x: 0, y: 0 };
  const mag = Math.min(1, (d - deadZone) / (1 - deadZone));
  const len = Math.hypot(dx, dy);
  // truncate towards zero so rounding can never push a diagonal outside the unit circle
  const q = (v: number) => Math.trunc(v * 100 + Math.sign(v) * 1e-9) / 100;
  return { x: q((dx / len) * mag), y: q((dy / len) * mag) };
}
