// Wire protocol shared by server, host screen and phone controllers.
// All messages are small JSON objects with a `t` (type) field.

export type Lang = 'he' | 'en';
export type RoomPhase = 'lobby' | 'countdown' | 'playing' | 'paused' | 'results';

/** Button bitmask positions used on the wire (input.b). */
export const BTN = { A: 1, B: 2, C: 4, D: 8, M: 16 } as const; // M = "manual gas" flag (racing: GAS only while A is held)
export type ButtonKey = keyof typeof BTN;

export interface PlayerInfo {
  id: string;
  name: string;
  avatar: number; // critter variant index
  color: string;
  connected: boolean;
  ready: boolean;
  stars: number; // total stars earned in this room session
  rtt?: number; // phone round-trip time in ms (for the owner's connection alerts)
}

export interface ResultRow {
  playerId: string;
  place: number; // 1-based
  score: number; // game-specific score (shown)
  stars: number; // stars awarded for this game
  detail?: string;
}

/** Party tournament (in-memory, per room): a series of games with points per place; the next game starts by itself. */
export interface TourState {
  mode: 'party' | 'knockout'; // knockout: the last place of every game is out until one player is left
  alive: string[]; // knockout: players still in
  total: number;
  idx: number; // index of the current (or just finished) game
  games: string[];
  points: Record<string, number>; // playerId -> tournament points
  nextAt: number | null; // server epoch ms when the next game starts (only while in results)
  held: boolean; // organiser paused the series: the next game waits until resumed or skipped
  done: boolean;
  champion: string | null;
}

export interface RoomState {
  code: string;
  phase: RoomPhase;
  players: PlayerInfo[];
  leaderId: string | null;
  selectedGame: string;
  gameId: string | null; // game currently running (countdown/playing/paused/results)
  inGame: string[]; // participant ids of the current/last match
  options: Record<string, number>; // options for selected game
  maxPlayers: number;
  hasPassword: boolean;
  countdownEndsAt: number | null; // server epoch ms
  results: ResultRow[] | null;
  hostConnected: boolean;
  tour: TourState | null;
}

export type AdminAction =
  | { a: 'select'; game: string }
  | { a: 'option'; key: string; value: number }
  | { a: 'start' }
  | { a: 'pause' }
  | { a: 'resume' }
  | { a: 'end' }
  | { a: 'lobby' }
  | { a: 'again' }
  | { a: 'tournament'; count?: number; games?: string[]; mode?: 'party' | 'knockout' }
  | { a: 'tour_skip' }
  | { a: 'tour_hold'; hold: boolean }
  | { a: 'tour_cancel' }
  | { a: 'kick'; playerId: string }
  | { a: 'leader'; playerId: string }
  | { a: 'room'; maxPlayers?: number; password?: string | null };

// ---------- client -> server ----------
export type C2S =
  | { t: 'host_create'; maxPlayers?: number; password?: string }
  | { t: 'host_resume'; code: string; hostKey: string }
  | { t: 'watch'; code: string; password?: string }
  | { t: 'join'; code: string; name: string; avatar: number; password?: string; token?: string }
  | { t: 'input'; s: number; x: number; y: number; b: number }
  | { t: 'tap'; id: number; v: number } // discrete choice (trivia / menus), deduped by id
  | { t: 'ready'; v: boolean }
  | { t: 'profile'; name?: string; avatar?: number }
  | { t: 'admin'; act: AdminAction }
  | { t: 'report'; playerId: string }
  | { t: 'leave' }
  | { t: 'god'; power: string; target?: string } // owner crown powers (verified server-side)
  | { t: 'ping'; c: number; rtt?: number };

// ---------- server -> client ----------
export type S2C =
  | { t: 'hosted'; code: string; hostKey: string }
  | { t: 'watching'; code: string }
  | { t: 'joined'; code: string; playerId: string; token: string }
  | { t: 'room'; room: RoomState }
  | { t: 'frame'; g: string; n: number; f: unknown }
  | { t: 'hud'; h: Record<string, string | number> } // per-player HUD on phone
  | { t: 'buzz'; ms: number }
  | { t: 'kicked' }
  | { t: 'error'; code: ErrorCode; msg?: string }
  | { t: 'owner'; v: boolean } // this socket belongs to the verified site owner
  | { t: 'pong'; c: number; s: number };

export type ErrorCode =
  | 'competitive'
  | 'no_room'
  | 'bad_password'
  | 'room_full'
  | 'bad_name'
  | 'in_game'
  | 'not_allowed'
  | 'rate_limited'
  | 'bad_message'
  | 'too_many_rooms';

export const NAME_MAX = 14;
export const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ'; // no vowels -> no accidental words
export const CODE_LEN = 4;

export const PLAYER_COLORS = [
  '#ff4d6d', '#3ec1ff', '#ffd23f', '#5dfc8d', '#b26bff', '#ff8c42', '#2ef2e0', '#ff6bd6',
  '#a3e635', '#f97316', '#60a5fa', '#f472b6',
];
export const AVATAR_COUNT = 12;

/** The crown ("GOD ADMIN") powers. Executed by the server, only for the verified OWNER and only outside tournaments. */
export const GOD_POWERS = ['confetti', 'quake', 'flash', 'announce', 'freeze', 'slowmo', 'turbo', 'mirror', 'bonus', 'steal', 'leader', 'end'] as const;
export type GodPower = (typeof GOD_POWERS)[number];
