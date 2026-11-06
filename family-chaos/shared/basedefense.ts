// BASE DEFENSE constants shared by server (rules) and screen (drawing).
export const BD = {
  W: 1600, H: 900,
  CORE_X: 800, CORE_Y: 450, CORE_R: 62, CORE_HP: 160,
  PLAYER_R: 22, SPEED: 235, SPRINT: 1.7,
  TURRET_COST: 25, MAX_TURRETS: 6, TURRET_RANGE: 300,
  UP_BASE: 40, UP_STEP: 30, UP_MAX: 5,
  BREAK: 7,
} as const;
export type Role = 0 | 1 | 2 | 3;
export const ROLES: { name: { he: string; en: string }; act: { he: string; en: string }; color: string }[] = [
  { name: { he: 'צלף', en: 'Gunner' }, act: { he: 'התפרצות', en: 'BURST' }, color: '#ffd23f' },
  { name: { he: 'בנאי', en: 'Builder' }, act: { he: 'צריח', en: 'TURRET' }, color: '#3ec1ff' },
  { name: { he: 'טנק', en: 'Tank' }, act: { he: 'הדף', en: 'SHOCK' }, color: '#ff4d6d' },
  { name: { he: 'חובש', en: 'Medic' }, act: { he: 'ריפוי', en: 'HEAL' }, color: '#5dfc8d' },
];
export const KINDS = [
  { name: 'runner', hp: 2, speed: 125, r: 15, dps: 5, scrap: 2, color: '#ffb84a' },
  { name: 'grunt', hp: 6, speed: 72, r: 20, dps: 8, scrap: 4, color: '#8bd450' },
  { name: 'brute', hp: 30, speed: 46, r: 34, dps: 20, scrap: 14, color: '#c77dff' },
] as const;
/** Enemies of wave n (1-based) for `players` defenders, as a list of kind indexes. Deterministic composition, the order is shuffled by the server. */
export function waveList(n: number, players: number): number[] {
  const k = 0.65 + 0.18 * Math.min(8, players);
  const runners = Math.round((4 + n * 2) * k), grunts = Math.round(Math.max(0, n - 1) * 2.4 * k), brutes = n >= 3 ? Math.round(((n - 2) / 2) * k + (n % 5 === 0 ? 1 : 0)) : 0;
  return [...Array(runners).fill(0), ...Array(grunts).fill(1), ...Array(brutes).fill(2)];
}
