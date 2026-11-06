import { describe, expect, it } from 'vitest';
import { rushGame, RUSHC } from '../../server/games/rush';
import { runGame } from './helpers';

// Chaos Rush pressure rule: the screen only moves forward; whoever stays behind its left edge gets a countdown and is out.
describe('chaos rush: left behind = out', () => {
  it('a player who just stands there is warned, then eliminated, while the runner keeps going and is ranked first', () => {
    let warned = 0, outAt = -1, runnerX = 0;
    const res = runGame(rushGame, 2, { len: 12 }, (id, snap, t) => {
      const me = snap.p.find((q: any) => q.id === id);
      if (id === 'p2') { if (me.w) warned = Math.max(warned, me.w); if (me.e && outAt < 0) outAt = t; }
      else runnerX = me.x;
      return id === 'p1' ? { x: 1, y: 0, b: 0 } : { x: 0, y: 0, b: 0 };
    }, 60);
    expect(warned).toBe(RUSHC.OFF_LIMIT); // the countdown started from 3
    expect(outAt).toBeGreaterThan(RUSHC.OFF_LIMIT); // not before the countdown ran
    expect(outAt).toBeLessThan(40);
    const rows = res.game.standings();
    expect(rows[0].playerId).toBe('p1');
    expect(rows[1].detail).toContain('OUT');
    expect(runnerX).toBeGreaterThan(300);
  });

  it('everybody idle: the screen edge runs them all out and the round ends long before the clock', () => {
    const r = runGame(rushGame, 3, { len: 12 }, () => ({ x: 0, y: 0, b: 0 }), 100);
    expect(r.over).toBe(true);
    expect(r.t).toBeLessThan(40);
  });

  it('the screen edge never moves backwards and respawns are always on screen', () => {
    let prev = -Infinity, bad = 0;
    runGame(rushGame, 2, { len: 12 }, (id, snap) => {
      if (snap.ed < prev) bad++;
      prev = snap.ed;
      const me = snap.p.find((q: any) => q.id === id);
      if (!me.e && me.x < snap.ed - 40 && !me.w) bad++;
      return { x: 1, y: 0, b: 0 };
    }, 60);
    expect(bad).toBe(0);
  });
});
