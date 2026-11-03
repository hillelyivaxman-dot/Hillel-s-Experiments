// CHAOS RUSH level. A side-scrolling obstacle course generated deterministically from a seed, so the
// server (physics) and every screen (drawing) build the identical level; only the seed is sent.

export const RUSH = {
  GROUND: 520, // y of the ground surface (y grows downwards)
  VIEW_W: 1400,
  VIEW_H: 760,
  CHUNK_MIN: 8,
  CHUNK_MAX: 16,
};

export interface Seg { x0: number; x1: number }
export interface Plat { x: number; y: number; w: number; mv?: { ax: number; f: number; ph: number } }
export interface Saw { x: number; y0: number; amp: number; f: number; ph: number; r: number }
export interface Spike { x: number; w: number }
export interface Level {
  ground: Seg[];
  plats: Plat[];
  saws: Saw[];
  spikes: Spike[];
  checkpoints: number[]; // x of each checkpoint (the first one is the start)
  finishX: number;
  length: number;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KINDS = ['spikes', 'pit', 'saw', 'moving', 'stairs', 'pit', 'spikes', 'saw'] as const;
const cache = new Map<string, Level>();

export function platX(p: Plat, t: number): number {
  return p.mv ? p.x + p.mv.ax * Math.sin(p.mv.f * t + p.mv.ph) : p.x;
}
export function sawY(s: Saw, t: number): number {
  return s.y0 + s.amp * Math.sin(s.f * t + s.ph);
}

export function makeLevel(seed: number, chunks = 12): Level {
  const key = `${seed}:${chunks}`;
  const hit = cache.get(key);
  if (hit) return hit;
  chunks = Math.max(RUSH.CHUNK_MIN, Math.min(RUSH.CHUNK_MAX, chunks));
  const r = rng(seed);
  const G = RUSH.GROUND;
  const lv: Level = { ground: [{ x0: -200, x1: 900 }], plats: [], saws: [], spikes: [], checkpoints: [60], finishX: 0, length: 0 };
  let x = 900;
  let last = '';
  for (let i = 0; i < chunks; i++) {
    let k: string = KINDS[Math.floor(r() * KINDS.length)];
    if (k === last) k = KINDS[(KINDS.indexOf(k as never) + 1 + Math.floor(r() * 3)) % KINDS.length];
    last = k;
    lv.checkpoints.push(x + 60);
    switch (k) {
      case 'spikes': {
        const w = 700;
        lv.ground.push({ x0: x, x1: x + w });
        lv.spikes.push({ x: x + 240 + r() * 100, w: 70 });
        if (r() < 0.6) lv.spikes.push({ x: x + 480 + r() * 60, w: 70 });
        x += w;
        break;
      }
      case 'pit': {
        const a = 200, gap = 150 + r() * 60, b = 320;
        lv.ground.push({ x0: x, x1: x + a }, { x0: x + a + gap, x1: x + a + gap + b });
        if (r() < 0.5) lv.plats.push({ x: x + a + gap / 2 - 55, y: G - 110, w: 110 });
        x += a + gap + b;
        break;
      }
      case 'saw': {
        const w = 760;
        lv.ground.push({ x0: x, x1: x + w });
        lv.saws.push({ x: x + 380, y0: G - 95, amp: 55, f: 2 + r(), ph: r() * 6, r: 26 });
        x += w;
        break;
      }
      case 'moving': {
        const a = 160, gap = 300, b = 260;
        lv.ground.push({ x0: x, x1: x + a }, { x0: x + a + gap, x1: x + a + gap + b });
        lv.plats.push({ x: x + a + gap / 2 - 55, y: G - 25, w: 110, mv: { ax: 85, f: 1.2 + r() * 0.5, ph: r() * 6 } });
        x += a + gap + b;
        break;
      }
      default: { // stairs: a high route over a long spike field (platforms are wide enough for a running jump)
        const w = 920;
        lv.ground.push({ x0: x, x1: x + w });
        lv.plats.push({ x: x + 150, y: G - 90, w: 190 }, { x: x + 400, y: G - 150, w: 190 }, { x: x + 650, y: G - 90, w: 190 });
        lv.spikes.push({ x: x + 270, w: 520 });
        x += w;
      }
    }
  }
  lv.checkpoints.push(x + 60);
  lv.ground.push({ x0: x, x1: x + 800 });
  lv.finishX = x + 480;
  lv.length = x + 800;
  if (cache.size > 20) cache.clear();
  cache.set(key, lv);
  return lv;
}
