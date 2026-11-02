// The shared game API. A game is a server-side module that owns the rules and the
// simulation (the server is authoritative), plus a client renderer that only draws
// snapshots. Lobby, accounts, networking and scoring are provided by the platform.

export interface GamePlayer {
  id: string;
  name: string;
  color: string;
  avatar: number;
}

export interface PlayerInput {
  x: number; // joystick -1..1 (right = +)
  y: number; // joystick -1..1 (down = +)
  b: number; // held buttons bitmask (BTN.A | BTN.B ...)
}

export interface GameContext {
  /** Participants fixed at game start. */
  readonly players: readonly GamePlayer[];
  /** Validated option values for this game (see GameMeta.options). */
  readonly options: Readonly<Record<string, number>>;
  /** Deterministic random generator (seeded per match). */
  rand(): number;
  /** Latest controller state (zeroed while disconnected). */
  input(playerId: string): PlayerInput;
  connected(playerId: string): boolean;
  /** Estimated round-trip time (ms) of a phone / of the host screen. */
  rtt(playerId: string): number;
  hostRtt(): number;
  /** Server clock (ms). */
  now(): number;
  /** Small per-player text/number HUD shown on that player's phone. */
  hud(playerId: string, h: Record<string, string | number>): void;
  /** Vibrate a phone (if the browser supports it). */
  buzz(playerId: string, ms: number): void;
  /** Fire a visual/sound event on the screen (delivered with the next frame). */
  fx(kind: string, data?: Record<string, unknown>): void;
}

export interface StandingRow {
  playerId: string;
  score: number; // shown in results
  detail?: string;
  /** Rows with the same `tie` value as the previous row share its place. Defaults to unique. */
  tie?: number;
}

export interface GameInstance {
  /** Fixed-step update; dt in seconds (1/30). Not called during countdown or pause. */
  tick(dt: number): void;
  /** Rising edge of a controller button (bit from BTN). `at` = server arrival time ms. */
  onPress?(playerId: string, button: number, at: number): void;
  /** Discrete choice tap (choices layout). */
  onTap?(playerId: string, value: number, at: number): void;
  /** Serializable state sent to screens ~30 times per second. Keep it small. */
  snapshot(): unknown;
  isOver(): boolean;
  /** Current ranking, best first. Called when the game ends (or is ended early). */
  standings(): StandingRow[];
}

export interface GameModule {
  id: string; // must match the catalog id in shared/catalog.ts
  create(ctx: GameContext): GameInstance;
}
