import { BTN } from '../../shared/protocol';
import { BBALL, hoopAt, launch, newBall, stepBall, type Ball } from '../../shared/basketball';
import { r1 } from '../util';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// BASKETBALL CHAOS: every player has a lane with a hoop that drifts around. Pull the stick back to aim (the screen shows the
// arc), let go to shoot. Swish (no rim) = 3, normal basket = 2, every 3rd basket in a row = on fire (+1 each). The balls fly with
// real physics on the server: rim, backboard, bounce.
interface Sh { id: string; phase: number; aim: { x: number; y: number }; peak: number; held: boolean; ball: Ball | null; cd: number; score: number; streak: number; best: number; net: number; ready: boolean }

export const basketballGame: GameModule = {
  id: 'basketball',
  create(ctx: GameContext): GameInstance {
    const TIME = ctx.options.time ?? BBALL.TIME;
    let t = 0;
    const ps: Sh[] = ctx.players.map((p, i) => ({ id: p.id, phase: i * 1.7, aim: { x: 0, y: 0 }, peak: 0, held: false, ball: null, cd: 0, score: 0, streak: 0, best: 0, net: 0, ready: true }));
    const level = Math.min(3, Math.floor(ctx.players.length / 3));
    const hoop = (p: Sh) => hoopAt(t, p.phase, level);
    const hud = (p: Sh) => ctx.hud(p.id, { score: p.score, streak: p.streak, left: Math.max(0, Math.ceil(TIME - t)) });
    ps.forEach(hud);
    function fire(p: Sh, ax: number, ay: number) {
      if (p.ball || p.cd > 0 || t >= TIME) return;
      const { vx, vy } = launch(ax, ay);
      p.ball = newBall(vx, vy); p.cd = 0.25; p.peak = 0;
      ctx.fx('shoot', { id: p.id }); ctx.buzz(p.id, 20);
    }
    return {
      onPress(pid, b) {
        const p = ps.find((q) => q.id === pid);
        if (p && b === BTN.A && p.peak > 0.2) fire(p, p.aim.x, p.aim.y);
      },
      tick(dt) {
        t += dt;
        for (const p of ps) {
          const inp = ctx.input(p.id), m = Math.hypot(inp.x, inp.y);
          p.cd = Math.max(0, p.cd - dt); p.net = Math.max(0, p.net - dt);
          if (m > 0.2) { p.aim = { x: inp.x, y: inp.y }; p.peak = Math.max(p.peak, m); p.held = true; }
          else if (p.held) { // let go = shoot (needs a real pull, not a touch)
            if (p.peak > 0.3) fire(p, p.aim.x, p.aim.y);
            p.held = false; p.peak = 0; p.aim = { x: 0, y: 0 };
          }
          const b = p.ball;
          if (!b) continue;
          for (let k = 0; k < 2; k++) { // two sub-steps keep the ball from tunnelling through the rim
            const ev = stepBall(b, hoop(p), dt / 2);
            if (ev === 'score' || ev === 'swish') {
              p.streak++; p.best = Math.max(p.best, p.streak);
              const pts = (ev === 'swish' ? 3 : 2) + (p.streak >= 3 ? 1 : 0);
              p.score += pts; p.net = 0.8;
              ctx.fx('basket', { id: p.id, pts, swish: ev === 'swish' ? 1 : 0, streak: p.streak }); ctx.buzz(p.id, 70); hud(p);
            } else if (ev === 'rim') ctx.fx('rim', { id: p.id });
            else if (ev === 'board') ctx.fx('board', { id: p.id });
          }
          if (b.x > BBALL.LW + 60 || b.x < -60 || b.t > 3.2 || (b.bounces >= 2 && Math.abs(b.vy) < 80)) {
            if (!b.scored) { p.streak = 0; hud(p); ctx.fx('miss', { id: p.id }); }
            p.ball = null;
          }
        }
        if (Math.floor(t) !== Math.floor(t - dt)) ps.forEach(hud);
      },
      snapshot: () => ({
        t: r1(t), left: Math.max(0, Math.ceil(TIME - t)),
        p: ps.map((p) => { const h = hoop(p); return { id: p.id, hx: Math.round(h.x), hy: Math.round(h.y), ax: r1(p.aim.x), ay: r1(p.aim.y), s: p.score, st: p.streak, nt: p.net > 0 ? 1 : 0 }; }),
        bl: ps.filter((p) => p.ball).map((p) => ({ id: p.id, x: Math.round(p.ball!.x), y: Math.round(p.ball!.y) })),
      }),
      isOver: () => t >= TIME && ps.every((p) => !p.ball),
      standings: (): StandingRow[] => [...ps].sort((a, b) => b.score - a.score).map((p) => ({ playerId: p.id, score: p.score, detail: `${p.score} pts${p.best >= 3 ? ` · :flame:${p.best}` : ''}`, tie: p.score })),
    };
  },
};
