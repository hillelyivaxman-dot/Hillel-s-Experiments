import { BTN } from '../../shared/protocol';
import { ARENA, circRect, type Rect } from '../../shared/minigames';
import { r1 } from '../util';
import { collide, damp, integrate, spawnRing, type Body } from './physics';
import type { GameContext, GameModule, StandingRow } from './types';

const { W, H } = ARENA;
const clampA = (b: { x: number; y: number }, r: number) => { b.x = Math.max(r, Math.min(W - r, b.x)); b.y = Math.max(r, Math.min(H - r, b.y)); };

// ---------------- MAZE ESCAPE ----------------
import { MAZE_GEOM } from '../../shared/mazegeom';
export const MAZE = MAZE_GEOM;
/** Perfect maze (depth-first carve). Returns wall rectangles and per-cell open mask (1=N,2=E,4=S,8=W). */
export function makeMaze(rand: () => number) {
  const { COLS, ROWS } = MAZE;
  const open = new Array(COLS * ROWS).fill(0);
  const seen = new Array(COLS * ROWS).fill(false);
  const stack = [0]; seen[0] = true;
  const D = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];
  while (stack.length) {
    const c = stack[stack.length - 1], cx = c % COLS, cy = Math.floor(c / COLS);
    const nb = D.filter(([dx, dy]) => { const x = cx + dx, y = cy + dy; return x >= 0 && y >= 0 && x < COLS && y < ROWS && !seen[y * COLS + x]; });
    if (!nb.length) { stack.pop(); continue; }
    const [dx, dy, a, b] = nb[Math.floor(rand() * nb.length)];
    const n = (cy + dy) * COLS + cx + dx;
    open[c] |= a; open[n] |= b; seen[n] = true; stack.push(n);
  }
  // open a few extra shortcuts so the maze is not a single path
  for (let k = 0; k < 10; k++) { const c = Math.floor(rand() * COLS * ROWS), cx = c % COLS, cy = Math.floor(c / COLS); if (cx < COLS - 1) { open[c] |= 2; open[c + 1] |= 8; } void cy; }
  const walls: Rect[] = [];
  const { CELL, OX, OY, WALL } = MAZE;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const m = open[y * COLS + x], px = OX + x * CELL, py = OY + y * CELL;
    if (!(m & 1)) walls.push({ x: px - WALL / 2, y: py - WALL / 2, w: CELL + WALL, h: WALL });
    if (!(m & 8)) walls.push({ x: px - WALL / 2, y: py - WALL / 2, w: WALL, h: CELL + WALL });
    if (y === ROWS - 1) walls.push({ x: px - WALL / 2, y: py + CELL - WALL / 2, w: CELL + WALL, h: WALL });
    if (x === COLS - 1) walls.push({ x: px + CELL - WALL / 2, y: py - WALL / 2, w: WALL, h: CELL + WALL });
  }
  return { open, walls };
}

interface Rn extends Body { id: string; dash: number; done: number; pts: number; boost: number }
export const mazeGame: GameModule = {
  id: 'maze',
  create(ctx: GameContext) {
    const ROUNDS = ctx.options.rounds ?? 3;
    const { CELL, OX, OY, COLS, ROWS } = MAZE;
    const exit = { x: OX + (COLS - 0.5) * CELL, y: OY + (ROWS - 0.5) * CELL };
    const ps: Rn[] = ctx.players.map((p) => ({ id: p.id, x: 0, y: 0, vx: 0, vy: 0, r: 17, m: 1, dash: 0, done: -1, pts: 0, boost: 0 }));
    let round = 0, maze = makeMaze(ctx.rand), rt = 0, time = 0, finished = 0, over = false, between = 0;
    const place = () => ps.forEach((p, i) => { p.x = OX + CELL * (0.3 + (i % 4) * 0.13); p.y = OY + CELL * (0.25 + Math.floor(i / 4) * 0.45 + (i % 4) * 0.12); p.vx = p.vy = 0; p.done = -1; });
    place();
    const hud = () => ps.forEach((p) => ctx.hud(p.id, { round: round + 1, rounds: ROUNDS, pts: p.pts, done: p.done >= 0 ? 1 : 0, dash: p.dash <= 0 ? 1 : 0 }));
    hud();
    return {
      onPress(pid, b) { const p = ps.find((q) => q.id === pid); if (p && b === BTN.A && p.dash <= 0 && p.done < 0 && between <= 0) { p.dash = 3; p.boost = 0.5; ctx.fx('dash', { id: pid }); hud(); } },
      tick(dt) {
        time += dt;
        if (between > 0) { between -= dt; if (between <= 0) { round++; if (round >= ROUNDS) { over = true; return; } maze = makeMaze(ctx.rand); place(); rt = 0; finished = 0; ctx.fx('newmaze', {}); hud(); } return; }
        rt += dt;
        for (const p of ps) {
          if (p.done >= 0) continue;
          const i = ctx.input(p.id), had = p.dash <= 0;
          p.dash = Math.max(0, p.dash - dt); p.boost = Math.max(0, p.boost - dt);
          const cap = p.boost > 0 ? 330 : 190;
          p.vx += i.x * 1800 * dt; p.vy += i.y * 1800 * dt; damp(p, 0.001, dt);
          const sp = Math.hypot(p.vx, p.vy); if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
          integrate(p, dt);
          for (const w of maze.walls) if (Math.abs(w.x + w.w / 2 - p.x) < w.w / 2 + 40 && Math.abs(w.y + w.h / 2 - p.y) < w.h / 2 + 40) circRect(p, p.r, w);
          clampA(p, p.r);
          if (!had && p.dash <= 0) hud();
          if (Math.hypot(p.x - exit.x, p.y - exit.y) < 34) { p.done = rt; const pts = Math.max(1, ps.length - finished); p.pts += pts; finished++; ctx.fx('exit', { id: p.id, pts }); ctx.buzz(p.id, 150); hud(); }
        }
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (ps[i].done < 0 && ps[j].done < 0) collide(ps[i], ps[j], 0.3);
        if (finished >= ps.length || rt > 75 || (finished > 0 && ps.every((p) => p.done >= 0 || !ctx.connected(p.id)))) between = 3;
        else if (finished > 0 && rt - Math.min(...ps.filter((p) => p.done >= 0).map((p) => p.done)) > 12) between = 3;
      },
      snapshot: () => ({ t: r1(time), round: round + 1, rounds: ROUNDS, mz: maze.open.join(','), ex: exit, bt: between > 0 ? 1 : 0, p: ps.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), d: p.done >= 0 ? 1 : 0, pts: p.pts })) }),
      isOver: () => over,
      standings: (): StandingRow[] => [...ps].sort((a, b) => b.pts - a.pts).map((p) => ({ playerId: p.id, score: p.pts, detail: `${p.pts} pts`, tie: p.pts })),
    };
  },
};

// ---------------- SPACE RESCUE (co-op) ----------------
interface Ship extends Body { id: string; carry: number[]; stun: number; boost: number; saved: number; cd: number }
interface Astro { id: number; x: number; y: number; vx: number; vy: number; by: string | null; saved: boolean }
interface Rock { id: number; x: number; y: number; vx: number; vy: number; r: number }
export const spaceRescueGame: GameModule = {
  id: 'rescue',
  create(ctx: GameContext) {
    const TIME = ctx.options.time ?? 90;
    const base = { x: 150, y: H / 2, r: 80 };
    const ring = spawnRing(ctx.players.length, 60, base.x, base.y);
    const ships: Ship[] = ctx.players.map((p, i) => ({ id: p.id, x: ring[i].x, y: ring[i].y, vx: 0, vy: 0, r: 20, m: 1, carry: [], stun: 0, boost: 0, saved: 0, cd: 0 }));
    const TARGET = 4 + ctx.players.length;
    const astros: Astro[] = Array.from({ length: TARGET }, (_, i) => ({ id: i, x: 420 + ctx.rand() * 700, y: 60 + ctx.rand() * (H - 120), vx: (ctx.rand() - 0.5) * 30, vy: (ctx.rand() - 0.5) * 30, by: null, saved: false }));
    const rocks: Rock[] = Array.from({ length: 9 }, (_, i) => ({ id: i, x: 380 + ctx.rand() * 780, y: ctx.rand() * H, vx: (ctx.rand() - 0.5) * 120, vy: (ctx.rand() - 0.5) * 120, r: 28 + ctx.rand() * 26 }));
    let time = 0, saved = 0;
    const hud = () => ships.forEach((s) => ctx.hud(s.id, { carry: s.carry.length, saved, target: TARGET, left: Math.max(0, Math.ceil(TIME - time)), stun: s.stun > 0 ? 1 : 0, boost: s.cd <= 0 ? 1 : 0 }));
    hud();
    return {
      onPress(pid, b) { const s = ships.find((q) => q.id === pid); if (s && b === BTN.A && s.cd <= 0 && s.stun <= 0) { s.cd = 3; s.boost = 0.6; ctx.fx('boost', { id: pid }); hud(); } },
      tick(dt) {
        time += dt;
        for (const s of ships) {
          const i = ctx.input(s.id), had = s.cd <= 0;
          s.stun = Math.max(0, s.stun - dt); s.cd = Math.max(0, s.cd - dt); s.boost = Math.max(0, s.boost - dt);
          const k = s.stun > 0 ? 0.2 : 1;
          s.vx += i.x * 900 * k * dt + (s.boost > 0 ? Math.sign(i.x) * 1200 * dt : 0); s.vy += i.y * 900 * k * dt + (s.boost > 0 ? Math.sign(i.y) * 1200 * dt : 0); damp(s, 0.35, dt);
          const sp = Math.hypot(s.vx, s.vy), cap = s.boost > 0 ? 520 : 300 - s.carry.length * 25; if (sp > cap) { s.vx *= cap / sp; s.vy *= cap / sp; }
          integrate(s, dt);
          if (s.x < s.r || s.x > W - s.r) { s.x = Math.max(s.r, Math.min(W - s.r, s.x)); s.vx *= -0.5; }
          if (s.y < s.r || s.y > H - s.r) { s.y = Math.max(s.r, Math.min(H - s.r, s.y)); s.vy *= -0.5; }
          if (!had && s.cd <= 0) hud();
          // pick up (max 2) / deliver at base
          for (const a of astros) if (!a.saved && a.by === null && s.carry.length < 2 && s.stun <= 0 && Math.hypot(a.x - s.x, a.y - s.y) < s.r + 18) { a.by = s.id; s.carry.push(a.id); ctx.fx('grab', { id: s.id }); hud(); }
          if (s.carry.length && Math.hypot(s.x - base.x, s.y - base.y) < base.r) {
            for (const id of s.carry) { astros[id].saved = true; astros[id].by = null; s.saved++; saved++; }
            ctx.fx('save', { id: s.id, n: s.carry.length }); ctx.buzz(s.id, 100); s.carry = []; hud();
          }
        }
        for (const r of rocks) {
          r.x += r.vx * dt; r.y += r.vy * dt;
          if (r.x < 300 || r.x > W - r.r) r.vx *= -1; if (r.y < r.r || r.y > H - r.r) r.vy *= -1;
          r.x = Math.max(300, Math.min(W, r.x)); r.y = Math.max(r.r, Math.min(H - r.r, r.y));
          for (const s of ships) if (s.stun <= 0 && Math.hypot(s.x - r.x, s.y - r.y) < r.r + s.r) {
            s.stun = 1.4; const d = Math.hypot(s.x - r.x, s.y - r.y) || 1; s.vx = ((s.x - r.x) / d) * 380; s.vy = ((s.y - r.y) / d) * 380;
            for (const id of s.carry) { const a = astros[id]; a.by = null; a.x = s.x; a.y = s.y; a.vx = (ctx.rand() - 0.5) * 120; a.vy = (ctx.rand() - 0.5) * 120; }
            s.carry = []; ctx.fx('crash', { x: Math.round(s.x), y: Math.round(s.y) }); ctx.buzz(s.id, 250); hud();
          }
        }
        for (const a of astros) {
          if (a.saved) continue;
          if (a.by) { const s = ships.find((q) => q.id === a.by)!; const k = s.carry.indexOf(a.id); a.x += (s.x - 26 * (k + 1) * Math.sign(s.vx || 1) - a.x) * 0.2; a.y += (s.y + 14 * k - a.y) * 0.2; }
          else { a.x += a.vx * dt; a.y += a.vy * dt; if (a.x < 260 || a.x > W - 20) a.vx *= -1; if (a.y < 20 || a.y > H - 20) a.vy *= -1; a.x = Math.max(250, Math.min(W - 10, a.x)); }
        }
      },
      snapshot: () => ({ t: r1(time), left: Math.max(0, Math.ceil(TIME - time)), saved, target: TARGET, base, p: ships.map((s) => ({ id: s.id, x: Math.round(s.x), y: Math.round(s.y), c: s.carry.length, st: s.stun > 0 ? 1 : 0, bo: s.boost > 0 ? 1 : 0 })), a: astros.filter((a) => !a.saved).map((a) => [Math.round(a.x), Math.round(a.y), a.by ? 1 : 0, a.id]), r: rocks.map((r) => [Math.round(r.x), Math.round(r.y), Math.round(r.r)]) }),
      isOver: () => saved >= TARGET || time >= TIME,
      standings(): StandingRow[] {
        const stars = saved >= TARGET ? 3 : saved >= TARGET * 0.6 ? 2 : 1;
        return [...ships].sort((a, b) => b.saved - a.saved).map((s) => ({ playerId: s.id, score: s.saved, detail: `${s.saved} 🧑‍🚀 (${saved}/${TARGET})`, stars }));
      },
    };
  },
};

// ---------------- TREASURE EVACUATION (co-op) ----------------
interface Gd { id: number; x: number; y: number; stun: number }
export const evacuationGame: GameModule = {
  id: 'evac',
  create(ctx: GameContext) {
    const TIME = 80;
    const exit = { x: 70, y: H / 2, r: 70 };
    const ring = spawnRing(ctx.players.length, 40, 190, H / 2);
    const ps = ctx.players.map((p, i) => ({ id: p.id, x: ring[i].x, y: ring[i].y, vx: 0, vy: 0, r: 20, m: 1, carry: -1, stun: 0, val: 0, sprint: 100 }));
    const chests = Array.from({ length: 7 }, (_, i) => ({ id: i, x: 420 + ctx.rand() * 720, y: 60 + ctx.rand() * (H - 120), v: 1 + Math.floor(ctx.rand() * 3), by: null as string | null, taken: false }));
    const guards: Gd[] = Array.from({ length: 2 + (ctx.players.length > 3 ? 1 : 0) }, (_, i) => ({ id: i, x: 700 + i * 200, y: 150 + i * 220, stun: 0 }));
    const total = chests.reduce((s, c) => s + c.v, 0);
    let time = 0, got = 0, flood = W + 40;
    const hud = () => ps.forEach((p) => ctx.hud(p.id, { carry: p.carry >= 0 ? chests[p.carry].v : 0, got, total, left: Math.max(0, Math.ceil(TIME - time)), stun: p.stun > 0 ? 1 : 0 }));
    hud();
    return {
      onPress(pid, b) {
        const p = ps.find((q) => q.id === pid); if (!p || p.stun > 0 || b !== BTN.A) return;
        if (p.carry >= 0) { const c = chests[p.carry]; c.by = null; c.x = p.x; c.y = p.y; p.carry = -1; ctx.fx('drop', { id: pid }); hud(); }
        else { const c = chests.find((q) => !q.taken && !q.by && Math.hypot(q.x - p.x, q.y - p.y) < 50); if (c) { c.by = pid; p.carry = c.id; ctx.fx('grab', { id: pid }); hud(); } }
      },
      tick(dt) {
        time += dt;
        flood = W + 40 - Math.max(0, time - 8) * (W - 160) / (TIME - 8);
        for (const p of ps) {
          const i = ctx.input(p.id);
          p.stun = Math.max(0, p.stun - dt);
          const sprint = (i.b & BTN.B) !== 0 && p.sprint > 0 && p.carry < 0;
          p.sprint = Math.max(0, Math.min(100, p.sprint + (sprint ? -50 : 20) * dt));
          const cap = (p.stun > 0 ? 0 : 250) * (p.carry >= 0 ? 0.62 + 0.0 : 1) * (sprint ? 1.4 : 1);
          p.vx += i.x * 2000 * dt; p.vy += i.y * 2000 * dt; damp(p, 0.004, dt);
          const sp = Math.hypot(p.vx, p.vy); if (sp > cap) { p.vx = cap ? p.vx * cap / sp : 0; p.vy = cap ? p.vy * cap / sp : 0; }
          integrate(p, dt); clampA(p, p.r);
          if (p.carry >= 0) { const c = chests[p.carry]; c.x = p.x; c.y = p.y - 26; if (Math.hypot(p.x - exit.x, p.y - exit.y) < exit.r) { c.taken = true; c.by = null; got += c.v; p.val += c.v; p.carry = -1; ctx.fx('score', { id: p.id, v: c.v }); ctx.buzz(p.id, 80); hud(); } }
          if (p.x > flood) { p.stun = 99; } // swept away
        }
        for (const g of guards) {
          g.stun = Math.max(0, g.stun - dt);
          let best: (typeof ps)[number] | null = null, bd = 330;
          for (const p of ps) if (p.stun <= 0) { const d = Math.hypot(p.x - g.x, p.y - g.y); if (d < bd) { bd = d; best = p; } }
          const tx = best ? best.x : g.x + Math.sin(time + g.id * 3) * 60, ty = best ? best.y : g.y + Math.cos(time * 0.7 + g.id) * 60;
          const d = Math.hypot(tx - g.x, ty - g.y) || 1, sp = best ? 190 : 70;
          if (g.stun <= 0) { g.x += ((tx - g.x) / d) * sp * dt; g.y += ((ty - g.y) / d) * sp * dt; }
          g.x = Math.min(g.x, flood - 30);
          if (best && bd < 40 && g.stun <= 0) {
            best.stun = 1.8; g.stun = 1.5;
            if (best.carry >= 0) { const c = chests[best.carry]; c.by = null; c.x = best.x + 30; c.y = best.y; best.carry = -1; }
            ctx.fx('caught', { id: best.id }); ctx.buzz(best.id, 250); hud();
          }
        }
      },
      snapshot: () => ({ t: r1(time), left: Math.max(0, Math.ceil(TIME - time)), got, total, fl: Math.round(flood), exit, p: ps.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), c: p.carry >= 0 ? chests[p.carry].v : 0, st: p.stun > 0 ? 1 : 0, sp: Math.round(p.sprint) })), c: chests.filter((c) => !c.taken).map((c) => ({ id: c.id, x: Math.round(c.x), y: Math.round(c.y), v: c.v, by: c.by ? 1 : 0 })), g: guards.map((g) => ({ id: g.id, x: Math.round(g.x), y: Math.round(g.y), st: g.stun > 0 ? 1 : 0 })) }),
      isOver: () => time >= TIME || got >= total,
      standings(): StandingRow[] {
        const stars = got >= total ? 3 : got >= total * 0.55 ? 2 : 1;
        return [...ps].sort((a, b) => b.val - a.val).map((p) => ({ playerId: p.id, score: p.val, detail: `${p.val} 💰 (${got}/${total})`, stars }));
      },
    };
  },
};

// ---------------- TREASURE HUNT (competitive) ----------------
export const huntGame: GameModule = {
  id: 'treasure',
  create(ctx: GameContext) {
    const TIME = ctx.options.time ?? 75;
    const ring = spawnRing(ctx.players.length, 200, W / 2, H / 2);
    const ps = ctx.players.map((p, i) => ({ id: p.id, x: ring[i].x, y: ring[i].y, vx: 0, vy: 0, r: 22, m: 1, dig: 0, digCd: 0, stun: 0, score: 0, ping: 0, pingCd: 0 }));
    const loot = Array.from({ length: 9 }, (_, i) => ({ id: i, x: 90 + ctx.rand() * (W - 180), y: 90 + ctx.rand() * (H - 180), v: ctx.rand() < 0.2 ? 5 : ctx.rand() < 0.5 ? 3 : 1, found: false }));
    const holes: { x: number; y: number; hit: number }[] = [];
    let time = 0, hudT = 0;
    const near = (p: { x: number; y: number }) => Math.min(...loot.filter((l) => !l.found).map((l) => Math.hypot(l.x - p.x, l.y - p.y)), 9999);
    const hud = () => ps.forEach((p) => ctx.hud(p.id, { score: p.score, warm: Math.max(0, Math.min(1, 1 - near(p) / 420)), left: Math.max(0, Math.ceil(TIME - time)), ping: p.pingCd <= 0 ? 1 : 0 }));
    hud();
    return {
      onPress(pid, b) {
        const p = ps.find((q) => q.id === pid); if (!p || p.stun > 0) return;
        if (b === BTN.A && p.digCd <= 0 && p.dig <= 0) { p.dig = 0.7; ctx.fx('dig', { id: pid }); }
        else if (b === BTN.B && p.pingCd <= 0) { p.pingCd = 7; p.ping = 1.6; ctx.fx('ping', { id: pid }); hud(); }
      },
      tick(dt) {
        time += dt; hudT += dt;
        for (const p of ps) {
          const i = ctx.input(p.id);
          p.digCd = Math.max(0, p.digCd - dt); p.stun = Math.max(0, p.stun - dt); p.ping = Math.max(0, p.ping - dt); p.pingCd = Math.max(0, p.pingCd - dt);
          const digging = p.dig > 0;
          if (digging) {
            p.dig -= dt; p.vx *= 0.5; p.vy *= 0.5;
            if (p.dig <= 0) {
              p.digCd = 0.5;
              const l = loot.find((q) => !q.found && Math.hypot(q.x - p.x, q.y - p.y) < 55);
              if (l) { l.found = true; p.score += l.v; holes.push({ x: p.x, y: p.y, hit: 1 }); ctx.fx('found', { id: p.id, v: l.v, x: Math.round(l.x), y: Math.round(l.y) }); ctx.buzz(p.id, 200); }
              else if (ctx.rand() < 0.15) { p.stun = 1.5; holes.push({ x: p.x, y: p.y, hit: 0 }); ctx.fx('bomb', { id: p.id, x: Math.round(p.x), y: Math.round(p.y) }); }
              else { holes.push({ x: p.x, y: p.y, hit: 0 }); ctx.fx('empty', { id: p.id }); }
              if (holes.length > 60) holes.shift();
              hud();
            }
          } else if (p.stun <= 0) { p.vx += i.x * 1900 * dt; p.vy += i.y * 1900 * dt; }
          damp(p, 0.004, dt);
          const sp = Math.hypot(p.vx, p.vy); if (sp > 270) { p.vx *= 270 / sp; p.vy *= 270 / sp; }
          integrate(p, dt); clampA(p, p.r);
        }
        for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) collide(ps[a], ps[b], 0.4);
        if (hudT > 0.2) { hudT = 0; hud(); }
        if (loot.every((l) => l.found)) time = Math.max(time, TIME);
      },
      snapshot: () => ({ t: r1(time), left: Math.max(0, Math.ceil(TIME - time)), left2: loot.filter((l) => !l.found).length, h: holes.map((h) => [Math.round(h.x), Math.round(h.y), h.hit]), p: ps.map((p) => {
        const tg = p.ping > 0 ? loot.filter((l) => !l.found).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] : null;
        return { id: p.id, x: Math.round(p.x), y: Math.round(p.y), dg: p.dig > 0 ? 1 : 0, st: p.stun > 0 ? 1 : 0, s: p.score, pa: tg ? r1(Math.atan2(tg.y - p.y, tg.x - p.x)) : null };
      }) }),
      isOver: () => time >= TIME,
      standings: (): StandingRow[] => [...ps].sort((a, b) => b.score - a.score).map((p) => ({ playerId: p.id, score: p.score, detail: `${p.score} 💰`, tie: p.score })),
    };
  },
};

// ---------------- TOWER STACK ----------------
export const TOWER = { BASE_W: 220, BLOCK_H: 34, SWING_X: 260 } as const;
export const towerGame: GameModule = {
  id: 'tower',
  create(ctx: GameContext) {
    const TIME = ctx.options.time ?? 75;
    const ps = ctx.players.map((p) => ({ id: p.id, blocks: [{ x: 0, w: TOWER.BASE_W }] as { x: number; w: number }[], w: TOWER.BASE_W as number, ph: ctx.rand() * 6, spd: 1.5, fall: 0, over: false, perfect: 0, drop: -1, dropX: 0 }));
    let time = 0;
    const hud = (p: (typeof ps)[number]) => ctx.hud(p.id, { h: p.blocks.length - 1, perfect: p.perfect, over: p.over ? 1 : 0, left: Math.max(0, Math.ceil(TIME - time)) });
    ps.forEach(hud);
    const swingX = (p: (typeof ps)[number]) => Math.sin(p.ph) * TOWER.SWING_X;
    return {
      onPress(pid, b) {
        const p = ps.find((q) => q.id === pid); if (!p || p.over || b !== BTN.A || p.drop >= 0) return;
        const top = p.blocks[p.blocks.length - 1], x = swingX(p);
        const lo = Math.max(x - p.w / 2, top.x - top.w / 2), hi = Math.min(x + p.w / 2, top.x + top.w / 2);
        if (hi - lo <= 6) { p.over = true; p.fall = 0; p.dropX = x; ctx.fx('collapse', { id: pid }); ctx.buzz(pid, 300); hud(p); return; }
        const perfect = Math.abs(x - top.x) < 7;
        if (perfect) { p.blocks.push({ x: top.x, w: p.w }); p.perfect++; ctx.fx('perfect', { id: pid }); }
        else { p.w = hi - lo; p.blocks.push({ x: (lo + hi) / 2, w: p.w }); ctx.fx('place', { id: pid }); }
        p.spd = Math.min(3.4, p.spd + 0.07); ctx.buzz(pid, 30); hud(p);
      },
      tick(dt) {
        time += dt;
        for (const p of ps) { if (p.over) { p.fall += dt; continue; } p.ph += p.spd * dt; if (time >= TIME) p.over = true; }
        if (Math.floor(time) !== Math.floor(time - dt)) ps.forEach(hud);
      },
      snapshot: () => ({ t: r1(time), left: Math.max(0, Math.ceil(TIME - time)), p: ps.map((p) => ({ id: p.id, b: p.blocks.map((b) => [Math.round(b.x), Math.round(b.w)]), sw: p.over ? null : Math.round(swingX(p)), w: Math.round(p.w), ov: p.over ? 1 : 0, fl: r1(p.fall), h: p.blocks.length - 1, pf: p.perfect })) }),
      isOver: () => time >= TIME || ps.every((p) => p.over),
      standings: (): StandingRow[] => [...ps].sort((a, b) => (b.blocks.length * 10 + b.perfect * 3) - (a.blocks.length * 10 + a.perfect * 3)).map((p) => ({ playerId: p.id, score: p.blocks.length - 1, detail: `${p.blocks.length - 1} 🧱 ${p.perfect ? `· ${p.perfect}✨` : ''}`, tie: p.blocks.length * 10 + p.perfect * 3 })),
    };
  },
};
