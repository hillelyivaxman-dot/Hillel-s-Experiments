import { BTN } from '../../shared/protocol';
import { sawYAt, TRAP_KINDS, TRAPS, type TrapKind } from '../../shared/traps';
import { r1 } from '../util';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// TRAP BUILDERS: each round has two phases. BUILD: everybody places traps on one shared course (stick = move the cursor,
// B = next trap type, A = place). RUN: everybody races through the course they all built. Finish places score points;
// every runner a trap hits scores a point for its builder. Highest total after all rounds wins.
export { TRAPS };
export const TRAPC = { RUN: 330, GRAV: 2200, JUMP: 800, DASH_V: 700, FINISH_PTS: [5, 3, 2, 1], HIT_PTS: 1, HIT_CAP: 5 };

interface Trap { x: number; k: TrapKind; o: string }
interface P {
  id: string; x: number; y: number; vx: number; vy: number; face: 1 | -1; g: boolean; coy: number; jumpBuf: number; jumping: boolean;
  dashT: number; dashCd: number; stun: number; inv: number; fin: number; curX: number; kind: number; left: number;
  total: number; hitPts: number; hits: number; lastHit: number; checkpointX: number;
}
type Ph = 'build' | 'run' | 'score' | 'done';

export const trapBuildersGame: GameModule = {
  id: 'trapbuilders',
  create(ctx: GameContext): GameInstance {
    const T = TRAPS, C = TRAPC;
    const rounds = ctx.options.rounds ?? 3;
    let round = 1, ph: Ph = 'build', phTime = 0, time = 0, runT = 0, endAt = Infinity;
    let traps: Trap[] = [];
    const finishOrder: string[] = [];
    let lastRoundPts: Record<string, number> = {};

    const ps: P[] = ctx.players.map((p) => ({
      id: p.id, x: 0, y: T.GROUND, vx: 0, vy: 0, face: 1, g: true, coy: 0, jumpBuf: 0, jumping: false, dashT: 0, dashCd: 0, stun: 0, inv: 0,
      fin: -1, curX: 1200, kind: 0, left: T.PER_PLAYER, total: 0, hitPts: 0, hits: 0, lastHit: -9, checkpointX: 40,
    }));
    const byId = new Map(ps.map((p) => [p.id, p]));

    const pitAt = (x: number) => traps.some((t) => t.k === 'pit' && x >= t.x - T.PIT_W / 2 && x <= t.x + T.PIT_W / 2);
    const valid = (x: number) => x > T.START_SAFE + 60 && x < T.FINISH - 200 && traps.every((t) => Math.abs(t.x - x) >= T.MIN_GAP);

    function hud(p: P) {
      ctx.hud(p.id, { ph, round, rounds, left: p.left, kind: TRAP_KINDS[p.kind], total: p.total, dash: p.dashCd <= 0 ? 1 : 0, done: p.fin >= 0 ? 1 : 0, t: Math.max(0, Math.ceil(phTime)) });
    }
    function startBuild() {
      ph = 'build'; phTime = T.BUILD_TIME; traps = []; finishOrder.length = 0; endAt = Infinity; runT = 0; lastRoundPts = {};
      for (const p of ps) { p.left = T.PER_PLAYER; p.curX = 1200; p.fin = -1; p.hitPts = 0; p.hits = 0; }
      ctx.fx('build'); ps.forEach(hud);
    }
    function startRun() {
      ph = 'run'; phTime = T.RUN_TIME; runT = 0; endAt = Infinity;
      for (const [i, p] of ps.entries()) { Object.assign(p, { x: 40 + (i % 4) * 36, y: T.GROUND, vx: 0, vy: 0, g: true, dashT: 0, dashCd: 0, stun: 0, inv: 0, fin: -1, jumpBuf: 0, checkpointX: 40 + (i % 4) * 36 }); }
      ctx.fx('run'); ps.forEach(hud);
    }
    function hit(p: P, t: Trap | null) {
      if (p.inv > 0 || p.fin >= 0) return;
      p.stun = 0.4; p.inv = 1.3; p.vx = 0; p.vy = 0;
      p.x = Math.max(40, p.checkpointX); p.y = T.GROUND - 120; p.g = false; p.dashT = 0;
      const owner = t ? byId.get(t.o) : null;
      if (owner && owner !== p && owner.hits < C.HIT_CAP) { owner.hits++; owner.hitPts += C.HIT_PTS; ctx.fx('score', { id: owner.id, from: p.id }); ctx.buzz(owner.id, 80); }
      ctx.fx('hit', { id: p.id, k: t?.k ?? 'fall', x: Math.round(p.x) });
      ctx.buzz(p.id, 200);
    }
    function endRound() {
      ph = 'score'; phTime = 4.5;
      const order = [...ps].sort((a, b) => (a.fin >= 0 && b.fin >= 0 ? a.fin - b.fin : a.fin >= 0 ? -1 : b.fin >= 0 ? 1 : b.x - a.x));
      order.forEach((p, i) => { const fp = p.fin >= 0 ? C.FINISH_PTS[i] ?? 0 : 0; const add = fp + p.hitPts; p.total += add; lastRoundPts[p.id] = add; });
      ctx.fx('roundEnd'); ps.forEach(hud);
    }
    startBuild();

    return {
      onPress(pid, btn) {
        const p = byId.get(pid);
        if (!p) return;
        if (ph === 'build') {
          if (btn === BTN.B) { p.kind = (p.kind + 1) % TRAP_KINDS.length; ctx.fx('kind', { id: pid }); hud(p); }
          else if (btn === BTN.A) {
            if (p.left <= 0) { ctx.fx('nope', { id: pid }); return; }
            const x = Math.round(p.curX);
            if (!valid(x)) { ctx.fx('nope', { id: pid }); ctx.buzz(pid, 60); return; }
            traps.push({ x, k: TRAP_KINDS[p.kind], o: pid }); p.left--;
            ctx.fx('place', { id: pid, k: TRAP_KINDS[p.kind], x }); ctx.buzz(pid, 40); hud(p);
            if (ps.every((q) => q.left <= 0)) phTime = Math.min(phTime, 1.2); // everyone done: go
          }
        } else if (ph === 'run' && p.fin < 0) {
          if (btn === BTN.A) p.jumpBuf = 0.12;
          else if (btn === BTN.B && p.dashCd <= 0 && p.stun <= 0) { p.dashT = 0.18; p.dashCd = 2.5; ctx.fx('dash', { id: pid }); hud(p); }
        }
      },

      tick(dt) {
        time += dt;
        if (ph === 'build') {
          phTime -= dt;
          for (const p of ps) {
            const inp = ctx.input(p.id);
            p.curX = Math.max(T.START_SAFE + 60, Math.min(T.FINISH - 200, p.curX + inp.x * 520 * dt));
          }
          if (phTime <= 0) startRun();
        } else if (ph === 'run') {
          runT += dt; phTime -= dt;
          for (const p of ps) {
            if (p.fin >= 0) { p.vx *= 0.9; p.x += p.vx * dt; continue; }
            const inp = ctx.input(p.id);
            p.stun = Math.max(0, p.stun - dt); p.inv = Math.max(0, p.inv - dt);
            const had = p.dashCd <= 0; p.dashCd = Math.max(0, p.dashCd - dt); if (!had && p.dashCd <= 0) hud(p);
            const ctl = p.stun <= 0;
            if (ctl && Math.abs(inp.x) > 0.15) p.face = inp.x > 0 ? 1 : -1;
            if (p.dashT > 0) { p.dashT -= dt; p.vx = p.face * C.DASH_V; }
            else { const target = ctl ? inp.x * C.RUN : 0, step = (p.g ? 2800 : 1700) * dt; p.vx += Math.max(-step, Math.min(step, target - p.vx)); }
            p.coy = p.g ? 0.1 : p.coy - dt; p.jumpBuf -= dt;
            if (ctl && p.jumpBuf > 0 && p.coy > 0) { p.vy = -C.JUMP; p.coy = 0; p.jumpBuf = 0; p.g = false; p.jumping = true; ctx.fx('jump', { id: p.id }); }
            if (p.jumping && p.vy < -300 && !(inp.b & BTN.A)) { p.vy *= 0.55; p.jumping = false; }
            if (p.vy >= 0) p.jumping = false;
            p.vy += C.GRAV * (p.dashT > 0 ? 0.25 : 1) * dt;
            const prevY = p.y;
            p.x = Math.max(-100, p.x + p.vx * dt); p.y += p.vy * dt;
            p.g = false;
            if (p.vy >= 0 && prevY <= T.GROUND + 1 && p.y >= T.GROUND && !pitAt(p.x)) { p.y = T.GROUND; p.vy = 0; p.g = true; }
            if (p.y > T.GROUND + 180) { hit(p, traps.find((t) => t.k === 'pit' && Math.abs(t.x - p.x) < T.PIT_W) ?? null); continue; }
            if (p.inv <= 0) {
              for (const t of traps) {
                if (t.k === 'spikes' && Math.abs(p.x - t.x) < T.SPIKE_W / 2 + 14 && p.y > T.GROUND - 24) { hit(p, t); break; }
                if (t.k === 'saw') {
                  const sy = sawYAt(t.x, runT), dx = Math.max(p.x - 16, Math.min(t.x, p.x + 16)), dy = Math.max(p.y - 52, Math.min(sy, p.y));
                  if (Math.hypot(dx - t.x, dy - sy) < T.SAW_R) { hit(p, t); break; }
                }
              }
            }
            // checkpoint: last position on solid ground that is at least 120 px before the next trap
            if (p.g && p.x > p.checkpointX + 100) p.checkpointX = p.x - 140;
            if (p.x >= T.FINISH && p.fin < 0) {
              p.fin = runT; finishOrder.push(p.id);
              if (endAt === Infinity) endAt = runT + T.GRACE;
              ctx.fx('finish', { id: p.id, place: finishOrder.length }); ctx.buzz(p.id, 300); hud(p);
            }
          }
          if (phTime <= 0 || runT >= endAt || ps.every((p) => p.fin >= 0)) endRound();
        } else if (ph === 'score') {
          phTime -= dt;
          if (phTime <= 0) { if (round >= rounds) { ph = 'done'; ps.forEach(hud); } else { round++; startBuild(); } }
        }
      },

      snapshot() {
        return {
          t: r1(time), ph, round, rounds, rt: r1(runT), tm: Math.max(0, Math.ceil(phTime)), end: endAt === Infinity ? -1 : Math.max(0, Math.ceil(endAt - runT)),
          tr: traps.map((t) => [t.x, TRAP_KINDS.indexOf(t.k), t.o]),
          p: ps.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), f: p.face, g: p.g ? 1 : 0, d: p.dashT > 0 ? 1 : 0, i: p.inv > 0 ? 1 : 0, c: p.fin >= 0 ? 1 : 0, cx: Math.round(p.curX), ty: p.kind, l: p.left, tot: p.total, rp: lastRoundPts[p.id] ?? 0, hp: p.hitPts })),
        };
      },

      isOver: () => ph === 'done',

      standings(): StandingRow[] {
        return [...ps].sort((a, b) => b.total - a.total).map((p) => ({ playerId: p.id, score: p.total, detail: `${p.total} pts`, tie: p.total }));
      },
    };
  },
};
