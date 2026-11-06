import { BTN } from '../../shared/protocol';
import { BD, KINDS, waveList } from '../../shared/basedefense';
import { r1 } from '../util';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// BASE DEFENSE: a co-operative wave game. Everybody defends the core together. Defenders shoot by themselves; each role has one
// special (Gunner BURST, Builder TURRET, Tank SHOCK, Medic HEAL). Kills drop scrap into a shared pool: build turrets (Builder) or
// buy team upgrades (UPGRADE). Survive all the waves to win; the stars are shared by the whole team.
export { BD };
interface P { id: string; role: number; x: number; y: number; hp: number; down: number; act: number; fire: number; sprint: number; sprintCd: number; kills: number; face: number }
interface E { id: number; k: number; x: number; y: number; hp: number; max: number; slow: number }
interface T { x: number; y: number; fire: number }

const ROLE_SPEED = [1, 0.95, 0.85, 1.12];
const ROLE_CD = [8, 1, 6, 7];

export const baseDefenseGame: GameModule = {
  id: 'basedefense',
  create(ctx: GameContext): GameInstance {
    const totalWaves = ctx.options.waves ?? 8;
    const n = ctx.players.length;
    let time = 0, wave = 0, coreHp: number = BD.CORE_HP, scrap = 30, up = 0, over = false, won = false;
    let queue: number[] = [], spawnT = 0, breakT = 3, nextId = 1, hudT = 0;
    const es: E[] = [], ts: T[] = [];
    const ps: P[] = ctx.players.map((p, i) => {
      const a = (i / n) * Math.PI * 2;
      return { id: p.id, role: i % 4, x: BD.CORE_X + Math.cos(a) * 130, y: BD.CORE_Y + Math.sin(a) * 130, hp: 100, down: 0, act: 0, fire: 0, sprint: 0, sprintCd: 0, kills: 0, face: 0 };
    });
    const byId = new Map(ps.map((p) => [p.id, p]));
    const dmgMul = () => 1 + 0.3 * up;
    const upCost = () => BD.UP_BASE + BD.UP_STEP * up;

    function hud(p: P) {
      ctx.hud(p.id, { role: p.role, hp: Math.max(0, Math.round(p.hp)), down: p.down > 0 ? Math.ceil(p.down) : 0, core: Math.max(0, Math.round(coreHp)), wave, of: totalWaves, scrap, up, ucost: up >= BD.UP_MAX ? 0 : upCost(), act: p.act <= 0 ? 1 : 0, left: es.length + queue.length, br: breakT > 0 && es.length === 0 && queue.length === 0 ? Math.ceil(breakT) : 0 });
    }
    ps.forEach(hud);

    function startWave() {
      wave++;
      queue = waveList(wave, n);
      for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(ctx.rand() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
      spawnT = 0.5;
      ctx.fx('wave', { n: wave });
    }
    function spawn(k: number) {
      const side = Math.floor(ctx.rand() * 4), u = ctx.rand();
      const x = side === 0 ? -30 : side === 1 ? BD.W + 30 : u * BD.W, y = side === 2 ? -30 : side === 3 ? BD.H + 30 : u * BD.H;
      const K = KINDS[k];
      es.push({ id: nextId++, k, x: side < 2 ? x : x, y: side < 2 ? u * BD.H : y, hp: K.hp * (1 + 0.04 * wave), max: K.hp * (1 + 0.04 * wave), slow: 0 });
    }
    function damage(e: E, d: number, by?: P) {
      e.hp -= d;
      if (e.hp > 0) return;
      const i = es.indexOf(e);
      if (i < 0) return;
      es.splice(i, 1);
      scrap += KINDS[e.k].scrap;
      if (by) by.kills++;
      ctx.fx('kill', { x: r1(e.x), y: r1(e.y), kd: e.k });
    }
    const nearestEnemy = (x: number, y: number, range: number) => {
      let best: E | null = null, bd = range * range;
      for (const e of es) { const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } }
      return best;
    };

    return {
      onPress(pid, btn) {
        const p = byId.get(pid);
        if (!p || p.down > 0 || over) return;
        if (btn === BTN.B && p.sprintCd <= 0) { p.sprint = 0.8; p.sprintCd = 3; return; }
        if (btn === BTN.C) { // team upgrade from the shared scrap
          if (up < BD.UP_MAX && scrap >= upCost()) { scrap -= upCost(); up++; ctx.fx('upgrade', { n: up }); ps.forEach(hud); }
          else ctx.buzz(pid, 40);
          return;
        }
        if (btn !== BTN.A || p.act > 0) return;
        if (p.role === 0) { // BURST: heavy damage to everything around
          let hit = 0;
          for (const e of [...es]) if (Math.hypot(e.x - p.x, e.y - p.y) < 300) { damage(e, 4 * dmgMul(), p); hit++; }
          ctx.fx('burst', { x: r1(p.x), y: r1(p.y), r: 300 });
          if (!hit) return;
        } else if (p.role === 1) { // TURRET
          if (ts.length >= BD.MAX_TURRETS || scrap < BD.TURRET_COST) { ctx.buzz(pid, 60); return; }
          if (Math.hypot(p.x - BD.CORE_X, p.y - BD.CORE_Y) < BD.CORE_R + 40) { ctx.buzz(pid, 60); return; }
          scrap -= BD.TURRET_COST; ts.push({ x: p.x, y: p.y, fire: 0 }); ctx.fx('build', { x: r1(p.x), y: r1(p.y) });
        } else if (p.role === 2) { // SHOCK: push everything away, a little damage
          for (const e of es) {
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d < 190) { const k = (KINDS[e.k].r > 30 ? 90 : 190) / (d || 1); e.x += (e.x - p.x) * k; e.y += (e.y - p.y) * k; e.slow = 1; }
          }
          for (const e of [...es]) if (Math.hypot(e.x - p.x, e.y - p.y) < 230) damage(e, 1.5 * dmgMul(), p);
          ctx.fx('shock', { x: r1(p.x), y: r1(p.y) });
        } else { // HEAL: the core, and everybody close (also gets downed defenders back up)
          coreHp = Math.min(BD.CORE_HP, coreHp + 22);
          for (const q of ps) if (Math.hypot(q.x - p.x, q.y - p.y) < 190) { if (q.down > 0) { q.down = 0; q.hp = 50; } q.hp = Math.min(100, q.hp + 45); }
          ctx.fx('heal', { x: r1(p.x), y: r1(p.y) });
        }
        p.act = ROLE_CD[p.role];
        ps.forEach(hud);
      },

      tick(dt) {
        if (over) return;
        time += dt;
        // waves
        if (queue.length === 0 && es.length === 0) {
          breakT -= dt;
          if (breakT <= 0) {
            if (wave >= totalWaves) { over = true; won = true; ctx.fx('victory'); return; }
            if (wave > 0) { scrap += 12; coreHp = Math.min(BD.CORE_HP, coreHp + 8); }
            startWave(); breakT = BD.BREAK; ps.forEach(hud);
          }
        } else if (queue.length) {
          spawnT -= dt;
          if (spawnT <= 0) { spawn(queue.pop()!); spawnT = Math.max(0.28, 0.85 - wave * 0.04); }
        }
        // defenders
        for (const p of ps) {
          if (p.down > 0) { p.down -= dt; if (p.down <= 0) { p.hp = 60; p.x = BD.CORE_X + 100; p.y = BD.CORE_Y; hud(p); } continue; }
          const inp = ctx.input(p.id);
          p.act = Math.max(0, p.act - dt); p.sprintCd = Math.max(0, p.sprintCd - dt); p.sprint = Math.max(0, p.sprint - dt);
          const m = Math.hypot(inp.x, inp.y), k = m > 1 ? 1 / m : 1;
          const sp = BD.SPEED * ROLE_SPEED[p.role] * (p.sprint > 0 ? BD.SPRINT : 1);
          p.x = Math.max(20, Math.min(BD.W - 20, p.x + inp.x * k * sp * dt));
          p.y = Math.max(20, Math.min(BD.H - 20, p.y + inp.y * k * sp * dt));
          if (m > 0.2) p.face = Math.atan2(inp.y, inp.x);
          // keep out of the core
          const dc = Math.hypot(p.x - BD.CORE_X, p.y - BD.CORE_Y);
          if (dc < BD.CORE_R + BD.PLAYER_R) { p.x = BD.CORE_X + ((p.x - BD.CORE_X) / (dc || 1)) * (BD.CORE_R + BD.PLAYER_R); p.y = BD.CORE_Y + ((p.y - BD.CORE_Y) / (dc || 1)) * (BD.CORE_R + BD.PLAYER_R); }
          // auto-fire
          p.fire -= dt;
          if (p.fire <= 0) {
            const e = nearestEnemy(p.x, p.y, p.role === 0 ? 360 : 280);
            if (e) {
              p.fire = (p.role === 0 ? 0.26 : 0.42) / (1 + 0.15 * up);
              damage(e, (p.role === 0 ? 1.3 : 1) * dmgMul(), p);
              ctx.fx('shot', { x: r1(p.x), y: r1(p.y), tx: r1(e.x), ty: r1(e.y), c: p.role });
            }
          }
        }
        // turrets
        for (const t of ts) {
          t.fire -= dt;
          if (t.fire <= 0) {
            const e = nearestEnemy(t.x, t.y, BD.TURRET_RANGE);
            if (e) { t.fire = 0.55 / (1 + 0.15 * up); damage(e, 1.1 * dmgMul()); ctx.fx('shot', { x: r1(t.x), y: r1(t.y), tx: r1(e.x), ty: r1(e.y), c: 4 }); }
          }
        }
        // enemies
        for (const e of [...es]) {
          const K = KINDS[e.k];
          e.slow = Math.max(0, e.slow - dt);
          let tx: number = BD.CORE_X, ty: number = BD.CORE_Y, target: P | null = null, bd = 130 * 130;
          for (const p of ps) { if (p.down > 0) continue; const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2; if (d < bd) { bd = d; target = p; } }
          if (target) { tx = target.x; ty = target.y; }
          const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
          const reach = target ? K.r + BD.PLAYER_R : K.r + BD.CORE_R;
          if (d > reach - 4) { const sp = K.speed * (e.slow > 0 ? 0.4 : 1); e.x += (dx / d) * sp * dt; e.y += (dy / d) * sp * dt; }
          else if (target) {
            target.hp -= K.dps * dt;
            if (target.hp <= 0 && target.down <= 0) { target.down = 9; target.hp = 0; ctx.fx('down', { id: target.id }); ctx.buzz(target.id, 300); hud(target); }
          } else {
            coreHp -= K.dps * dt;
            if (coreHp <= 0) { coreHp = 0; over = true; ctx.fx('defeat'); return; }
          }
        }
        hudT += dt;
        if (hudT > 0.35) { hudT = 0; ps.forEach(hud); }
      },

      snapshot() {
        return {
          t: r1(time), core: Math.round(coreHp), cm: BD.CORE_HP, w: wave, wl: totalWaves, sc: scrap, up, uc: up >= BD.UP_MAX ? 0 : upCost(),
          br: queue.length === 0 && es.length === 0 ? Math.max(0, Math.ceil(breakT)) : 0, left: es.length + queue.length, win: over ? (won ? 1 : -1) : 0,
          p: ps.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), r: p.role, hp: Math.round(p.hp), d: p.down > 0 ? 1 : 0, a: p.act <= 0 ? 1 : 0, f: r1(p.face), k: p.kills, s: p.sprint > 0 ? 1 : 0 })),
          e: es.map((e) => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), k: e.k, h: Math.round((e.hp / e.max) * 100) })),
          tr: ts.map((t) => ({ x: Math.round(t.x), y: Math.round(t.y) })),
        };
      },

      isOver() { return over; },

      standings(): StandingRow[] {
        const stars = won ? 3 : wave >= Math.ceil(totalWaves / 2) ? 2 : 1; // the whole team shares the result
        return [...ps].sort((a, b) => b.kills - a.kills).map((p) => ({
          playerId: p.id, score: p.kills, stars,
          detail: `${won ? 'WIN' : `wave ${wave}/${totalWaves}`} · ${p.kills} kills`,
        }));
      },
    };
  },
};
