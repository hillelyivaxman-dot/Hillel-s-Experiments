// Owner "chaos" powers that act on a single player inside a running game. Games opt in with `power()`; the room decides who may
// use them (verified owner, chaos mode switched on and visible to everybody, never in a tournament).
export const PLAYER_POWERS = ['speed', 'jump', 'giant', 'tiny', 'teleport', 'invisible', 'swap'] as const;
export type PlayerPower = (typeof PLAYER_POWERS)[number];
type Timed = 'speed' | 'jump' | 'giant' | 'tiny' | 'invisible';

/** Timed modifiers per player. Games multiply their own numbers by these (speed, size, jump) and report `extras` in snapshots. */
export class Mods {
  private m = new Map<string, Partial<Record<Timed, number>>>();
  add(id: string, kind: Timed, secs: number) {
    const e = this.m.get(id) ?? {}; e[kind] = secs;
    if (kind === 'giant') delete e.tiny; if (kind === 'tiny') delete e.giant;
    this.m.set(id, e);
  }
  tick(dt: number) { for (const [id, e] of this.m) { for (const k of Object.keys(e) as Timed[]) { e[k]! -= dt; if (e[k]! <= 0) delete e[k]; } if (!Object.keys(e).length) this.m.delete(id); } }
  speed(id: string) { return this.m.get(id)?.speed ? 1.8 : 1; }
  jump(id: string) { return this.m.get(id)?.jump ? 1.9 : 1; }
  size(id: string) { const e = this.m.get(id); return e?.giant ? 1.7 : e?.tiny ? 0.55 : 1; }
  invisible(id: string) { return !!this.m.get(id)?.invisible; }
  /** Snapshot fields (omitted when normal, to keep frames small). */
  extras(id: string): { sz?: number; iv?: 1 } { const o: { sz?: number; iv?: 1 } = {}; const s = this.size(id); if (s !== 1) o.sz = s; if (this.invisible(id)) o.iv = 1; return o; }
}
