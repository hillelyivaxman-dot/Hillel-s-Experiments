import { describe, expect, it } from 'vitest';
import { TRAPS } from '../../shared/traps';
import { BTN } from '../../shared/protocol';
import { trapBuildersGame } from '../../server/games/trapbuilders';
import { runGame } from './helpers';

const idle = () => ({ x: 0, y: 0, b: 0 });

describe('trap builders', () => {
  it('building: the cursor moves with the stick, B cycles the trap type, A places; traps obey spacing and the 2-per-player limit', () => {
    let step = 0;
    const r = runGame(trapBuildersGame, 2, { rounds: 1 }, (id, s, t) => {
      if (s.ph !== 'build' || id !== 'p1') return idle();
      step++;
      // 1: place spikes at the default cursor, 2: same place again (too close), 3: move on + next type + place (pit), 4: third attempt (limit)
      if (step === 2) return { x: 0, y: 0, b: BTN.A };
      if (step === 6) return { x: 0, y: 0, b: BTN.A };
      if (step === 10) return { x: 0, y: 0, b: BTN.B };
      if (step > 12 && step < 30) return { x: -1, y: 0, b: 0 };
      if (step === 40) return { x: 0, y: 0, b: BTN.A };
      if (step === 46) return { x: 0, y: 0, b: BTN.A };
      void t;
      return idle();
    }, 8);
    expect(r.fx.filter((k) => k === 'place')).toHaveLength(2);
    expect(r.fx).toContain('nope'); // the too-close attempt and the over-limit attempt
    expect(r.fx.filter((k) => k === 'nope').length).toBeGreaterThanOrEqual(2);
    const snap = r.game.snapshot() as any;
    const placed = snap.tr as [number, number, string][];
    expect(placed).toHaveLength(2);
    expect(placed[0][1]).toBe(0); // spikes first
    expect(placed[1][1]).toBe(1); // after B: saw
    for (const [x] of placed) { expect(x).toBeGreaterThan(TRAPS.START_SAFE); expect(x).toBeLessThan(TRAPS.FINISH); }
    expect(Math.abs(placed[0][0] - placed[1][0])).toBeGreaterThanOrEqual(TRAPS.MIN_GAP);
  });

  it('a runner that walks into a trap is sent back, and the trap\'s builder is paid a point', () => {
    const r = runGame(trapBuildersGame, 2, { rounds: 1 }, (id, s, t) => {
      if (s.ph === 'build') return id === 'p1' && Math.round(t * 30) === 3 ? { x: 0, y: 0, b: BTN.A } : idle(); // p1 places spikes at 1200
      if (s.ph === 'run') return id === 'p2' ? { x: 1, y: 0, b: 0 } : idle(); // p2 runs, never jumps
      return idle();
    }, 120);
    expect(r.fx).toContain('place');
    expect(r.fx).toContain('hit');
    expect(r.fx).toContain('score');
    expect(r.over).toBe(true);
    const st = r.game.standings();
    const p1 = st.find((x) => x.playerId === 'p1')!;
    expect(p1.score).toBeGreaterThanOrEqual(1); // paid for the victim (p2 may still finish: respawn protection lets runners pass the trap)
  });

  it('a pit takes the ground away: running into it drops you and you respawn before it', () => {
    let n = 0;
    const r = runGame(trapBuildersGame, 2, { rounds: 1 }, (id, s) => {
      if (s.ph === 'build') {
        if (id !== 'p1') return idle();
        n++;
        return n === 3 || n === 6 ? { x: 0, y: 0, b: BTN.B } : n === 10 ? { x: 0, y: 0, b: BTN.A } : idle(); // B, B -> pit, then place
      }
      return id === 'p2' && s.ph === 'run' ? { x: 1, y: 0, b: 0 } : idle();
    }, 100);
    const kinds = ((r.game.snapshot() as any).tr as any[]).map((t) => t[1]);
    expect(kinds).toEqual([2]); // one pit
    expect(r.fx).toContain('hit');
    expect(r.fx).toContain('score'); // the pit's builder is paid
  });

  it('players who jump over spikes finish and are paid by finishing place; the game plays all rounds and ends', () => {
    const holding = new Map<string, boolean>(), lastG = new Map<string, boolean>();
    const r = runGame(trapBuildersGame, 2, { rounds: 2 }, (id, s, t) => {
      if (s.ph === 'build') return id === 'p1' && s.tr.length === 0 && Math.round(t * 30) % 20 === 3 ? { x: 0, y: 0, b: BTN.A } : idle();
      if (s.ph !== 'run') return idle();
      const me = s.p.find((p: any) => p.id === id);
      const near = (s.tr as [number, number, string][]).some(([x, k]) => x - me.x > -10 && x - me.x < 130 && k === 0);
      if (me.g) holding.set(id, lastG.get(id) === false ? false : near);
      lastG.set(id, !!me.g);
      return { x: 1, y: 0, b: holding.get(id) ? BTN.A : 0 };
    }, 400);
    expect(r.over).toBe(true);
    expect(r.fx.filter((k) => k === 'roundEnd')).toHaveLength(2);
    expect(r.fx).toContain('finish');
    const st = r.game.standings();
    expect(st).toHaveLength(2);
    expect(st[0].score).toBeGreaterThanOrEqual(5); // at least one finishing bonus
  });

  it('an idle table still plays out: build time runs down, the run times out, scores are shown, the game ends', () => {
    const r = runGame(trapBuildersGame, 3, { rounds: 2 }, idle, 400);
    expect(r.over).toBe(true);
    expect(r.game.standings()).toHaveLength(3);
  });
});
