// FAMILY BOARD PARTY board: a rectangular loop of 26 tiles, laid out deterministically from a seed so the
// server (rules) and the screen (drawing) agree. Only the star location changes during the game.
export type TileKind = 'start' | 'coin3' | 'coin5' | 'trap' | 'chance' | 'power' | 'duel';
export const BOARD = { COLS: 9, ROWS: 6, TILES: 26, STAR_COST: 10 } as const;

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

/** Tile kinds in walking order (index 0 = start/home). */
export function makeBoard(seed: number): TileKind[] {
  const r = rng(seed);
  const pool: TileKind[] = [
    ...Array(8).fill('coin3'), ...Array(3).fill('coin5'), ...Array(4).fill('trap'),
    ...Array(5).fill('chance'), ...Array(3).fill('power'), ...Array(2).fill('duel'),
  ] as TileKind[];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return ['start', ...pool];
}

/** Grid cell (col,row) of tile i, walking clockwise along the border starting at the top-left corner. */
export function tileCell(i: number): { c: number; r: number } {
  const { COLS, ROWS } = BOARD;
  const top = COLS, right = ROWS - 1, bottom = COLS - 1;
  if (i < top) return { c: i, r: 0 };
  i -= top;
  if (i < right) return { c: COLS - 1, r: 1 + i };
  i -= right;
  if (i < bottom) return { c: COLS - 2 - i, r: ROWS - 1 };
  i -= bottom;
  return { c: 0, r: ROWS - 2 - i };
}
