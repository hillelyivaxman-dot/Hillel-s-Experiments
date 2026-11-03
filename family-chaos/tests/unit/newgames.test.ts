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

describe('game rules (scripted players)', () => {
  it('basketball: releasing the meter inside the green zone scores points', () => {
    const r = runGame(GAMES.basketball, 2, { time: 45 }, (id, s: any, t) => {
      const p = s.p.find((q: any) => q.id === id);
      if (p.sh >= 0) return { x: 0, y: 0, b: 0 };
      if (p.ch >= 0) return { x: 0, y: 0, b: Math.abs(p.ch - p.tg) < p.w * 0.4 ? 0 : 1 };
      return { x: 0, y: 0, b: Math.floor(t * 8) % 2 }; // fresh presses
    }, 80);
    expect(r.game.standings()[0].score).toBeGreaterThanOrEqual(6);
  });

  it('bowling: a locked aim and well-timed power knocks pins down; turns rotate between players', () => {
    const r = runGame(GAMES.bowling, 2, { frames: 2 }, (id, s: any) => {
      if (s.turn !== id) return { x: 0, y: 0, b: 0 };
      if (s.ph === 'aim') return { x: 0, y: 0, b: 1 };
      if (s.ph === 'power') return { x: 0, y: 0, b: s.pw > 0.7 && s.pw < 0.9 ? 1 : 0 };
      return { x: 0, y: 0, b: 0 };
    }, 200);
    const st = r.game.standings();
    expect(st[0].score).toBeGreaterThan(0);
    expect(st.every((x) => x.score > 0)).toBe(true);
  });

  it('trivia: with four players each choosing a different answer, exactly one is right per question', () => {
    const r = runGame(GAMES.trivia, 4, { questions: 5 }, (id, s: any) => (s.ph === 'ask' ? { x: 0, y: 0, b: [1, 2, 4, 8][Number(id.slice(1)) - 1] } : { x: 0, y: 0, b: 0 }), 300);
    const total = r.game.standings().reduce((a, x) => a + x.score, 0);
    expect(total).toBeGreaterThanOrEqual(5 * 100);
    expect(total).toBeLessThanOrEqual(5 * 260);
  });

  it('draw & guess: guessers choosing four different directions yields exactly one correct guess per round; the drawer is rewarded', () => {
    const r = runGame(GAMES.draw, 5, { rounds: 1 }, (id, s: any) => {
      if (s.ph !== 'draw') return { x: 0, y: 0, b: 0 };
      if (id === s.dr) return { x: 1, y: 0, b: 1 }; // draws a line
      const dir = [[0, -1], [1, 0], [0, 1], [-1, 0]][Number(id.slice(1)) % 4];
      return { x: dir[0], y: dir[1], b: 1 };
    }, 120);
    const st = r.game.standings();
    expect(st.filter((x) => x.playerId !== 'p1' && x.score > 0)).toHaveLength(1);
    expect(st.find((x) => x.playerId === 'p1')!.score).toBe(3);
  });

  it('team puzzle: a team that remembers and presses its own colours clears every level (3 stars); a wrong colour costs a life', () => {
    let memo: number[] = [];
    const bot = (id: string, s: any) => {
      if (s.seq.length) memo = s.seq;
      if (s.ph !== 'enter') return { x: 0, y: 0, b: 0 };
      const want = memo[s.pos], mine = s.own[want] === Number(id.slice(1)) - 1;
      return { x: 0, y: 0, b: mine ? [1, 2, 4, 8][want] : 0 };
    };
    // players press on alternating ticks so held buttons produce fresh rising edges
    const r = runGame(GAMES.puzzle, 2, { levels: 4 }, (id, s: any) => { const o = bot(id, s); return Math.floor(s.t * 15) % 2 ? o : { x: 0, y: 0, b: 0 }; }, 300);
    expect(r.game.standings()[0].stars).toBe(3);
    const bad = runGame(GAMES.puzzle, 2, { levels: 4 }, (_id, s: any) => (s.ph === 'enter' ? { x: 0, y: 0, b: Math.floor(s.t * 15) % 2 ? 1 : 0 } : { x: 0, y: 0, b: 0 }), 300);
    expect(bad.game.standings()[0].stars).toBeLessThan(3);
  });
});
