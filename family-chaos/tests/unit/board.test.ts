import { describe, expect, it } from 'vitest';
import { BOARD, makeBoard, tileCell } from '../../shared/board';
import { BTN } from '../../shared/protocol';
import { boardGame } from '../../server/games/board';
import { runGame } from './helpers';

const tapper = (who: string[]) => (id: string, s: any, t: number) => {
  const press = Math.floor(t * 30) % 2 === 0;
  if (s.ph === 'mini' || s.ph === 'duel') return { x: 0, y: 0, b: who.includes(id) && press ? BTN.A : 0 };
  if (s.turn === id && (s.ph === 'roll' || s.ph === 'buy')) return { x: 0, y: 0, b: press ? BTN.A : 0 };
  return { x: 0, y: 0, b: 0 };
};

describe('family board party', () => {
  it('the board layout is deterministic, has one start tile and a mix of tiles', () => {
    const a = makeBoard(7), b = makeBoard(7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(BOARD.TILES);
    expect(a[0]).toBe('start');
    expect(new Set(a).size).toBeGreaterThanOrEqual(6);
    const cells = a.map((_, i) => tileCell(i));
    expect(new Set(cells.map((c) => `${c.c},${c.r}`)).size).toBe(BOARD.TILES); // every tile has its own cell
  });

  it('an idle table still finishes: turns time out and roll automatically', () => {
    const r = runGame(boardGame, 3, { rounds: 2 }, () => ({ x: 0, y: 0, b: 0 }), 900);
    expect(r.over).toBe(true);
    expect(r.game.standings()).toHaveLength(3);
    for (const p of (r.game.snapshot() as any).p) { expect(p.c).toBeGreaterThanOrEqual(0); expect(p.pos).toBeLessThan(BOARD.TILES); }
    expect(r.fx.filter((k) => k === 'roll').length).toBeGreaterThanOrEqual(6); // 3 players x 2 rounds
  });

  it('rolling moves a token by exactly the dice total (wrapping around the loop)', () => {
    let before: any = null, checked = 0, bad = '';
    runGame(boardGame, 2, { rounds: 3 }, (id, s, t) => {
      if (s.ph === 'roll' && s.turn === id && !before) before = { id, pos: s.p.find((p: any) => p.id === id).pos, total: 0 };
      if (before && s.dice.length && !before.total) before.total = s.dice.reduce((a: number, b: number) => a + b, 0);
      if (before && before.total && s.ph !== 'move' && s.ph !== 'roll' && s.ph !== 'buy') {
        // after the move the token is dice-total tiles ahead, unless a chance tile moved it again
        const now = s.p.find((p: any) => p.id === before.id).pos;
        const moved = (now - before.pos + BOARD.TILES) % BOARD.TILES;
        if (moved !== before.total % BOARD.TILES && s.msg?.k !== 'chance') bad += ` ${moved}!=${before.total}`;
        checked++; before = null;
      }
      return tapper(['p1', 'p2'])(id, s, t);
    }, 900);
    expect(checked).toBeGreaterThanOrEqual(4);
    expect(bad).toBe('');
  });

  it('stars cost 10 coins, are bought on the star tile, and the star moves afterwards; coins never go negative', () => {
    let stars = 0, starMoves = 0, lastStar = -1, minCoins = 99;
    const r = runGame(boardGame, 3, { rounds: 10 }, (id, s, t) => {
      if (lastStar !== -1 && s.star !== lastStar) starMoves++;
      lastStar = s.star;
      for (const p of s.p) minCoins = Math.min(minCoins, p.c);
      return tapper(['p1', 'p2', 'p3'])(id, s, t);
    }, 3000);
    stars = (r.game.snapshot() as any).p.reduce((a: number, p: any) => a + p.s, 0);
    expect(r.over).toBe(true);
    expect(minCoins).toBeGreaterThanOrEqual(0);
    expect(stars).toBeGreaterThanOrEqual(1);
    expect(starMoves).toBeGreaterThanOrEqual(stars);
    expect(r.fx).toContain('star');
  });

  it('the end-of-round tap race pays the fastest tapper the biggest prize', () => {
    let prize: any = null;
    runGame(boardGame, 3, { rounds: 1 }, (id, s, t) => {
      if (s.ph === 'result' && s.res && !prize && s.msg?.k === 'miniResult') prize = s.res;
      return tapper(['p1'])(id, s, t); // only p1 taps in the minigame
    }, 900);
    expect(prize).not.toBeNull();
    expect(prize[0]).toMatchObject({ id: 'p1', prize: 5 });
    expect(prize.slice(1).every((x: any) => x.prize === 0)).toBe(true);
  });

  it('final standings rank by stars, then coins', () => {
    const r = runGame(boardGame, 4, { rounds: 4 }, tapper(['p1', 'p2', 'p3', 'p4']), 3000);
    const st = r.game.standings();
    for (let i = 1; i < st.length; i++) expect((st[i - 1].tie ?? 0) >= (st[i].tie ?? 0)).toBe(true);
  });
});
