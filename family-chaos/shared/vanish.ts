// VANISHING FLOOR constants shared by server (rules) and screen (drawing).
export const VANISH = { COLS: 9, ROWS: 6, TILE: 130, PLAYER_R: 26, CRACK: 1.1, STAND: 0.55, JUMP_T: 0.55, JUMP_CD: 1.4, DASH_CD: 3 } as const;
export const tileIndex = (x: number, y: number): number => {
  const c = Math.floor(x / VANISH.TILE), r = Math.floor(y / VANISH.TILE);
  return c < 0 || r < 0 || c >= VANISH.COLS || r >= VANISH.ROWS ? -1 : r * VANISH.COLS + c;
};
