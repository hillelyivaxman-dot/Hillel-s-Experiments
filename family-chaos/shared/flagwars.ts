// FLAG WARS map + constants, shared by the server (rules) and the screen (drawing). World 1600 x 900, mirrored left/right.
export const FW = {
  W: 1600, H: 900, MID: 800, R: 22, SPEED: 245, SPRINT: 1.45, CARRY: 0.88, TACKLE_CD: 1.6, JUMP_T: 0.55, JUMP_CD: 0.5,
  FLAG_RETURN: 10, OUT_T: 2.6, WIN_SCORE: 5,
} as const;
export interface Wall { x: number; y: number; w: number; h: number; low?: boolean }
export interface Mud { x: number; y: number; r: number }

const left: Wall[] = [
  { x: 360, y: 200, w: 40, h: 170 }, { x: 360, y: 530, w: 40, h: 170 },
  { x: 600, y: 90, w: 40, h: 160 }, { x: 600, y: 650, w: 40, h: 160 },
  { x: 500, y: 396, w: 90, h: 24, low: true }, { x: 500, y: 480, w: 90, h: 24, low: true },
  { x: 560, y: 260, w: 24, h: 110, low: true }, { x: 560, y: 530, w: 24, h: 110, low: true },
];
const mirror = (w: Wall): Wall => ({ ...w, x: FW.W - w.x - w.w });
export const WALLS: Wall[] = [
  ...left, ...left.map(mirror),
  { x: 720, y: 380, w: 160, h: 140 }, // the middle block: go over (low parts at the sides) or around
  { x: 700, y: 250, w: 200, h: 22, low: true }, { x: 700, y: 628, w: 200, h: 22, low: true },
];
const mudL: Mud[] = [{ x: 400, y: 450, r: 56 }, { x: 700, y: 150, r: 70 }, { x: 700, y: 750, r: 70 }];
export const MUD: Mud[] = [...mudL, { x: FW.W - 400, y: 450, r: 56 }, { x: FW.W - 700, y: 150, r: 70 }, { x: FW.W - 700, y: 750, r: 70 }];
export const BASES = [
  { x: 40, y: 320, w: 190, h: 260, fx: 135, fy: 450 }, // team 0 (red)
  { x: FW.W - 230, y: 320, w: 190, h: 260, fx: FW.W - 135, fy: 450 }, // team 1 (blue)
] as const;
export const SPAWNS: [number, number][][] = [
  [[110, 380], [110, 520], [180, 450], [70, 450]],
  [[FW.W - 110, 380], [FW.W - 110, 520], [FW.W - 180, 450], [FW.W - 70, 450]],
];
export const TEAM_NAMES = [{ he: 'האדומים', en: 'Red' }, { he: 'הכחולים', en: 'Blue' }];
export const TEAM_COLORS = ['#ff4d6d', '#3ec1ff'];
export const ROLES = ['runner', 'guard', 'support'] as const; // dash / freeze pulse / shield aura

export function circRect(b: { x: number; y: number }, r: number, w: Wall): boolean {
  const cx = Math.max(w.x, Math.min(b.x, w.x + w.w)), cy = Math.max(w.y, Math.min(b.y, w.y + w.h));
  const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
  if (d >= r) return false;
  if (d < 1e-6) { b.x = w.x - r; return true; }
  b.x = cx + (dx / d) * r; b.y = cy + (dy / d) * r;
  return true;
}
export const inMud = (x: number, y: number) => MUD.some((m) => Math.hypot(x - m.x, y - m.y) < m.r);
export const inBase = (team: number, x: number, y: number) => { const b = BASES[team]; return x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h; };
