import { BTN } from '../../shared/protocol';
import { tileIndex, VANISH } from '../../shared/vanish';
import { r1 } from '../util';
import { collide, damp, integrate, type Body } from './physics';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// VANISHING FLOOR: the floor is slippery and crumbles. Tiles you stand on crack and vanish, and the arena eats itself
// faster and faster. JUMP hops over gaps (and is safe in the air), DASH shoves rivals toward the holes. Last one standing wins.
export { VANISH };
const { COLS, ROWS, TILE } = VANISH;

interface Pl extends Body { id: string; z: number; jumpT: number; jumpCd: number; dashCd: number; alive: boolean; diedAt: number; fall: number; bumps: number }

export const vanishGame: GameModule = {
  id: 'vanish',
  create(ctx: GameContext): GameInstance {
    const V = VANISH;
    let time = 0, over = false, decayT = 2.4, interval = 2.1;
    const state = new Uint8Array(COLS * ROWS); // 0 solid, 1 cracking, 2 gone
    const timer = new Float32Array(COLS * ROWS); // crack countdown / stand time
    const stand = new Float32Array(COLS * ROWS);
    const ps: Pl[] = ctx.players.map((p, i, all) => {
      const a = (i / all.length) * Math.PI * 2;
      return { id: p.id, x: (COLS * TILE) / 2 + Math.cos(a) * 300, y: (ROWS * TILE) / 2 + Math.sin(a) * 200, vx: 0, vy: 0, r: V.PLAYER_R, m: 1, z: 0, jumpT: 0, jumpCd: 0, dashCd: 0, alive: true, diedAt: -1, fall: 0, bumps: 0 };
    });
    const byId = new Map(ps.map((p) => [p.id, p]));
    const hud = (p: Pl) => ctx.hud(p.id, { alive: p.alive ? 1 : 0, jump: p.jumpCd <= 0 ? 1 : 0, dash: p.dashCd <= 0 ? 1 : 0, left: ps.filter((q) => q.alive).length });
    ps.forEach(hud);

    function crack(i: number) { if (state[i] === 0) { state[i] = 1; timer[i] = V.CRACK; ctx.fx('crack', { i }); } }

    return {
      onPress(pid, btn) {
        const p = byId.get(pid);
        if (!p || !p.alive) return;
        if (btn === BTN.A && p.jumpCd <= 0 && p.jumpT <= 0) { p.jumpT = V.JUMP_T; p.jumpCd = V.JUMP_CD; ctx.fx('jump', { id: pid }); hud(p); }
        else if (btn === BTN.B && p.dashCd <= 0) {
          p.dashCd = V.DASH_CD;
          let n = 0;
          for (const q of ps) {
            if (q === p || !q.alive) continue;
            const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
            if (d < 150 && d > 0) { q.vx += (dx / d) * 620; q.vy += (dy / d) * 620; n++; ctx.buzz(q.id, 80); }
          }
          p.vx += Math.cos(Math.atan2(ctx.input(pid).y, ctx.input(pid).x)) * 260 * (Math.hypot(ctx.input(pid).x, ctx.input(pid).y) > 0.2 ? 1 : 0);
          ctx.fx('dash', { id: pid, n });
          hud(p);
        }
      },

      tick(dt) {
        time += dt;
        // players
        for (const p of ps) {
          if (!p.alive) { p.fall += dt; continue; }
          const inp = ctx.input(p.id);
          p.vx += inp.x * 1500 * dt; p.vy += inp.y * 1500 * dt;
          damp(p, 0.07, dt); // slippery
          const sp = Math.hypot(p.vx, p.vy);
          if (sp > 430) { p.vx *= 430 / sp; p.vy *= 430 / sp; }
          integrate(p, dt);
          const hj = p.jumpT > 0;
          p.jumpT = Math.max(0, p.jumpT - dt); p.jumpCd = Math.max(0, p.jumpCd - dt); const hadD = p.dashCd <= 0; p.dashCd = Math.max(0, p.dashCd - dt);
          p.z = p.jumpT > 0 ? Math.sin((1 - p.jumpT / V.JUMP_T) * Math.PI) * 70 : 0;
          if ((hj && p.jumpT <= 0) || (!hadD && p.dashCd <= 0)) hud(p);
        }
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i], b = ps[j];
          if (!a.alive || !b.alive || a.z > 5 || b.z > 5) continue;
          if (collide(a, b, 0.85, 80) > 140) { a.bumps++; b.bumps++; ctx.fx('bump', { x: r1((a.x + b.x) / 2), y: r1((a.y + b.y) / 2) }); }
        }
        // floor: standing on a tile cracks it; the arena also decays by itself, faster and faster
        stand.fill(0);
        for (const p of ps) if (p.alive && p.z < 5) { const i = tileIndex(p.x, p.y); if (i >= 0 && state[i] === 0) stand[i] += dt; }
        for (let i = 0; i < state.length; i++) {
          if (state[i] === 0) { timer[i] = stand[i] > 0 ? timer[i] + dt : Math.max(0, timer[i] - dt * 0.5); if (timer[i] >= V.STAND) { timer[i] = 0; crack(i); } }
          else if (state[i] === 1) { timer[i] -= dt; if (timer[i] <= 0) { state[i] = 2; ctx.fx('gone', { i }); } }
        }
        decayT -= dt;
        if (decayT <= 0) {
          interval = Math.max(0.55, interval * 0.93); decayT = interval;
          // prefer tiles next to holes (the floor "eats" inwards), else any solid tile
          const solid: number[] = [], edge: number[] = [];
          state.forEach((s, i) => {
            if (s !== 0) return; solid.push(i);
            const c = i % COLS, r = Math.floor(i / COLS);
            if (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1 || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => state[(r + dr) * COLS + c + dc] === 2)) edge.push(i);
          });
          const pool = edge.length && ctx.rand() < 0.75 ? edge : solid;
          if (pool.length) crack(pool[Math.floor(ctx.rand() * pool.length)]);
        }
        // falling
        for (const p of ps) {
          if (!p.alive || p.z > 5) continue;
          const i = tileIndex(p.x, p.y);
          if (i < 0 || state[i] === 2) { p.alive = false; p.diedAt = time; p.fall = 0; ctx.fx('fall', { id: p.id, x: Math.round(p.x), y: Math.round(p.y) }); ctx.buzz(p.id, 300); ps.forEach(hud); }
        }
        const alive = ps.filter((p) => p.alive);
        if (alive.length <= (ps.length > 1 ? 1 : 0)) {
          if (!over) { over = true; if (alive[0]) { alive[0].diedAt = time + 0.01; ctx.fx('winner', { id: alive[0].id }); } }
        }
      },

      snapshot() {
        return {
          t: r1(time), tl: Array.from(state).join(''), left: ps.filter((p) => p.alive).length,
          p: ps.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z), al: p.alive ? 1 : 0, fl: p.alive ? 0 : r1(p.fall) })),
        };
      },

      isOver: () => over,

      standings(): StandingRow[] {
        // survivors first (latest elimination / still alive = best)
        return [...ps].sort((a, b) => (b.alive ? 1e9 : b.diedAt) - (a.alive ? 1e9 : a.diedAt)).map((p) => ({
          playerId: p.id, score: Math.round((p.alive ? time : p.diedAt) * 10) / 10, detail: p.alive ? ':crown:' : `${p.diedAt.toFixed(1)}s`, tie: p.alive ? 1e9 : Math.round(p.diedAt * 10),
        }));
      },
    };
  },
};
