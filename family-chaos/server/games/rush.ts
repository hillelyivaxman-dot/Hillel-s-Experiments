import { BTN } from '../../shared/protocol';
import { makeLevel, platX, RUSH, sawY } from '../../shared/rush';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// CHAOS RUSH: side-scrolling obstacle race. Jump pits, spikes and saws, ride moving platforms,
// DASH forward, SHOVE rivals back. Hits send you to the last checkpoint. First to the finish wins.
export const RUSHC = {
  RUN: 330, GRAV: 2200, JUMP: 820, DASH_V: 740, DASH_T: 0.18, DASH_CD: 2.5, SHOVE_CD: 5,
  HALF_W: 18, HEIGHT: 52, MAX_TIME: 110, GRACE: 25,
  // pressure forward: the screen only moves ahead. Whoever is left behind its left edge has OFF_LIMIT seconds to come back, or is out.
  EDGE_LEAD: 812, CREEP_FROM: 8, CREEP_V: 42, OFF_LIMIT: 3,
} as const;

interface P {
  id: string; x: number; y: number; vx: number; vy: number; face: 1 | -1;
  g: boolean; coy: number; jumpBuf: number; jumping: boolean; onPlat: number;
  dashT: number; dashCd: number; shoveCd: number; stun: number; inv: number;
  cp: number; best: number; fin: number; hits: number;
  off: number; // seconds spent behind the screen edge
  out: number; // time of elimination, -1 while running
}

const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

export const rushGame: GameModule = {
  id: 'rush',
  create(ctx: GameContext): GameInstance {
    const C = RUSHC;
    const seed = Math.floor(ctx.rand() * 1e9);
    const lv = makeLevel(seed, ctx.options.len ?? 12);
    const G = RUSH.GROUND;
    let time = 0;
    let endAt = Infinity;
    let hudT = 0;
    const finishOrder: string[] = [];
    const prevPX = lv.plats.map((p) => platX(p, 0));
    const dPX = lv.plats.map(() => 0);

    const ps: P[] = ctx.players.map((pl, i) => ({
      id: pl.id, x: 20 + (i % 4) * 46, y: G, vx: 0, vy: 0, face: 1, g: true, coy: 0.1, jumpBuf: 0, jumping: false, onPlat: -1,
      dashT: 0, dashCd: 0, shoveCd: 0, stun: 0, inv: 0, cp: 0, best: 0, fin: -1, hits: 0, off: 0, out: -1,
    }));
    const byId = new Map(ps.map((p) => [p.id, p]));
    const pct = (p: P) => Math.max(0, Math.min(100, Math.round((p.best / lv.finishX) * 100)));
    let edge = -120; // left edge of the screen (world x); never moves back
    const rank = (p: P) => (p.fin >= 0 ? 0 : p.out < 0 ? 1 : 2);
    const order = () => [...ps].sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (a.fin >= 0) return a.fin - b.fin;
      if (a.out >= 0) return b.out - a.out || b.best - a.best; // eliminated later = placed higher
      return b.best - a.best;
    });
    const running = (p: P) => p.fin < 0 && p.out < 0;

    function hud(p: P) {
      const o = order();
      ctx.hud(p.id, { place: o.indexOf(p) + 1, of: ps.length, pct: pct(p), dash: p.dashCd <= 0 ? 1 : 0, shove: p.shoveCd <= 0 ? 1 : 0, done: p.fin >= 0 ? 1 : 0, out: p.out >= 0 ? 1 : 0, warn: p.off > 0 ? Math.max(1, Math.ceil(C.OFF_LIMIT - p.off)) : 0 });
    }
    ps.forEach(hud);

    function hit(p: P, kind: string) {
      if (p.inv > 0 || p.fin >= 0) return;
      p.hits++;
      p.x = Math.max(lv.checkpoints[p.cp], edge + 160); // never respawn off screen
      p.y = G - 160;
      p.vx = 0; p.vy = 0; p.g = false; p.onPlat = -1; p.dashT = 0;
      p.stun = 0.35; p.inv = 1.3;
      ctx.fx('hit', { id: p.id, kind });
      ctx.buzz(p.id, 220);
    }

    return {
      onPress(pid, btn) {
        const p = byId.get(pid);
        if (!p || p.fin >= 0 || p.out >= 0) return;
        if (btn === BTN.A) { p.jumpBuf = 0.12; return; }
        if (p.stun > 0) return;
        if (btn === BTN.B && p.dashCd <= 0) {
          p.dashT = C.DASH_T; p.dashCd = C.DASH_CD;
          ctx.fx('dash', { id: pid });
          hud(p);
        } else if (btn === BTN.C && p.shoveCd <= 0) {
          p.shoveCd = C.SHOVE_CD;
          let n = 0;
          for (const q of ps) {
            if (q === p || q.fin >= 0 || q.out >= 0 || q.inv > 0) continue;
            if (Math.abs(q.x - p.x) < 180 && Math.abs(q.y - p.y) < 110) {
              q.vx = (q.x >= p.x ? 1 : -1) * 680; q.vy = -330; q.g = false; q.onPlat = -1; q.stun = 0.4; q.dashT = 0;
              ctx.buzz(q.id, 120);
              n++;
            }
          }
          ctx.fx('shove', { id: pid, n });
          hud(p);
        }
      },

      tick(dt) {
        time += dt;
        lv.plats.forEach((pl, i) => { const nx = platX(pl, time); dPX[i] = nx - prevPX[i]; prevPX[i] = nx; });

        // the screen edge follows the front runner (like the camera) and creeps forward on its own, so nobody can hang back for ever
        const leadBest = Math.max(-Infinity, ...ps.filter(running).map((p) => p.best));
        if (leadBest > -Infinity) edge = Math.max(edge, Math.min(lv.length - RUSH.VIEW_W + 60, Math.max(leadBest - C.EDGE_LEAD, time > C.CREEP_FROM ? (time - C.CREEP_FROM) * C.CREEP_V - 120 : -120)));
        for (const p of ps) {
          if (p.out >= 0) continue; // eliminated: out of the race
          if (p.fin >= 0) { p.vx *= 0.9; if (Math.abs(p.vx) < 5) p.vx = 0; p.x += p.vx * dt; continue; }
          const inp = ctx.input(p.id);
          const had = [p.dashCd <= 0, p.shoveCd <= 0];
          p.stun = Math.max(0, p.stun - dt); p.inv = Math.max(0, p.inv - dt);
          p.dashCd = Math.max(0, p.dashCd - dt); p.shoveCd = Math.max(0, p.shoveCd - dt);
          if ((!had[0] && p.dashCd <= 0) || (!had[1] && p.shoveCd <= 0)) hud(p);
          const ctl = p.stun <= 0;

          if (p.onPlat >= 0) p.x += dPX[p.onPlat]; // ride moving platforms
          if (ctl && Math.abs(inp.x) > 0.15) p.face = inp.x > 0 ? 1 : -1;
          if (p.dashT > 0) { p.dashT -= dt; p.vx = p.face * C.DASH_V; }
          else p.vx = approach(p.vx, ctl ? inp.x * C.RUN : 0, (p.g ? 2800 : 1700) * dt);

          p.coy = p.g ? 0.1 : p.coy - dt;
          p.jumpBuf -= dt;
          if (ctl && p.jumpBuf > 0 && p.coy > 0) {
            p.vy = -C.JUMP; p.coy = 0; p.jumpBuf = 0; p.g = false; p.onPlat = -1; p.jumping = true;
            ctx.fx('jump', { id: p.id });
          }
          if (p.jumping && p.vy < -300 && !(inp.b & BTN.A)) { p.vy *= 0.55; p.jumping = false; } // short hop when released
          if (p.vy >= 0) p.jumping = false;

          p.vy += C.GRAV * (p.dashT > 0 ? 0.25 : 1) * dt;
          const prevY = p.y;
          p.x = Math.max(-150, p.x + p.vx * dt);
          p.y += p.vy * dt;

          // landing (one-way: only from above)
          const wasG = p.g;
          p.g = false; p.onPlat = -1;
          if (p.vy >= 0) {
            let top = Infinity, pi = -1;
            for (const s of lv.ground) if (p.x >= s.x0 && p.x <= s.x1 && prevY <= G + 1 && p.y >= G) top = G;
            lv.plats.forEach((pl, i) => {
              const px = prevPX[i];
              if (p.x >= px - 4 && p.x <= px + pl.w + 4 && prevY <= pl.y + 1 && p.y >= pl.y && pl.y < top) { top = pl.y; pi = pl.mv ? i : -1; }
            });
            if (top < Infinity) {
              p.y = top; p.vy = 0; p.g = true; p.onPlat = pi;
              if (!wasG) ctx.fx('land', { id: p.id, x: Math.round(p.x), y: Math.round(top) });
            }
          }

          if (p.y > G + 170) { hit(p, 'pit'); continue; }

          // left behind the screen? warn, count down, eliminate
          if (p.x + C.HALF_W < edge + 30) {
            const before = Math.ceil(C.OFF_LIMIT - p.off);
            p.off += dt;
            if (p.off >= C.OFF_LIMIT) {
              p.out = time; p.vx = 0; p.vy = 0;
              ctx.fx('out', { id: p.id, x: Math.round(p.x), y: Math.round(p.y) });
              ctx.buzz(p.id, 500);
              hud(p);
              continue;
            }
            if (Math.ceil(C.OFF_LIMIT - p.off) !== before || p.off === dt) { ctx.fx('warn', { id: p.id, n: Math.ceil(C.OFF_LIMIT - p.off) }); ctx.buzz(p.id, 80); hud(p); }
          } else if (p.off > 0) { p.off = 0; hud(p); }

          // hazards
          if (p.inv <= 0) {
            for (const sp of lv.spikes) {
              if (p.x + C.HALF_W > sp.x && p.x - C.HALF_W < sp.x + sp.w && p.y > G - 22) { hit(p, 'spikes'); break; }
            }
            if (p.inv <= 0) for (const sw of lv.saws) {
              const cy = sawY(sw, time);
              const nx = Math.max(p.x - C.HALF_W, Math.min(sw.x, p.x + C.HALF_W));
              const ny = Math.max(p.y - C.HEIGHT, Math.min(cy, p.y));
              if (Math.hypot(nx - sw.x, ny - cy) < sw.r) { hit(p, 'saw'); break; }
            }
          }

          p.best = Math.max(p.best, p.x);
          while (p.cp + 1 < lv.checkpoints.length && p.x >= lv.checkpoints[p.cp + 1]) {
            p.cp++;
            if (p.cp < lv.checkpoints.length) ctx.fx('checkpoint', { id: p.id, x: lv.checkpoints[p.cp] });
          }
          if (p.x >= lv.finishX && p.fin < 0) {
            p.fin = time; finishOrder.push(p.id);
            if (endAt === Infinity) endAt = time + C.GRACE;
            ctx.fx('finish', { id: p.id, place: finishOrder.length });
            ctx.buzz(p.id, 400);
            hud(p);
          }
        }
        hudT += dt;
        if (hudT > 0.5) { hudT = 0; ps.forEach(hud); }
      },

      snapshot() {
        return {
          t: Math.round(time * 100) / 100, sd: seed, ln: ctx.options.len ?? 12,
          end: endAt === Infinity ? -1 : Math.max(0, Math.ceil(endAt - time)),
          left: Math.max(0, Math.ceil(C.MAX_TIME - time)),
          p: ps.map((p) => ({
            id: p.id, x: Math.round(p.x), y: Math.round(p.y), f: p.face, g: p.g ? 1 : 0, d: p.dashT > 0 ? 1 : 0,
            i: p.inv > 0 ? 1 : 0, k: p.stun > 0 ? 1 : 0, c: p.fin >= 0 ? 1 : 0, cp: p.cp,
            ...(p.out >= 0 ? { e: 1 } : p.off > 0 ? { w: Math.max(1, Math.ceil(C.OFF_LIMIT - p.off)) } : {}),
          })),
          ed: Math.round(edge),
          o: order().map((p) => p.id),
        };
      },

      isOver() {
        const active = ps.filter(running).length;
        if (active === 0) return true;
        if (active === 1 && ps.length > 1 && ps.some((p) => p.out >= 0) && endAt === Infinity) endAt = time + 4; // last runner standing: let them finish or run out the clock
        return time >= C.MAX_TIME || time >= endAt;
      },

      standings(): StandingRow[] {
        return order().map((p, i) => ({
          playerId: p.id,
          score: p.fin >= 0 ? Math.round(p.fin * 100) / 100 : pct(p),
          detail: p.fin >= 0 ? `${p.fin.toFixed(1)}s` : p.out >= 0 ? `OUT · ${pct(p)}%` : `${pct(p)}%`,
          tie: i,
        }));
      },
    };
  },
};
