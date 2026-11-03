import { BTN } from '../../shared/protocol';
import { ARENA } from '../../shared/minigames';
import { r1 } from '../util';
import { collide, damp, integrate } from './physics';
import { ang, clampArena, fighters, type Fighter, type Shot } from './arena';
import type { GameModule, StandingRow } from './types';

const { W, H } = ARENA;

// ======================= MAGE HILL (was "Wizard Duel") =======================
// Not an elimination brawl: a glowing hill moves around the arena and the wizard who stands on it ALONE scores every second.
// Fireballs knock rivals off the hill (and cost them a heart), the shield blocks, blink jumps. Knocked out? You return in 3 s.
const HILL_SPOTS: [number, number][] = [[600, 350], [250, 190], [950, 190], [250, 520], [950, 520]];
export const HILL_R = 120;

export const wizardGame: GameModule = {
  id: 'wizard',
  create(ctx) {
    const TIME = ctx.options.time ?? 100;
    const fs = fighters(ctx, 3, 24);
    const balls: Shot[] = [];
    const down = new Map<string, number>(); // respawn time
    const pts = new Map(fs.map((f) => [f.id, 0]));
    const acc = new Map(fs.map((f) => [f.id, 0]));
    const face = new Map(fs.map((f) => [f.id, f.a]));
    let time = 0, hill = 0, hillT = 24, hudT = 0, holder: string | null = null;
    const hud = (f: Fighter) => ctx.hud(f.id, { hp: f.hp, pts: pts.get(f.id) ?? 0, fire: f.cd <= 0 ? 1 : 0, shield: f.cd2 <= 0 ? 1 : 0, blink: f.cd3 <= 0 ? 1 : 0, left: Math.max(0, Math.ceil(TIME - time)), down: f.alive ? 0 : 1, on: holder === f.id ? 1 : 0 });
    fs.forEach(hud);
    function knockOut(f: Fighter, by: string | null) {
      f.alive = false; down.set(f.id, time + 3);
      const k = by ? fs.find((x) => x.id === by) : null; if (k && k !== f) { k.kills++; pts.set(k.id, (pts.get(k.id) ?? 0) + 2); }
      ctx.fx('boom', { x: Math.round(f.x), y: Math.round(f.y) }); ctx.buzz(f.id, 200);
    }
    function hurt(f: Fighter, by: string) {
      if (!f.alive || f.inv > 0) return;
      if (f.shield > 0) { ctx.fx('block', { x: Math.round(f.x), y: Math.round(f.y) }); return; }
      f.hp--; f.inv = 0.5; ctx.buzz(f.id, 100);
      if (f.hp <= 0) knockOut(f, by);
      fs.forEach(hud);
    }
    return {
      onPress(pid, b) {
        const f = fs.find((x) => x.id === pid); if (!f || !f.alive) return;
        const a = face.get(pid)!;
        if (b === BTN.A && f.cd <= 0) { f.cd = 0.6; balls.push({ x: f.x + Math.cos(a) * 30, y: f.y + Math.sin(a) * 30, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, o: pid, life: 1.2, b: 0 }); ctx.fx('cast', { id: pid }); hud(f); }
        else if (b === BTN.B && f.cd2 <= 0) { f.cd2 = 4.5; f.shield = 1.2; ctx.fx('shield', { id: pid }); hud(f); }
        else if (b === BTN.C && f.cd3 <= 0) { f.cd3 = 2.6; f.inv = 0.3; f.x += Math.cos(a) * 230; f.y += Math.sin(a) * 230; clampArena(f, f.r); ctx.fx('blink', { id: pid }); hud(f); }
      },
      tick(dt) {
        time += dt; hudT += dt;
        hillT -= dt; if (hillT <= 0) { hillT = 24; hill = (hill + 1 + Math.floor(ctx.rand() * 4)) % HILL_SPOTS.length; ctx.fx('hill', { i: hill }); }
        const hx = HILL_SPOTS[hill][0], hy = HILL_SPOTS[hill][1];
        for (const f of fs) {
          if (!f.alive) { if (time >= (down.get(f.id) ?? 0)) { const e = Math.floor(ctx.rand() * 4); f.alive = true; f.hp = 3; f.inv = 1.5; f.x = e === 0 ? 70 : e === 1 ? W - 70 : 200 + ctx.rand() * 800; f.y = e === 2 ? 70 : e === 3 ? H - 70 : 100 + ctx.rand() * 500; f.vx = f.vy = 0; hud(f); } continue; }
          const i = ctx.input(f.id), mag = Math.hypot(i.x, i.y);
          if (mag > 0.25) face.set(f.id, ang(i.x, i.y));
          f.a = face.get(f.id)!;
          const rdy = [f.cd <= 0, f.cd2 <= 0, f.cd3 <= 0];
          f.cd = Math.max(0, f.cd - dt); f.cd2 = Math.max(0, f.cd2 - dt); f.cd3 = Math.max(0, f.cd3 - dt); f.shield = Math.max(0, f.shield - dt); f.inv = Math.max(0, f.inv - dt);
          f.vx += i.x * 1900 * dt; f.vy += i.y * 1900 * dt; damp(f, 0.012, dt);
          const sp = Math.hypot(f.vx, f.vy); if (sp > 300 && f.inv < 0.4) { f.vx *= 300 / sp; f.vy *= 300 / sp; }
          integrate(f, dt); clampArena(f, f.r);
          if ((!rdy[0] && f.cd <= 0) || (!rdy[1] && f.cd2 <= 0) || (!rdy[2] && f.cd3 <= 0)) hud(f);
        }
        for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) if (fs[i].alive && fs[j].alive) collide(fs[i], fs[j], 0.7);
        for (const s of balls) {
          s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) s.life = 0;
          const hit = fs.find((f) => f.alive && f.id !== s.o && Math.hypot(f.x - s.x, f.y - s.y) < f.r + 12);
          if (hit) s.life = 0;
          if (s.life <= 0 && (hit || (s.x > 0 && s.x < W && s.y > 0 && s.y < H))) {
            ctx.fx('explode', { x: Math.round(s.x), y: Math.round(s.y) });
            for (const f of fs) { const d = Math.hypot(f.x - s.x, f.y - s.y); if (f.alive && f.id !== s.o && d < 95) { hurt(f, s.o); if (d > 1) { f.vx += ((f.x - s.x) / d) * 720; f.vy += ((f.y - s.y) / d) * 720; } } }
          }
        }
        for (let i = balls.length - 1; i >= 0; i--) if (balls[i].life <= 0) balls.splice(i, 1);
        // the hill: exactly one wizard on it = a point per second
        const on = fs.filter((f) => f.alive && Math.hypot(f.x - hx, f.y - hy) < HILL_R);
        const prev = holder;
        holder = on.length === 1 ? on[0].id : null;
        if (holder !== prev) fs.forEach(hud);
        if (holder) { acc.set(holder, (acc.get(holder) ?? 0) + dt); if ((acc.get(holder) ?? 0) >= 1) { acc.set(holder, (acc.get(holder) ?? 0) - 1); pts.set(holder, (pts.get(holder) ?? 0) + 1); } }
        if (hudT > 1) { hudT = 0; fs.forEach(hud); }
      },
      snapshot: () => ({
        t: r1(time), left: Math.max(0, Math.ceil(TIME - time)), hill, hr: HILL_R, hold: holder, nh: Math.ceil(hillT),
        p: fs.map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y), a: r1(f.a), hp: f.hp, mh: f.maxHp, sh: f.shield > 0 ? 1 : 0, al: f.alive ? 1 : 0, s: pts.get(f.id) ?? 0 })),
        s: balls.map((s) => [Math.round(s.x), Math.round(s.y)]),
      }),
      isOver: () => time >= TIME,
      standings: (): StandingRow[] => [...fs].sort((a, b) => (pts.get(b.id) ?? 0) - (pts.get(a.id) ?? 0) || b.kills - a.kills).map((f) => ({ playerId: f.id, score: pts.get(f.id) ?? 0, detail: `${pts.get(f.id) ?? 0} pts · ${f.kills} KO`, tie: (pts.get(f.id) ?? 0) * 10 + f.kills })),
    };
  },
};

// ======================= ZOMBIE SURVIVAL (was "Arena Survival") =======================
// Co-op waves of cartoon zombies: slow walkers, fast runners, big brutes. SLASH swings an arc, ROLL dodges. A teammate standing next
// to you revives you. Zombies poof into green smoke (no gore). Hearts drop now and then.
interface Zom { id: number; x: number; y: number; hp: number; k: number; sp: number; r: number; hit: number; bite: number; ph: number }
const ZK = { hp: [1, 1, 4], sp: [78, 150, 52], r: [20, 17, 32] } as const;

export const survivalGame: GameModule = {
  id: 'survival',
  create(ctx) {
    const WAVES = ctx.options.waves ?? 6;
    const fs = fighters(ctx, 5, 24);
    const zs: Zom[] = [];
    const hearts: { x: number; y: number; ttl: number }[] = [];
    let time = 0, wave = 0, toSpawn = 0, spawnT = 2, nextWave = 3, zid = 0, over = false, won = false, hudT = 0;
    const nAlive = () => fs.filter((f) => f.alive).length;
    const hudAll = () => fs.forEach((f) => ctx.hud(f.id, { hp: f.hp, wave, waves: WAVES, atk: f.cd <= 0 ? 1 : 0, alt: f.cd2 <= 0 ? 1 : 0, down: f.alive ? 0 : 1, def: 0 }));
    hudAll();
    function spawn() {
      for (let tries = 0; tries < 6; tries++) {
        const side = Math.floor(ctx.rand() * 4);
        const x = side === 0 ? -20 : side === 1 ? W + 20 : 60 + ctx.rand() * (W - 120), y = side === 2 ? -20 : side === 3 ? H + 20 : 60 + ctx.rand() * (H - 120);
        if (tries < 5 && fs.some((f) => f.alive && Math.hypot(f.x - x, f.y - y) < 260)) continue; // never right on top of someone
        const roll = ctx.rand();
        const k = wave >= 3 && roll < 0.16 ? 2 : wave >= 2 && roll < 0.46 ? 1 : 0;
        zs.push({ id: zid++, x, y, hp: ZK.hp[k], k, sp: ZK.sp[k] + wave * 5 + ctx.rand() * 14, r: ZK.r[k], hit: 0, bite: 0, ph: ctx.rand() * 6 });
        return;
      }
    }
    function kill(z: Zom, by: string) {
      const f = fs.find((q) => q.id === by); if (f) f.kills++;
      ctx.fx('pop', { x: Math.round(z.x), y: Math.round(z.y), z: z.k });
      zs.splice(zs.indexOf(z), 1);
      if (ctx.rand() < (z.k === 2 ? 0.7 : 0.1)) hearts.push({ x: z.x, y: z.y, ttl: 12 });
    }
    return {
      onPress(pid, b) {
        const f = fs.find((x) => x.id === pid); if (!f || !f.alive) return;
        if (b === BTN.A && f.cd <= 0) {
          f.cd = 0.42; ctx.fx('slash', { id: pid, a: r1(f.a) });
          for (const z of [...zs]) {
            const dx = z.x - f.x, dy = z.y - f.y, d = Math.hypot(dx, dy);
            if (d < 115 + z.r && Math.cos(ang(dx, dy) - f.a) > -0.2) { z.hp -= 1; z.hit = 0.3; if (d > 1) { z.x += (dx / d) * 40; z.y += (dy / d) * 40; } if (z.hp <= 0) kill(z, pid); }
          }
          hudAll();
        } else if (b === BTN.B && f.cd2 <= 0) { f.cd2 = 1.8; f.inv = 0.55; f.vx += Math.cos(f.a) * 760; f.vy += Math.sin(f.a) * 760; ctx.fx('roll', { id: pid }); hudAll(); }
      },
      tick(dt) {
        time += dt; hudT += dt;
        for (const f of fs) {
          const i = ctx.input(f.id);
          f.cd = Math.max(0, f.cd - dt); f.cd2 = Math.max(0, f.cd2 - dt); f.inv = Math.max(0, f.inv - dt);
          if (!f.alive) { // revive: a teammate stands close for 2.2 s
            const near = fs.some((q) => q.alive && Math.hypot(q.x - f.x, q.y - f.y) < 80);
            f.cd3 = near ? f.cd3 + dt : Math.max(0, f.cd3 - dt * 1.5);
            if (f.cd3 >= 2.2) { f.alive = true; f.hp = 3; f.cd3 = 0; f.inv = 2; ctx.fx('revive', { id: f.id }); hudAll(); }
            continue;
          }
          if (Math.hypot(i.x, i.y) > 0.25) f.a = ang(i.x, i.y);
          f.vx += i.x * 2000 * dt; f.vy += i.y * 2000 * dt; damp(f, 0.008, dt);
          const sp = Math.hypot(f.vx, f.vy); if (sp > 300 && f.inv <= 0.1) { f.vx *= 300 / sp; f.vy *= 300 / sp; }
          integrate(f, dt); clampArena(f, f.r);
        }
        if (!zs.length && toSpawn <= 0 && !over) { nextWave -= dt; if (nextWave <= 0) { if (wave >= WAVES) { over = true; won = true; } else { wave++; toSpawn = 4 + wave * 2 + fs.length * 2; nextWave = 3.5; ctx.fx('wave', { n: wave }); hudAll(); } } }
        if (toSpawn > 0 && zs.length < 7 + wave * 2 + fs.length) { spawnT -= dt; if (spawnT <= 0) { spawn(); toSpawn--; spawnT = Math.max(0.45, 1.5 - wave * 0.11); } }
        for (const z of zs) {
          z.hit = Math.max(0, z.hit - dt); z.bite = Math.max(0, z.bite - dt);
          let best: Fighter | null = null, bd = Infinity;
          for (const f of fs) if (f.alive) { const d = Math.hypot(f.x - z.x, f.y - z.y); if (d < bd) { bd = d; best = f; } }
          if (!best) continue;
          const dx = best.x - z.x, dy = best.y - z.y, d = bd || 1;
          const slow = z.hit > 0 || z.bite > 0.4 ? 0.1 : 1; // stunned by a hit, or busy biting
          const wob = Math.sin(time * 3 + z.ph) * 0.35; // the shamble: they wander a little, so they are dodgeable
          const ux = dx / d, uy = dy / d;
          z.x += (ux * Math.cos(wob) - uy * Math.sin(wob)) * z.sp * slow * dt; z.y += (uy * Math.cos(wob) + ux * Math.sin(wob)) * z.sp * slow * dt;
          if (d < z.r + best.r - 2 && z.bite <= 0 && best.inv <= 0) {
            z.bite = 0.9; best.hp--; best.inv = 1; best.vx += (dx / d) * 260; best.vy += (dy / d) * 260; ctx.buzz(best.id, 140); ctx.fx('hurt', { id: best.id });
            if (best.hp <= 0) { best.alive = false; best.cd3 = 0; ctx.fx('down', { id: best.id }); }
            hudAll();
          }
        }
        for (let a = 0; a < zs.length; a++) for (let b = a + 1; b < zs.length; b++) { // zombies do not stack
          const dx = zs[b].x - zs[a].x, dy = zs[b].y - zs[a].y, d = Math.hypot(dx, dy), min = zs[a].r + zs[b].r - 6;
          if (d < min && d > 0.01) { const p = (min - d) / 2; zs[a].x -= (dx / d) * p; zs[a].y -= (dy / d) * p; zs[b].x += (dx / d) * p; zs[b].y += (dy / d) * p; }
        }
        for (let i = hearts.length - 1; i >= 0; i--) {
          const h = hearts[i]; h.ttl -= dt;
          const f = fs.find((q) => q.alive && q.hp < q.maxHp && Math.hypot(q.x - h.x, q.y - h.y) < q.r + 16);
          if (f) { f.hp++; hearts.splice(i, 1); ctx.fx('heal', { id: f.id }); hudAll(); } else if (h.ttl <= 0) hearts.splice(i, 1);
        }
        if (nAlive() === 0) over = true;
        if (time > 300) over = true;
        if (hudT > 1) { hudT = 0; hudAll(); }
      },
      snapshot: () => ({
        t: r1(time), wave, waves: WAVES, won: won ? 1 : 0, left: zs.length + toSpawn, nw: wave === 0 || (!zs.length && toSpawn <= 0) ? Math.ceil(nextWave) : 0,
        mh: 5, p: fs.map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y), a: r1(f.a), hp: f.hp, ...(f.alive ? {} : { al: 0, rv: r1(f.cd3 / 2.2) }), ...(f.inv > 0 && f.alive ? { iv: 1 } : {}) })),
        e: zs.map((z) => ({ id: z.id, x: Math.round(z.x), y: Math.round(z.y), r: z.r, k: z.k, h: z.hit > 0 ? 1 : 0, b: z.bite > 0.4 ? 1 : 0 })),
        hp: hearts.map((h) => [Math.round(h.x), Math.round(h.y)]),
      }),
      isOver: () => over,
      standings(): StandingRow[] {
        const stars = won ? 3 : wave >= Math.ceil(WAVES * 0.6) ? 2 : 1;
        return [...fs].sort((a, b) => b.kills - a.kills).map((f) => ({ playerId: f.id, score: f.kills, detail: `${f.kills} · ${won ? 'WIN' : `wave ${wave}/${WAVES}`}`, stars }));
      },
    };
  },
};

// ======================= FREEZE TAG (was "Tag Chaos") =======================
// Asymmetric: one (two with 6+) FREEZER chases, everybody else are runners. A touched runner turns to ice. Another runner who stands
// next to the ice for a moment thaws them. Points: runners earn for time free and rescues, freezers earn per freeze.
export const tagGame: GameModule = {
  id: 'tag',
  create(ctx) {
    const TIME = ctx.options.time ?? 75;
    const fs = fighters(ctx, 1, 24);
    const nF = fs.length >= 6 ? 2 : 1;
    const pick = fs.map((f) => f.id).sort(() => ctx.rand() - 0.5).slice(0, nF);
    const isF = (id: string) => pick.includes(id);
    const frozen = new Map<string, number>(); // runner -> thaw progress 0..1 (present while frozen)
    const pts = new Map(fs.map((f) => [f.id, 0]));
    const acc = new Map(fs.map((f) => [f.id, 0]));
    const stam = new Map(fs.map((f) => [f.id, 100]));
    let time = 0, hudT = 0, over = false, allFrozenAt = -1;
    const add = (id: string, n: number) => pts.set(id, (pts.get(id) ?? 0) + n);
    const hud = () => fs.forEach((f) => ctx.hud(f.id, { role: isF(f.id) ? 1 : 0, fz: frozen.has(f.id) ? 1 : 0, pts: Math.round(pts.get(f.id) ?? 0), left: Math.max(0, Math.ceil(TIME - time)), stam: Math.round(stam.get(f.id) ?? 0), free: fs.filter((x) => !isF(x.id) && !frozen.has(x.id)).length }));
    hud();
    fs.forEach((f, i) => { if (isF(f.id)) { f.x = W / 2; f.y = H / 2; } else { const a = (i / fs.length) * Math.PI * 2; f.x = W / 2 + Math.cos(a) * 420; f.y = H / 2 + Math.sin(a) * 250; } });
    return {
      tick(dt) {
        time += dt; hudT += dt;
        for (const f of fs) {
          const i = ctx.input(f.id), fr = isF(f.id);
          if (frozen.has(f.id)) { f.vx = f.vy = 0; continue; }
          const sprint = (i.b & BTN.A) !== 0 && (stam.get(f.id) ?? 0) > 0;
          stam.set(f.id, Math.max(0, Math.min(100, (stam.get(f.id) ?? 0) + (sprint ? -42 : 16) * dt)));
          const cap = (fr ? 292 : 280) * (sprint ? 1.4 : 1);
          f.vx += i.x * 2300 * dt; f.vy += i.y * 2300 * dt; damp(f, 0.005, dt);
          const sp = Math.hypot(f.vx, f.vy); if (sp > cap) { f.vx *= cap / sp; f.vy *= cap / sp; }
          integrate(f, dt); clampArena(f, f.r);
        }
        for (let a = 0; a < fs.length; a++) for (let b = a + 1; b < fs.length; b++) if (!frozen.has(fs[a].id) && !frozen.has(fs[b].id)) collide(fs[a], fs[b], 0.5);
        // freezing
        for (const t of fs) if (isF(t.id)) for (const r of fs) {
          if (isF(r.id) || frozen.has(r.id)) continue;
          if (Math.hypot(t.x - r.x, t.y - r.y) < t.r + r.r + 2) { frozen.set(r.id, 0); add(t.id, 4); ctx.fx('freeze', { id: r.id, x: Math.round(r.x), y: Math.round(r.y) }); ctx.buzz(r.id, 250); hud(); }
        }
        // thawing: a free runner next to the ice
        for (const [id, prog] of [...frozen]) {
          const ice = fs.find((f) => f.id === id)!;
          const helper = fs.find((h) => !isF(h.id) && !frozen.has(h.id) && Math.hypot(h.x - ice.x, h.y - ice.y) < 70);
          const np = helper ? Math.min(1, prog + dt / 1.2) : Math.max(0, prog - dt * 0.5);
          if (np >= 1 && helper) { frozen.delete(id); add(helper.id, 5); ice.inv = 1; ctx.fx('thaw', { id, x: Math.round(ice.x), y: Math.round(ice.y) }); hud(); } else frozen.set(id, np);
        }
        // score: free runners earn a point per second
        for (const f of fs) if (!isF(f.id) && !frozen.has(f.id)) { acc.set(f.id, (acc.get(f.id) ?? 0) + dt); if ((acc.get(f.id) ?? 0) >= 1) { acc.set(f.id, (acc.get(f.id) ?? 0) - 1); add(f.id, 1); } }
        const runners = fs.filter((f) => !isF(f.id));
        if (runners.length && runners.every((r) => frozen.has(r.id))) { if (allFrozenAt < 0) allFrozenAt = time; if (time - allFrozenAt > 1.5) { for (const t of fs) if (isF(t.id)) add(t.id, 20); ctx.fx('allfrozen', {}); over = true; } } else allFrozenAt = -1;
        if (time >= TIME) over = true;
        if (hudT > 0.6) { hudT = 0; hud(); }
      },
      snapshot: () => ({
        t: r1(time), left: Math.max(0, Math.ceil(TIME - time)),
        p: fs.map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y), fr: isF(f.id) ? 1 : 0, ic: frozen.has(f.id) ? 1 : 0, th: r1(frozen.get(f.id) ?? 0), st: Math.round(stam.get(f.id) ?? 0), s: Math.round(pts.get(f.id) ?? 0) })),
      }),
      isOver: () => over,
      standings: (): StandingRow[] => [...fs].sort((a, b) => (pts.get(b.id) ?? 0) - (pts.get(a.id) ?? 0)).map((f) => ({ playerId: f.id, score: Math.round(pts.get(f.id) ?? 0), detail: `${Math.round(pts.get(f.id) ?? 0)} pts${isF(f.id) ? ' (freezer)' : ''}`, tie: Math.round(pts.get(f.id) ?? 0) })),
    };
  },
};
