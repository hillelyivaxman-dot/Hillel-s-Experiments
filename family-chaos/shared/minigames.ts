// Constants shared by minigame servers (rules) and screens (drawing).
export const BB = { HOOP_X: 1040, MIN_X: 160, MAX_X: 820, TIME: 60, FLIGHT: 0.85, SPEED: 1.35 } as const;
/** Meter target (0..1) and the half-width of the green zone for a shooting distance. */
export function bbZone(x: number) {
  const d = BB.HOOP_X - x;
  const tg = Math.min(0.88, Math.max(0.4, 0.3 + d / 1300));
  const w = Math.max(0.05, 0.15 - d / 9000);
  return { tg, w, three: d > 520 };
}
export const BOWL = { LANE_W: 300, PIN_R: 14, BALL_R: 20, ROLL_T: 1.6, AIM_T: 8, POWER_T: 4 } as const;
/** Pin positions (x across the lane, y down it: larger y = closer to the foul line). Triangle with the head pin nearest. */
export const PINS: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++) out.push({ x: (i - row / 2) * 46, y: 120 - row * 40 });
  return out;
})();

// ---- arena games (tank, wizard, survival, defense, tag) ----
export const ARENA = { W: 1200, H: 700 } as const;
export interface Rect { x: number; y: number; w: number; h: number }
export const TANK_WALLS: Rect[] = [
  { x: 300, y: 190, w: 36, h: 320 }, { x: 864, y: 190, w: 36, h: 320 }, { x: 540, y: 80, w: 120, h: 36 }, { x: 540, y: 584, w: 120, h: 36 }, { x: 560, y: 325, w: 80, h: 50 },
];
/** Pushes a circle out of a rectangle. Returns true when it touched. */
export function circRect(b: { x: number; y: number }, r: number, w: Rect): boolean {
  const cx = Math.max(w.x, Math.min(b.x, w.x + w.w)), cy = Math.max(w.y, Math.min(b.y, w.y + w.h));
  const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
  if (d >= r) return false;
  if (d < 1e-6) { b.x = w.x - r; return true; }
  b.x = cx + (dx / d) * r; b.y = cy + (dy / d) * r;
  return true;
}
