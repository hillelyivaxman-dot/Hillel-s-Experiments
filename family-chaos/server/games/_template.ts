// TEMPLATE for a new game. Copy to server/games/<id>.ts, rename, then follow docs/ADDING_A_GAME.md.
// This file is intentionally NOT registered in server/games/index.ts.
//
// Example rules ("Coin Grab"): coins appear in a box; touch them to score. Most coins after 45 s wins.
import { BTN } from '../../shared/protocol';
import { r1 } from '../util';
import { damp, integrate, spawnRing, type Body } from './physics';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

const DURATION = 45;

interface Runner extends Body { id: string; coins: number }

export const templateGame: GameModule = {
  id: 'template', // must match the id in shared/catalog.ts
  create(ctx: GameContext): GameInstance {
    let time = 0;
    const ring = spawnRing(ctx.players.length, 200);
    const rs: Runner[] = ctx.players.map((p, i) => ({ id: p.id, x: ring[i].x, y: ring[i].y, vx: 0, vy: 0, r: 30, m: 1, coins: 0 }));
    const coin = { x: 0, y: 0 };

    return {
      // optional: react to button presses (rising edge)
      onPress(pid, btn) {
        if (btn === BTN.A) ctx.fx('honk', { id: pid });
      },
      // fixed 30 Hz simulation step; the server is the only source of truth
      tick(dt) {
        time += dt;
        for (const r of rs) {
          const inp = ctx.input(r.id);
          r.vx += inp.x * 900 * dt;
          r.vy += inp.y * 900 * dt;
          damp(r, 0.1, dt);
          integrate(r, dt);
          r.x = Math.max(-600, Math.min(600, r.x));
          r.y = Math.max(-350, Math.min(350, r.y));
          if (Math.hypot(r.x - coin.x, r.y - coin.y) < r.r + 16) {
            r.coins++;
            coin.x = (ctx.rand() - 0.5) * 1100;
            coin.y = (ctx.rand() - 0.5) * 600;
            ctx.fx('coin', { id: r.id });
            ctx.buzz(r.id, 40);
            ctx.hud(r.id, { coins: r.coins });
          }
        }
      },
      // small JSON for the screen renderer (client/src/render/<id>.ts)
      snapshot: () => ({ t: r1(time), left: Math.ceil(DURATION - time), coin, p: rs.map((r) => ({ id: r.id, x: r1(r.x), y: r1(r.y), c: r.coins })) }),
      isOver: () => time >= DURATION,
      standings: (): StandingRow[] =>
        [...rs].sort((a, b) => b.coins - a.coins).map((r) => ({ playerId: r.id, score: r.coins, detail: `${r.coins} :coin:`, tie: r.coins })),
    };
  },
};
