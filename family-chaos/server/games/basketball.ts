import { BTN } from '../../shared/protocol';
import { r1 } from '../util';
import { BB, bbZone } from '../../shared/minigames';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// BASKETBALL CHAOS: everyone shoots at the same hoop at once. Walk to pick your distance (far = 3 points),
// HOLD the button to charge the meter and RELEASE inside the green zone. The server rolls the shot from your timing.

interface Sh { id: string; x: number; ch: number; dir: number; charging: boolean; flight: number; ok: number; pts: number; score: number; cd: number; streak: number; held: boolean }


export const basketballGame: GameModule = {
  id: 'basketball',
  create(ctx: GameContext): GameInstance {
    const time = ctx.options.time ?? BB.TIME;
    let t = 0;
    const ps: Sh[] = ctx.players.map((p, i) => ({ id: p.id, x: 260 + (i % 4) * 130 + Math.floor(i / 4) * 40, ch: 0, dir: 1, charging: false, flight: -1, ok: 0, pts: 0, score: 0, cd: 0, streak: 0, held: false }));
    const hud = (p: Sh) => ctx.hud(p.id, { score: p.score, streak: p.streak, left: Math.max(0, Math.ceil(time - t)) });
    ps.forEach(hud);
    function release(p: Sh) {
      const z = bbZone(p.x), err = Math.abs(p.ch - z.tg);
      p.charging = false;
      p.ok = err <= z.w ? 1 : 0;
      p.pts = p.ok ? (z.three ? 3 : 2) + (err < 0.025 ? 1 : 0) : 0;
      p.flight = 0; p.cd = BB.FLIGHT + 0.25;
      ctx.fx('shoot', { id: p.id });
    }
    return {
      onPress(pid, b) { const p = ps.find((q) => q.id === pid); if (p && t < time && b === BTN.A && p.flight < 0 && p.cd <= 0 && !p.charging) { p.charging = true; p.ch = 0; p.dir = 1; } },
      tick(dt) {
        t += dt;
        for (const p of ps) {
          const inp = ctx.input(p.id);
          p.x = Math.max(BB.MIN_X, Math.min(BB.MAX_X, p.x + (p.charging || p.flight >= 0 ? 0 : inp.x) * 300 * dt));
          p.cd = Math.max(0, p.cd - dt);
          const held = (inp.b & BTN.A) !== 0;
          if (p.charging) {
            p.ch += p.dir * BB.SPEED * dt;
            if (p.ch >= 1) { p.ch = 1; p.dir = -1; } else if (p.ch <= 0) { p.ch = 0; p.dir = 1; }
            if (!held && p.held) release(p);
            else if (t > time) release(p);
          }
          p.held = held;
          if (p.flight >= 0) {
            p.flight += dt / BB.FLIGHT;
            if (p.flight >= 1) {
              p.flight = -1;
              if (p.ok) { p.score += p.pts; p.streak++; ctx.fx('swish', { id: p.id, pts: p.pts }); ctx.buzz(p.id, 60); } else { p.streak = 0; ctx.fx('miss', { id: p.id }); }
              hud(p);
            }
          }
        }
      },
      snapshot: () => ({
        t: r1(t), left: Math.max(0, Math.ceil(time - t)),
        p: ps.map((p) => ({ id: p.id, x: Math.round(p.x), ch: p.charging ? Math.round(p.ch * 100) / 100 : -1, sh: p.flight < 0 ? -1 : Math.round(p.flight * 100) / 100, ok: p.ok, s: p.score, st: p.streak, tg: bbZone(p.x).tg, w: bbZone(p.x).w })),
      }),
      isOver: () => t >= time && ps.every((p) => p.flight < 0 && !p.charging),
      standings: (): StandingRow[] => [...ps].sort((a, b) => b.score - a.score).map((p) => ({ playerId: p.id, score: p.score, detail: `${p.score} pts`, tie: p.score })),
    };
  },
};
