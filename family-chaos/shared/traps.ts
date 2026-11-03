// TRAP BUILDERS shared constants (course geometry and trap kinds).
export type TrapKind = 'spikes' | 'saw' | 'pit';
export const TRAP_KINDS: TrapKind[] = ['spikes', 'saw', 'pit'];
export const TRAPS = {
  GROUND: 520, START_SAFE: 420, LENGTH: 3400, FINISH: 3150, MIN_GAP: 170, PIT_W: 175, SPIKE_W: 80, SAW_R: 26,
  PER_PLAYER: 2, BUILD_TIME: 28, RUN_TIME: 55, GRACE: 18,
} as const;
export const sawYAt = (x: number, t: number) => TRAPS.GROUND - 70 - 55 * (0.5 + 0.5 * Math.sin(t * 2.6 + x * 0.013));
