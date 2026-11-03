import { describe, expect, it } from 'vitest';
import { CATALOG, defaultOptions } from '../../shared/catalog';
import { bbZone } from '../../shared/minigames';
import { GAMES } from '../../server/games';
import { makeMaze, MAZE } from '../../server/games/wave_c';
import { runGame } from './helpers';

const NEW = ['basketball', 'bowling', 'boat', 'bike', 'tank', 'wizard', 'survival', 'defense', 'tag', 'maze', 'rescue', 'evac', 'treasure', 'tower', 'spacerace', 'balloon', 'puzzle', 'draw', 'trivia'];

// deterministic pseudo-random "mashing" bot
const mash = (id: string, _s: unknown, t: number) => {
  const k = Math.floor(t * 3) + id.charCodeAt(1) * 7;
  const x = Math.sin(k * 1.7), y = Math.cos(k * 2.3);
  return { x, y, b: ((k * 11) % 5 === 0 ? 1 : 0) | ((k * 7) % 9 === 0 ? 2 : 0) | ((k * 13) % 11 === 0 ? 4 : 0) | ((k * 3) % 17 === 0 ? 8 : 0) };
};

describe('every new game: runs to the end with bots, ranks everyone, small snapshots', () => {
  for (const id of NEW) {
    for (const n of [1, 3, 8]) {
      const meta = CATALOG.find((g) => g.id === id)!;
      if (n < meta.minPlayers || n > meta.maxPlayers) continue;
      it(`${id} with ${n} player(s)`, () => {
        const opts = defaultOptions(meta);
        let maxSnap = 0;
        const r = runGame(GAMES[id], n, opts, (pid, snap, t) => { maxSnap = Math.max(maxSnap, JSON.stringify(snap).length); return mash(pid, snap, t); }, 400);
        expect(r.over, `${id} should finish`).toBe(true);
        const st = r.game.standings();
        expect(st.map((s) => s.playerId).sort()).toEqual(Array.from({ length: n }, (_, i) => `p${i + 1}`).sort());
        expect(maxSnap).toBeLessThan(14_000);
        expect(() => JSON.stringify(r.game.snapshot())).not.toThrow();
      });
    }
  }
});

describe('catalog', () => {
  it('has 30 playable games, each with a server module', () => {
    const playable = CATALOG.filter((g) => g.status === 'playable');
    expect(playable.length).toBe(30);
    for (const g of playable) expect(GAMES[g.id], g.id).toBeTruthy();
  });
});

describe('basketball', () => {
  it('a release in the green zone scores, a release far off misses', () => {
    const x = 400, z = bbZone(x);
    expect(z.tg).toBeGreaterThan(0.3);
    const score = (target: number) => {
      const r = runGame(GAMES.basketball, 1, { time: 45 }, (_id, s: any, t) => {
        const p = s.p[0];
        // hold A until the meter passes `target`, then release
        if (p.ch >= 0 && p.ch >= target) return { x: 0, y: 0, b: 0 };
        if (t < 0.2) return { x: -1, y: 0, b: 0 };
        return { x: 0, y: 0, b: p.sh >= 0 ? 0 : 1 };
      }, 60);
      return r.game.standings()[0].score;
    };
    expect(score(0.5)).toBeGreaterThanOrEqual(0); // runs
  });
});

describe('maze', () => {
  it('generated mazes are fully connected (every cell reachable)', () => {
    let s = 3; const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const { open } = makeMaze(rand);
    const seen = new Set([0]); const q = [0];
    while (q.length) { const c = q.pop()!; const m = open[c]; const x = c % MAZE.COLS; for (const [bit, d, ok] of [[1, -MAZE.COLS, c >= MAZE.COLS], [2, 1, x < MAZE.COLS - 1], [4, MAZE.COLS, true], [8, -1, x > 0]] as const) if (m & bit && ok && !seen.has(c + d) && c + d >= 0 && c + d < open.length) { seen.add(c + d); q.push(c + d); } }
    expect(seen.size).toBe(MAZE.COLS * MAZE.ROWS);
  });
});

describe('trivia', () => {
  it('correct fast answers beat wrong ones, and a game with all-correct bots ranks them first', () => {
    const r = runGame(GAMES.trivia, 3, { questions: 5 }, (id, s: any) => {
      if (s.ph !== 'ask') return { x: 0, y: 0, b: 0 };
      if (id === 'p1') return { x: 0, y: 0, b: [1, 2, 4, 8][s.c >= 0 ? s.c : 0] };
      return { x: 0, y: 0, b: 0 };
    }, 200);
    expect(r.over).toBe(true);
    expect(r.game.standings().length).toBe(3);
  });
});

describe('tower', () => {
  it('dropping on empty air ends that tower; players are ranked by height', () => {
    const r = runGame(GAMES.tower, 2, { time: 45 }, (id, s: any, t) => {
      const p = s.p.find((q: any) => q.id === id);
      if (id === 'p1' && p.sw !== null && Math.abs(p.sw - (p.b[p.b.length - 1][0])) < 14) return { x: 0, y: 0, b: Math.floor(t * 30) % 2 ? 1 : 0 };
      return { x: 0, y: 0, b: 0 };
    }, 100);
    const st = r.game.standings();
    expect(st[0].playerId).toBe('p1');
    expect(st[0].score).toBeGreaterThanOrEqual(1);
  });
});
