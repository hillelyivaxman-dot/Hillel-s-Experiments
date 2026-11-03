// Kart Chaos tracks. A track is a closed Catmull-Rom spline through control points
// in a 1600x900 world. Server (physics) and client (drawing) build the same polyline.

export const WORLD_W = 1600;
export const WORLD_H = 900;
export const TRACK_WIDTH = 130;

export interface Track {
  pts: { x: number; y: number }[]; // dense centerline samples
  cum: number[]; // cumulative length at each sample
  length: number;
  boxesAt: number[]; // fractions of length with item-box rows
  padsAt: number[]; // fractions of length with boost pads
}

function lemniscate(n: number) {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const d = 1 + Math.sin(t) ** 2;
    out.push([800 + (640 * Math.cos(t)) / d, 450 + (760 * Math.sin(t) * Math.cos(t)) / d]);
  }
  return out;
}

const CONTROL: { pts: [number, number][]; boxesAt: number[]; padsAt: number[] }[] = [
  {
    pts: [[230, 450], [300, 190], [600, 150], [800, 300], [1000, 150], [1300, 180], [1380, 450], [1300, 720], [800, 770], [300, 720]],
    boxesAt: [0.3, 0.62, 0.86], padsAt: [0.14, 0.52],
  },
  {
    pts: [[170, 640], [210, 180], [470, 150], [580, 440], [740, 620], [930, 610], [1020, 400], [1120, 170], [1390, 180], [1440, 520], [1320, 800], [720, 830], [260, 810]],
    boxesAt: [0.22, 0.5, 0.78], padsAt: [0.08, 0.4, 0.66],
  },
  { pts: lemniscate(16), boxesAt: [0.2, 0.45, 0.7, 0.95], padsAt: [0.08, 0.58] },
];

export const TRACK_COUNT = CONTROL.length;

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

const cache = new Map<number, Track>();

export function getTrack(id: number): Track {
  const key = ((id % CONTROL.length) + CONTROL.length) % CONTROL.length;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = CONTROL[key];
  const P = c.pts;
  const n = P.length;
  const raw: { x: number; y: number }[] = [];
  const steps = 24;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      raw.push({ x: catmull(p0[0], p1[0], p2[0], p3[0], t), y: catmull(p0[1], p1[1], p2[1], p3[1], t) });
    }
  }
  const cum = [0];
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
  const last = raw[raw.length - 1];
  const length = cum[cum.length - 1] + Math.hypot(raw[0].x - last.x, raw[0].y - last.y);
  const tr: Track = { pts: raw, cum, length, boxesAt: c.boxesAt, padsAt: c.padsAt };
  cache.set(key, tr);
  return tr;
}

/** Item-box rows (3 boxes across the road) — static per track, so not sent in frames. */
export function trackBoxes(tr: Track) {
  return tr.boxesAt.flatMap((f, row) => {
    const pt = pointAt(tr, f);
    return [-38, 0, 38].map((o, k) => ({ id: row * 3 + k, x: pt.x - pt.ty * o, y: pt.y + pt.tx * o }));
  });
}

/** Boost pads — static per track. */
export function trackPads(tr: Track) {
  return tr.padsAt.map((f) => {
    const pt = pointAt(tr, f);
    return { x: pt.x, y: pt.y, a: Math.atan2(pt.ty, pt.tx) };
  });
}

/** Position + unit tangent at a fraction of track length. */
export function pointAt(tr: Track, frac: number) {
  const target = (((frac % 1) + 1) % 1) * tr.length;
  let i = 0;
  while (i < tr.cum.length - 1 && tr.cum[i + 1] < target) i++;
  const a = tr.pts[i], b = tr.pts[(i + 1) % tr.pts.length];
  const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const t = Math.min(1, (target - tr.cum[i]) / segLen);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx: (b.x - a.x) / segLen, ty: (b.y - a.y) / segLen };
}
