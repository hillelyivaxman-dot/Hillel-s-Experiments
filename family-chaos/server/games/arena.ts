import { BTN } from '../../shared/protocol';
import { ARENA, circRect, TANK_WALLS } from '../../shared/minigames';
import { r1 } from '../util';
import { collide, damp, integrate, spawnRing, type Body } from './physics';
import type { GameContext, GameModule, StandingRow } from './types';

// Arena games on one 1200x700 floor: TANK BATTLE, WIZARD DUEL (last one alive wins),
// ARENA SURVIVAL and BASE DEFENSE (co-op waves) and TAG CHAOS (do not be "it").
const { W, H } = ARENA;
export const clampArena = (b: { x: number; y: number }, r: number) => { b.x = Math.max(r, Math.min(W - r, b.x)); b.y = Math.max(r, Math.min(H - r, b.y)); };
export const ang = (dx: number, dy: number) => Math.atan2(dy, dx);
export function turnTo(a: number, to: number, rate: number) { let d = to - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + Math.max(-rate, Math.min(rate, d)); }

export interface Fighter extends Body { id: string; a: number; hp: number; maxHp: number; cd: number; cd2: number; cd3: number; shield: number; inv: number; alive: boolean; diedAt: number; kills: number; dmg: number }
export interface Shot { x: number; y: number; vx: number; vy: number; o: string; life: number; b: number }

export function fighters(ctx: GameContext, hp: number, r: number): Fighter[] {
  const ring = spawnRing(ctx.players.length, 270, W / 2, H / 2);
  return ctx.players.map((p, i) => ({ id: p.id, x: ring[i].x, y: ring[i].y, vx: 0, vy: 0, r, m: 1, a: ang(W / 2 - ring[i].x, H / 2 - ring[i].y), hp, maxHp: hp, cd: 0, cd2: 0, cd3: 0, shield: 0, inv: 0, alive: true, diedAt: -1, kills: 0, dmg: 0 }));
}
function eliminationStandings(fs: Fighter[], time: number): StandingRow[] {
  return [...fs].sort((a, b) => (b.alive ? 1e9 + b.hp * 100 + b.kills : b.diedAt) - (a.alive ? 1e9 + a.hp * 100 + a.kills : a.diedAt))
    .map((f) => ({ playerId: f.id, score: f.kills, detail: `${f.kills} :cross: ${f.alive ? ':crown:' : ''}`, tie: f.alive ? 1e9 + f.hp * 100 + f.kills : Math.round(f.diedAt * 5) }));
}

// ---------------- TANK BATTLE ----------------
export const tankGame: GameModule = {
  id: 'tank',
  create(ctx) {
    const fs = fighters(ctx, 3, 24);
    const shots: Shot[] = [];
    const mines: { x: number; y: number; o: string; arm: number }[] = [];
    let time = 0, over = false;
    const hud = (f: Fighter) => ctx.hud(f.id, { hp: f.hp, fire: f.cd <= 0 ? 1 : 0, mine: f.cd2 <= 0 ? 1 : 0, left: fs.filter((x) => x.alive).length });
    fs.forEach(hud);
    function hurt(f: Fighter, n: number, by: string) {
      if (!f.alive) return;
      f.hp -= n; ctx.buzz(f.id, 120);
      const k = fs.find((x) => x.id === by); if (k && k !== f) k.dmg += n;
      if (f.hp <= 0) { f.alive = false; f.diedAt = time; if (k && k !== f) k.kills++; ctx.fx('boom', { x: Math.round(f.x), y: Math.round(f.y) }); }
      else ctx.fx('hit', { x: Math.round(f.x), y: Math.round(f.y) });
      fs.forEach(hud);
    }
    return {
      onPress(pid, b) {
        const f = fs.find((x) => x.id === pid); if (!f || !f.alive) return;
        if (b === BTN.A && f.cd <= 0) { f.cd = 0.65; shots.push({ x: f.x + Math.cos(f.a) * 34, y: f.y + Math.sin(f.a) * 34, vx: Math.cos(f.a) * 620, vy: Math.sin(f.a) * 620, o: f.id, life: 1.7, b: 1 }); ctx.fx('fire', { id: f.id }); hud(f); }
        if (b === BTN.B && f.cd2 <= 0 && mines.filter((m) => m.o === f.id).length < 2) { f.cd2 = 4; mines.push({ x: f.x - Math.cos(f.a) * 34, y: f.y - Math.sin(f.a) * 34, o: f.id, arm: 1 }); ctx.fx('mine', { id: f.id }); hud(f); }
      },
      tick(dt) {
        time += dt;
        for (const f of fs) {
          if (!f.alive) continue;
          const i = ctx.input(f.id), mag = Math.hypot(i.x, i.y);
          const hadC = f.cd <= 0, hadM = f.cd2 <= 0;
          f.cd = Math.max(0, f.cd - dt); f.cd2 = Math.max(0, f.cd2 - dt);
          if (mag > 0.25) {
            const want = ang(i.x, i.y);
            f.a = turnTo(f.a, want, 4.6 * dt);
            const align = Math.max(0, Math.cos(f.a - want));
            f.vx = Math.cos(f.a) * 230 * Math.min(1, mag) * align; f.vy = Math.sin(f.a) * 230 * Math.min(1, mag) * align;
          } else { f.vx *= 0.7; f.vy *= 0.7; }
          integrate(f, dt); clampArena(f, f.r);
          for (const w of TANK_WALLS) circRect(f, f.r, w);
          if ((!hadC && f.cd <= 0) || (!hadM && f.cd2 <= 0)) hud(f);
        }
        for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) if (fs[i].alive && fs[j].alive) collide(fs[i], fs[j], 0.2);
        for (const s of shots) {
          s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.x < 0 || s.x > W) { s.vx = -s.vx; s.x = Math.max(0, Math.min(W, s.x)); s.b--; }
          if (s.y < 0 || s.y > H) { s.vy = -s.vy; s.y = Math.max(0, Math.min(H, s.y)); s.b--; }
          for (const w of TANK_WALLS) if (s.x > w.x && s.x < w.x + w.w && s.y > w.y && s.y < w.y + w.h) {
            const fromSide = Math.min(s.x - w.x, w.x + w.w - s.x) < Math.min(s.y - w.y, w.y + w.h - s.y);
            if (fromSide) { s.vx = -s.vx; s.x += s.vx * dt * 2; } else { s.vy = -s.vy; s.y += s.vy * dt * 2; }
            s.b--; ctx.fx('ricochet', { x: Math.round(s.x), y: Math.round(s.y) });
          }
          for (const f of fs) if (f.alive && f.id !== s.o && Math.hypot(f.x - s.x, f.y - s.y) < f.r + 6) { hurt(f, 1, s.o); s.life = 0; }
          if (s.b < 0) s.life = 0;
        }
        for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
        for (let i = mines.length - 1; i >= 0; i--) {
          const m = mines[i]; m.arm = Math.max(0, m.arm - dt);
          if (m.arm > 0) continue;
          const v = fs.find((f) => f.alive && Math.hypot(f.x - m.x, f.y - m.y) < f.r + 12);
          if (v) { mines.splice(i, 1); ctx.fx('boom', { x: Math.round(m.x), y: Math.round(m.y) }); hurt(v, 2, m.o); }
        }
        if (fs.filter((f) => f.alive).length <= (fs.length > 1 ? 1 : 0) || time > 150) over = true;
      },
      snapshot: () => ({ t: r1(time), p: fs.map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y), a: r1(f.a), hp: f.hp, al: f.alive ? 1 : 0 })), s: shots.map((s) => [Math.round(s.x), Math.round(s.y)]), m: mines.map((m) => [Math.round(m.x), Math.round(m.y), m.arm > 0 ? 0 : 1]) }),
      isOver: () => over,
      standings: () => eliminationStandings(fs, time),
    };
  },
};

// ---------------- co-op waves: ARENA SURVIVAL / BASE DEFENSE ----------------
interface Foe { id: number; x: number; y: number; hp: number; sp: number; r: number; t: number; hit: number }
function coopWaves(id: 'defense'): GameModule {
  return {
    id,
    create(ctx) {
      const defense = id === 'defense';
      const fs = fighters(ctx, 3, 24);
      const foes: Foe[] = [];
      const shots: Shot[] = [];
      const core = { x: W / 2, y: H / 2, hp: 20 };
      const turrets: { x: number; y: number; cd: number; o: string }[] = [];
      const coins = new Map(fs.map((f) => [f.id, 0]));
      const WAVES = ctx.options.waves ?? 6;
      let time = 0, wave = 0, toSpawn = 0, spawnT = 2, nextWave = 3, fid = 0, over = false, won = false, downs = 0;
      const nAlive = () => fs.filter((f) => f.alive).length;
      const hud = (f: Fighter) => ctx.hud(f.id, { hp: f.hp, wave, waves: WAVES, atk: f.cd <= 0 ? 1 : 0, alt: defense ? (coins.get(f.id) ?? 0) : f.cd2 <= 0 ? 1 : 0, core: core.hp, down: f.alive ? 0 : 1, def: defense ? 1 : 0 });
      fs.forEach(hud);
      const hudAll = () => fs.forEach(hud);
      function spawnFoe() {
        const side = Math.floor(ctx.rand() * 4);
        const x = side === 0 ? -20 : side === 1 ? W + 20 : ctx.rand() * W, y = side === 2 ? -20 : side === 3 ? H + 20 : ctx.rand() * H;
        const tough = wave >= 4 && ctx.rand() < 0.3;
        foes.push({ id: fid++, x, y, hp: tough ? 3 : 1, sp: (tough ? 65 : 80) + wave * 8 + ctx.rand() * 20, r: tough ? 28 : 20, t: tough ? 1 : 0, hit: 0 });
      }
      function kill(fo: Foe, by: string) {
        const f = fs.find((q) => q.id === by); if (f) { f.kills++; coins.set(by, (coins.get(by) ?? 0) + 1); }
        ctx.fx('pop', { x: Math.round(fo.x), y: Math.round(fo.y), t: fo.t }); foes.splice(foes.indexOf(fo), 1); hudAll();
      }
      return {
        onPress(pid, b) {
          const f = fs.find((x) => x.id === pid); if (!f || !f.alive) return;
          if (!defense && b === BTN.A && f.cd <= 0) { // slash: hits everything near, knocks back
            f.cd = 0.45; ctx.fx('slash', { id: pid, a: r1(f.a) });
            for (const fo of [...foes]) { const d = Math.hypot(fo.x - f.x, fo.y - f.y); if (d < 105 && Math.abs(Math.cos(ang(fo.x - f.x, fo.y - f.y) - f.a)) > 0 && Math.cos(ang(fo.x - f.x, fo.y - f.y) - f.a) > -0.3) { fo.hp--; fo.hit = 0.25; if (fo.hp <= 0) kill(fo, pid); } }
            hud(f);
          } else if (!defense && b === BTN.B && f.cd2 <= 0) { f.cd2 = 2.2; f.inv = 0.5; f.vx += Math.cos(f.a) * 700; f.vy += Math.sin(f.a) * 700; ctx.fx('roll', { id: pid }); hud(f); }
          else if (defense && b === BTN.A && f.cd <= 0) { f.cd = 0.3; shots.push({ x: f.x, y: f.y, vx: Math.cos(f.a) * 700, vy: Math.sin(f.a) * 700, o: pid, life: 0.9, b: 0 }); ctx.fx('fire', { id: pid }); hud(f); }
          else if (defense && b === BTN.B && (coins.get(pid) ?? 0) >= 4) { coins.set(pid, (coins.get(pid) ?? 0) - 4); turrets.push({ x: f.x, y: f.y, cd: 0, o: pid }); ctx.fx('turret', { id: pid }); hud(f); }
        },
        tick(dt) {
          time += dt;
          for (const f of fs) {
            const i = ctx.input(f.id);
            f.cd = Math.max(0, f.cd - dt); f.cd2 = Math.max(0, f.cd2 - dt); f.inv = Math.max(0, f.inv - dt);
            if (!f.alive) { // revive: a teammate stands close for 2.5 s
              const near = fs.some((q) => q.alive && Math.hypot(q.x - f.x, q.y - f.y) < 70);
              f.diedAt = near ? f.diedAt : f.diedAt; f.cd3 = near ? f.cd3 + dt : Math.max(0, f.cd3 - dt);
              if (f.cd3 >= 2.5) { f.alive = true; f.hp = 2; f.cd3 = 0; f.inv = 1.5; ctx.fx('revive', { id: f.id }); hudAll(); }
              continue;
            }
            if (Math.hypot(i.x, i.y) > 0.25) f.a = ang(i.x, i.y);
            f.vx += i.x * 1900 * dt; f.vy += i.y * 1900 * dt; damp(f, 0.008, dt);
            const sp = Math.hypot(f.vx, f.vy), cap = defense ? 280 : 300; if (sp > cap && f.inv <= 0.1) { f.vx *= cap / sp; f.vy *= cap / sp; }
            integrate(f, dt); clampArena(f, f.r);
            for (const fo of foes) if (f.inv <= 0 && Math.hypot(fo.x - f.x, fo.y - f.y) < fo.r + f.r - 4) {
              f.hp--; f.inv = 1; f.vx += (f.x - fo.x) * 6; f.vy += (f.y - fo.y) * 6; ctx.buzz(f.id, 150); ctx.fx('hurt', { id: f.id });
              if (f.hp <= 0) { f.alive = false; f.cd3 = 0; downs++; ctx.fx('down', { id: f.id }); }
              hudAll();
            }
          }
          // waves
          if (!foes.length && toSpawn <= 0 && !over) { nextWave -= dt; if (nextWave <= 0) { if (wave >= WAVES) { over = true; won = true; } else { wave++; toSpawn = 3 + wave * 2 + fs.length; nextWave = 3; ctx.fx('wave', { n: wave }); hudAll(); } } }
          if (toSpawn > 0) { spawnT -= dt; if (spawnT <= 0) { spawnFoe(); toSpawn--; spawnT = Math.max(0.35, 1.3 - wave * 0.1); } }
          for (const fo of foes) {
            fo.hit = Math.max(0, fo.hit - dt);
            let tx = core.x, ty = core.y;
            if (!defense) { let best = Infinity; for (const f of fs) if (f.alive) { const d = Math.hypot(f.x - fo.x, f.y - fo.y); if (d < best) { best = d; tx = f.x; ty = f.y; } } }
            const d = Math.hypot(tx - fo.x, ty - fo.y) || 1;
            const k = fo.hit > 0 ? -0.5 : 1;
            fo.x += ((tx - fo.x) / d) * fo.sp * k * dt; fo.y += ((ty - fo.y) / d) * fo.sp * k * dt;
            if (defense && d < 50 + fo.r) { core.hp--; ctx.fx('corehit', {}); foes.splice(foes.indexOf(fo), 1); hudAll(); }
          }
          for (const s of shots) {
            s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
            const fo = foes.find((q) => Math.hypot(q.x - s.x, q.y - s.y) < q.r + 6);
            if (fo) { s.life = 0; fo.hp--; fo.hit = 0.15; if (fo.hp <= 0) kill(fo, s.o); }
          }
          for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
          for (const tu of turrets) { tu.cd -= dt; if (tu.cd <= 0) { const fo = foes.find((q) => Math.hypot(q.x - tu.x, q.y - tu.y) < 300); if (fo) { tu.cd = 0.55; const a = ang(fo.x - tu.x, fo.y - tu.y); shots.push({ x: tu.x, y: tu.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, o: tu.o, life: 0.7, b: 0 }); } } }
          if (nAlive() === 0 || (defense && core.hp <= 0)) over = true;
          if (time > 240) over = true;
        },
        snapshot: () => ({
          t: r1(time), wave, waves: WAVES, core: defense ? core : null, won: won ? 1 : 0,
          p: fs.map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y), a: r1(f.a), hp: f.hp, al: f.alive ? 1 : 0, rv: r1(f.cd3 / 2.5), k: f.kills })),
          e: foes.map((q) => ({ id: q.id, x: Math.round(q.x), y: Math.round(q.y), r: q.r, t: q.t, h: q.hit > 0 ? 1 : 0 })),
          s: shots.map((s) => [Math.round(s.x), Math.round(s.y)]), tu: turrets.map((q) => [Math.round(q.x), Math.round(q.y)]),
        }),
        isOver: () => over,
        standings(): StandingRow[] {
          // co-op: stars by how far the team got
          const stars = won ? 3 : wave >= Math.ceil(WAVES * 0.6) ? 2 : 1;
          return [...fs].sort((a, b) => b.kills - a.kills).map((f) => ({ playerId: f.id, score: f.kills, detail: `${f.kills} :cross: · ${won ? ':trophy:' : `wave ${wave}`}`, stars }));
        },
      };
    },
  };
}
export const defenseGame = coopWaves('defense');

