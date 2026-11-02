// Tiny top-down physics helpers shared by arena-style games.

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number; // mass; Infinity = immovable
}

/** Exponential damping: keeps `keep` fraction of velocity per second. */
export function damp(b: Body, keep: number, dt: number) {
  const k = Math.pow(keep, dt);
  b.vx *= k;
  b.vy *= k;
}

export function integrate(b: Body, dt: number) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
}

export function limitSpeed(b: Body, max: number) {
  const s = Math.hypot(b.vx, b.vy);
  if (s > max) {
    b.vx *= max / s;
    b.vy *= max / s;
  }
}

/**
 * Resolves overlap between two circles with an elastic impulse.
 * Returns the approach speed (0 when not colliding).
 */
export function collide(a: Body, b: Body, restitution = 0.9, kick = 0): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (dist >= min) return 0;
  const nx = dist > 1e-6 ? dx / dist : 1;
  const ny = dist > 1e-6 ? dy / dist : 0;
  const ia = a.m === Infinity ? 0 : 1 / a.m;
  const ib = b.m === Infinity ? 0 : 1 / b.m;
  const isum = ia + ib;
  if (isum === 0) return 0;
  // positional correction
  const overlap = min - dist;
  a.x -= nx * overlap * (ia / isum);
  a.y -= ny * overlap * (ia / isum);
  b.x += nx * overlap * (ib / isum);
  b.y += ny * overlap * (ib / isum);
  // velocity along normal
  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv >= 0) return 0;
  const j = (-(1 + restitution) * rv) / isum;
  a.vx -= j * ia * nx + kick * nx * (ia / isum);
  a.vy -= j * ia * ny + kick * ny * (ia / isum);
  b.vx += j * ib * nx + kick * nx * (ib / isum);
  b.vy += j * ib * ny + kick * ny * (ib / isum);
  return -rv;
}

/** Assigns places from an ordered list of scores. */
export function spawnRing(n: number, radius: number, cx = 0, cy = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  });
}
