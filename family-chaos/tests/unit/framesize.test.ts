import { describe, expect, it } from 'vitest';
import { GAMES } from '../../server/games';
import { runGame } from './helpers';

// Bandwidth budget: snapshots are streamed 30x/s to every screen, and the free hosting plan
// includes only a few GB per month. Keep raw (pre-compression) frames small.
describe('frame size budget', () => {
  for (const [id, mod] of Object.entries(GAMES)) {
    it(`${id}: average 8-player snapshot stays under 900 bytes`, () => {
      let total = 0;
      let n = 0;
      runGame(mod, 8, {}, (pid, snap, t) => {
        if (pid === 'p1') { total += JSON.stringify(snap).length; n++; }
        return { x: Math.sin(t + pid.length), y: Math.cos(t * 1.3), b: 1 };
      }, 20);
      expect(total / n).toBeLessThan(900);
    });
  }
});
