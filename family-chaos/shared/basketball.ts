// BASKETBALL physics shared by the server (rules) and the screen (aim preview). Side view, one lane per player.
export const BBALL = {
  LW: 400, LH: 420, FLOOR: 392, // lane size and floor line (lane coordinates)
  SX: 62, SY: 318, // where the ball leaves the shooter's hands
  G: 880, VMAX: 700, BR: 12, // gravity, max launch speed, ball radius
  RIM_HALF: 27, RIM_R: 5, BOARD_W: 9, BOARD_H: 92, // hoop geometry
  TIME: 60,
} as const;

export interface Hoop { x: number; y: number } // rim centre
export interface Ball { x: number; y: number; vx: number; vy: number; prevY: number; touched: boolean; scored: boolean; t: number; bounces: number }

/** Hoop position over time: it drifts so the same shot does not work every time. */
export function hoopAt(t: number, phase: number, level: number): Hoop {
  const amp = Math.min(1, level * 0.25 + 0.15);
  return { x: 292 + Math.sin(t * 0.55 + phase) * 30 * amp, y: 176 + Math.sin(t * 0.83 + phase * 2) * 34 * amp };
}

/** Stick vector (x right, y down, magnitude 0..1) -> launch velocity. Needs a deliberate pull; angle is clamped to a sensible arc. */
export function launch(ax: number, ay: number) {
  const m = Math.min(1, Math.hypot(ax, ay));
  let a = Math.atan2(-ay, Math.max(0.05, ax)); // up is -y
  a = Math.max(0.2, Math.min(1.45, a));
  const v = BBALL.VMAX * (0.35 + 0.65 * m);
  return { vx: Math.cos(a) * v, vy: -Math.sin(a) * v };
}

export function newBall(vx: number, vy: number): Ball { return { x: BBALL.SX, y: BBALL.SY, vx, vy, prevY: BBALL.SY, touched: false, scored: false, t: 0, bounces: 0 }; }

/** Advances the ball; returns 'score' | 'swish' when it drops through the rim, 'rim' | 'board' on a bounce, or null. */
export function stepBall(b: Ball, hoop: Hoop, dt: number): 'score' | 'swish' | 'rim' | 'board' | 'floor' | null {
  let ev: 'score' | 'swish' | 'rim' | 'board' | 'floor' | null = null;
  b.t += dt;
  b.prevY = b.y;
  b.vy += BBALL.G * dt;
  b.x += b.vx * dt; b.y += b.vy * dt;
  // rim: two small iron points left and right of the opening
  for (const sx of [-1, 1]) {
    const rx = hoop.x + sx * BBALL.RIM_HALF, ry = hoop.y;
    const dx = b.x - rx, dy = b.y - ry, d = Math.hypot(dx, dy), min = BBALL.BR + BBALL.RIM_R;
    if (d < min && d > 1e-6) {
      const nx = dx / d, ny = dy / d;
      b.x = rx + nx * min; b.y = ry + ny * min;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 1.55 * vn * nx; b.vy -= 1.55 * vn * ny; b.vx *= 0.85; b.vy *= 0.85; ev = 'rim'; b.touched = true; }
    }
  }
  // backboard on the right of the rim
  const bx = hoop.x + BBALL.RIM_HALF + 12, top = hoop.y - BBALL.BOARD_H + 18, bot = hoop.y + 18;
  if (b.x + BBALL.BR > bx && b.x - BBALL.BR < bx + BBALL.BOARD_W && b.y > top && b.y < bot && b.vx > 0) {
    b.x = bx - BBALL.BR; b.vx = -b.vx * 0.55; b.vy *= 0.92; ev = 'board'; b.touched = true;
  }
  // through the hoop: crossing the rim line downwards between the two rim points
  if (!b.scored && b.prevY < hoop.y && b.y >= hoop.y && b.vy > 0 && Math.abs(b.x - hoop.x) < BBALL.RIM_HALF - 3) {
    b.scored = true;
    return b.touched ? 'score' : 'swish';
  }
  if (b.y > BBALL.FLOOR - BBALL.BR) { b.y = BBALL.FLOOR - BBALL.BR; b.vy = -b.vy * 0.45; b.vx *= 0.8; b.bounces++; ev = ev ?? 'floor'; }
  return ev;
}

/** Aim preview: the first `n` points of the flight for a given pull (ignores the rim). */
export function preview(ax: number, ay: number, n = 22, step = 0.045): [number, number][] {
  const { vx, vy } = launch(ax, ay);
  const out: [number, number][] = [];
  for (let i = 1; i <= n; i++) { const t = i * step; out.push([BBALL.SX + vx * t, BBALL.SY + vy * t + 0.5 * BBALL.G * t * t]); }
  return out;
}
