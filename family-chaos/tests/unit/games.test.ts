import { describe, expect, it } from 'vitest';
import { bumperGame } from '../../server/games/bumper';
import { kartGame } from '../../server/games/kart';
import { potatoGame } from '../../server/games/potato';
import { reactionGame } from '../../server/games/reaction';
import { GAMES } from '../../server/games';
import { CATALOG } from '../../shared/catalog';
import { BTN } from '../../shared/protocol';
import { getTrack, pointAt, TRACK_COUNT } from '../../shared/tracks';
import { runGame } from './helpers';

describe('catalog', () => {
  it('every playable game has a server module and every module is in the catalog', () => {
    for (const g of CATALOG.filter((c) => c.status === 'playable')) expect(GAMES[g.id], g.id).toBeDefined();
    for (const id of Object.keys(GAMES)) expect(CATALOG.find((c) => c.id === id)?.status).toBe('playable');
  });
});

describe('bumper battle', () => {
  it('a player that drives off the edge loses all lives and the other wins', () => {
    const r = runGame(bumperGame, 2, { lives: 2 }, (id) => (id === 'p1' ? { x: 1, y: 0.3, b: 0 } : { x: 0, y: 0, b: 0 }));
    expect(r.over).toBe(true);
    const st = r.game.standings();
    expect(st[0].playerId).toBe('p2');
    expect(r.fx.filter((k) => k === 'fall').length).toBeGreaterThanOrEqual(2);
  });

  it('players collide and push each other (dash)', () => {
    const r = runGame(bumperGame, 2, { lives: 3 }, (id, snap, t) => {
      const me = snap.p.find((p: any) => p.id === id);
      const other = snap.p.find((p: any) => p.id !== id);
      const dx = other.x - me.x, dy = other.y - me.y, d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d, b: id === 'p1' && Math.floor(t * 2) % 2 ? BTN.A : 0 };
    }, 20);
    expect(r.fx).toContain('bump');
    expect(r.fx).toContain('dash');
  });

  it('times out with standings for everyone', () => {
    const r = runGame(bumperGame, 4, { lives: 3 }, () => ({ x: 0, y: 0, b: 0 }));
    expect(r.over).toBe(true);
    expect(r.game.standings()).toHaveLength(4);
  });
});

describe('kart chaos', () => {
  for (let track = 0; track < TRACK_COUNT; track++) {
    it(`an autopilot finishes 2 laps on track ${track}`, () => {
      const tr = getTrack(track);
      const r = runGame(kartGame, 3, { laps: 2, track }, (id, snap) => {
        const me = snap.c.find((c: any) => c.id === id);
        // aim at the track point slightly ahead of the closest sample
        let best = 0, bd = Infinity;
        tr.pts.forEach((p, i) => { const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2; if (d < bd) { bd = d; best = i; } });
        const ahead = pointAt(tr, (tr.cum[best] + 90) / tr.length);
        const want = Math.atan2(ahead.y - me.y, ahead.x - me.x);
        let diff = want - me.a;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const slow = id === 'p3';
        return { x: Math.max(-1, Math.min(1, diff * 2.5)), y: 0, b: slow ? 0 : BTN.A };
      });
      expect(r.over).toBe(true);
      const st = r.game.standings();
      const finished = st.filter((s) => s.score > 0);
      expect(finished.length).toBe(2); // p3 never presses gas
      expect(st[2].playerId).toBe('p3');
      expect(r.fx).toContain('finish');
      expect(r.fx).toContain('lap');
      expect(r.t).toBeLessThan(120);
    });
  }

  it('reversing over the line does not count as a lap', () => {
    const r = runGame(kartGame, 1, { laps: 1, track: 0 }, () => ({ x: 0, y: 0, b: BTN.B }), 30);
    expect(r.over).toBe(false);
  });
});

describe('reaction duel', () => {
  it('fast tapper wins, early tapper is punished', () => {
    const r = runGame(reactionGame, 3, { rounds: 3 }, (id, snap) => {
      if (id === 'p1') return { x: 0, y: 0, b: snap.ph === 'go' ? BTN.A : 0 };
      if (id === 'p2') return { x: 0, y: 0, b: snap.ph === 'wait' ? BTN.A : 0 }; // always early
      return { x: 0, y: 0, b: 0 };
    });
    expect(r.over).toBe(true);
    const st = r.game.standings();
    expect(st[0].playerId).toBe('p1');
    expect(st[0].score).toBe(9);
    expect(st.find((s) => s.playerId === 'p2')!.score).toBeLessThan(0);
  });
});

describe('hot potato', () => {
  it('eliminates players until one survives', () => {
    const r = runGame(potatoGame, 4, {}, (id, snap) => {
      const me = snap.p.find((p: any) => p.id === id);
      if (me.o) return { x: 0, y: 0, b: 0 };
      if (snap.h === id) {
        const tgt = snap.p.filter((p: any) => !p.o && p.id !== id)
          .sort((a: any, b: any) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
        const dx = tgt.x - me.x, dy = tgt.y - me.y, d = Math.hypot(dx, dy) || 1;
        return { x: dx / d, y: dy / d, b: 0 };
      }
      return { x: Math.sin(me.y / 90), y: Math.cos(me.x / 90), b: 0 };
    });
    expect(r.over).toBe(true);
    const st = r.game.standings();
    expect(st).toHaveLength(4);
    expect(st[0].detail).toBe('👑');
    expect(r.fx.filter((k) => k === 'boom')).toHaveLength(3);
  });
});
