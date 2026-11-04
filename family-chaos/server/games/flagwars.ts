import { BTN } from '../../shared/protocol';
import { BASES, circRect, FW, inBase, inMud, ROLES, SPAWNS, WALLS } from '../../shared/flagwars';
import { r1 } from '../util';
import { collide, damp, integrate, type Body } from './physics';
import { Mods } from './powers';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// FLAG WARS: two teams. Grab the other team's flag and carry it into YOUR base to score. If you stand in the enemy half
// and an enemy touches you, you are tagged: you drop the flag and respawn at your base. JUMP hops over low hedges and
// tackles, SPRINT burns stamina, ACTION lunges (a tackle: stuns and makes carriers drop the flag), POWER is a role power:
// runner = DASH, guard = FREEZE pulse, support = SHIELD aura.
interface P extends Body {
  id: string; tm: number; role: number; z: number; jumpT: number; jumpCd: number; stam: number; stun: number; out: number; carry: number; // carry = team of the flag held, -1 none
  lungeT: number; lungeCd: number; pw: number; pwT: number; slow: number; shield: number; caps: number; tags: number; steals: number; ax: number; ay: number;
}
interface Flag { x: number; y: number; st: 0 | 1 | 2; by: string | null; ret: number } // 0 home, 1 carried, 2 dropped

export const flagWarsGame: GameModule = {
  id: 'flagwars',
  create(ctx: GameContext): GameInstance {
    const TIME = ctx.options.time ?? 180;
    const WIN = ctx.options.score ?? FW.WIN_SCORE;
    const counts = [0, 0];
    const ps: P[] = ctx.players.map((pl, i) => {
      const tm = i % 2, k = counts[tm]++; // alternate: red, blue, red, ...
      const [sx, sy] = SPAWNS[tm][k % SPAWNS[tm].length];
      return { id: pl.id, x: sx, y: sy, vx: 0, vy: 0, r: FW.R, m: 1, tm, role: k % ROLES.length, z: 0, jumpT: 0, jumpCd: 0, stam: 100, stun: 0, out: 0, carry: -1, lungeT: 0, lungeCd: 0, pw: 0, pwT: 0, slow: 0, shield: 0, caps: 0, tags: 0, steals: 0, ax: tm ? -1 : 1, ay: 0 };
    });
    const byId = new Map(ps.map((p) => [p.id, p]));
    const mods = new Mods();
    const handicap = (tm: number) => 1 + Math.min(0.2, Math.max(0, counts[1 - tm] - counts[tm]) * 0.07); // a smaller team is a bit faster
    const flags: Flag[] = [0, 1].map((t) => ({ x: BASES[t].fx, y: BASES[t].fy, st: 0, by: null, ret: 0 }));
    const score = [0, 0];
    let time = 0, over = false, overtime = false, hudT = 0;
    const POWER_CD = [6, 9, 10];
    const hud = (p: P) => ctx.hud(p.id, { tm: p.tm, role: p.role, a: score[0], b: score[1], left: Math.max(0, Math.ceil(TIME - time)), carry: p.carry >= 0 ? 1 : 0, out: p.out > 0 ? 1 : 0, pw: p.pw <= 0 ? 1 : 0, tkl: p.lungeCd <= 0 ? 1 : 0, ot: overtime ? 1 : 0 });
    ps.forEach(hud);
    const home = (t: number) => { flags[t] = { x: BASES[t].fx, y: BASES[t].fy, st: 0, by: null, ret: 0 }; };
    const drop = (p: P) => {
      if (p.carry < 0) return;
      const f = flags[p.carry]; f.st = 2; f.by = null; f.x = p.x; f.y = p.y; f.ret = FW.FLAG_RETURN; ctx.fx('drop', { t: p.carry, x: Math.round(p.x), y: Math.round(p.y) }); p.carry = -1;
    };
    const tagOut = (v: P, by: P | null) => {
      drop(v); v.out = FW.OUT_T; v.stun = 0; v.lungeT = 0; if (by) by.tags++;
      ctx.fx('tag', { id: v.id, x: Math.round(v.x), y: Math.round(v.y) }); ctx.buzz(v.id, 200); hud(v);
    };
    const side = (x: number) => (x < FW.MID ? 0 : 1);

    return {
      onPress(pid, b) {
        const p = byId.get(pid);
        if (!p || p.out > 0 || p.stun > 0 || over) return;
        if (b === BTN.A && p.z <= 0 && p.jumpCd <= 0) { p.jumpT = FW.JUMP_T; p.jumpCd = FW.JUMP_CD; ctx.fx('jump', { id: pid }); }
        else if (b === BTN.C && p.lungeCd <= 0) { p.lungeT = 0.22; p.lungeCd = FW.TACKLE_CD; ctx.fx('lunge', { id: pid }); hud(p); }
        else if (b === BTN.D && p.pw <= 0) {
          p.pw = POWER_CD[p.role]; ctx.fx('power', { id: pid, role: p.role, x: Math.round(p.x), y: Math.round(p.y) }); ctx.buzz(pid, 40);
          if (p.role === 0) p.pwT = 0.8; // dash
          else if (p.role === 1) { for (const q of ps) if (q.tm !== p.tm && q.out <= 0 && Math.hypot(q.x - p.x, q.y - p.y) < 150) q.slow = 2.2; } // freeze pulse
          else for (const q of ps) if (q.tm === p.tm && Math.hypot(q.x - p.x, q.y - p.y) < 140) q.shield = 2.6; // shield aura
          hud(p);
        }
      },
      power(pid, kind, secs) {
        const p = byId.get(pid); if (!p || p.out > 0) return false;
        if (kind === 'teleport') { for (let k = 0; k < 30; k++) { const x = 160 + ctx.rand() * (FW.W - 320), y = 80 + ctx.rand() * (FW.H - 160); const t = { x, y }; if (!WALLS.some((w) => !w.low && x > w.x - 30 && x < w.x + w.w + 30 && y > w.y - 30 && y < w.y + w.h + 30)) { p.x = t.x; p.y = t.y; p.vx = p.vy = 0; break; } } }
        else if (kind === 'swap') { const o = ps.filter((q) => q !== p && q.out <= 0); if (!o.length) return false; const q = o[Math.floor(ctx.rand() * o.length)]; [p.x, q.x] = [q.x, p.x]; [p.y, q.y] = [q.y, p.y]; }
        else mods.add(pid, kind, secs);
        return true;
      },
      tick(dt) {
        mods.tick(dt);
        time += dt; hudT += dt;
        for (const p of ps) {
          const i = ctx.input(p.id);
          p.jumpCd = Math.max(0, p.jumpCd - dt); p.lungeCd = Math.max(0, p.lungeCd - dt); p.pw = Math.max(0, p.pw - dt); p.pwT = Math.max(0, p.pwT - dt);
          p.stun = Math.max(0, p.stun - dt); p.slow = Math.max(0, p.slow - dt); p.shield = Math.max(0, p.shield - dt);
          const hadJ = p.jumpT > 0; p.jumpT = Math.max(0, p.jumpT - dt); p.z = p.jumpT > 0 ? Math.sin((1 - p.jumpT / FW.JUMP_T) * Math.PI) * 60 * mods.jump(p.id) : 0; void hadJ;
          if (p.out > 0) { // jail: back to the base spawn
            p.out -= dt; p.vx = p.vy = 0;
            if (p.out <= 0) { const k = ps.filter((q) => q.tm === p.tm).indexOf(p); const [sx, sy] = SPAWNS[p.tm][k % SPAWNS[p.tm].length]; p.x = sx; p.y = sy; p.shield = 1.5; ctx.fx('respawn', { id: p.id }); hud(p); }
            continue;
          }
          const mag = Math.hypot(i.x, i.y);
          if (mag > 0.25) { p.ax = i.x / mag; p.ay = i.y / mag; }
          const sprint = (i.b & BTN.B) !== 0 && p.stam > 0 && mag > 0.2;
          p.stam = Math.max(0, Math.min(100, p.stam + (sprint ? -34 : 18) * dt));
          p.r = FW.R * mods.size(p.id);
          let sp = FW.SPEED * (sprint ? FW.SPRINT : 1) * (p.carry >= 0 ? FW.CARRY : 1) * handicap(p.tm) * mods.speed(p.id);
          if (inMud(p.x, p.y) && p.z <= 0) sp *= 0.55;
          if (p.slow > 0) sp *= 0.4;
          if (p.pwT > 0) sp *= 2.1;
          if (p.stun > 0) sp = 0;
          if (p.lungeT > 0) { p.lungeT -= dt; p.vx = p.ax * 560; p.vy = p.ay * 560; }
          else { p.vx += i.x * sp * 9 * dt; p.vy += i.y * sp * 9 * dt; damp(p, 0.0008, dt); const s = Math.hypot(p.vx, p.vy); if (s > sp) { p.vx *= sp / s; p.vy *= sp / s; } }
          integrate(p, dt);
          p.x = Math.max(p.r, Math.min(FW.W - p.r, p.x)); p.y = Math.max(p.r, Math.min(FW.H - p.r, p.y));
          for (const w of WALLS) if (!(w.low && p.z > 14)) circRect(p, p.r, w);
          if (sprint && Math.floor(time * 12) !== Math.floor((time - dt) * 12)) ctx.fx('dust', { x: Math.round(p.x), y: Math.round(p.y) });
        }
        // contact: tackles and tags
        for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) {
          const A = ps[a], B = ps[b];
          if (A.out > 0 || B.out > 0) continue;
          const d = Math.hypot(A.x - B.x, A.y - B.y);
          if (A.tm === B.tm) { if (d < A.r + B.r) collide(A, B, 0.2); continue; }
          if (d > A.r + B.r + 6 || A.z > 18 || B.z > 18) continue;
          // a lunging player stuns the other (and knocks the flag loose); this is how you stop a carrier anywhere
          for (const [x, y] of [[A, B], [B, A]] as [P, P][]) if (x.lungeT > 0 && y.shield <= 0 && y.stun <= 0) { y.stun = 1.0; drop(y); y.vx = x.ax * 420; y.vy = x.ay * 420; ctx.fx('tackle', { id: y.id, x: Math.round(y.x), y: Math.round(y.y) }); ctx.buzz(y.id, 150); }
          // territory tag: whoever stands in the OTHER team's half is tagged
          for (const [x, y] of [[A, B], [B, A]] as [P, P][]) if (side(y.x) === x.tm && side(x.x) === x.tm && y.shield <= 0 && !inBase(y.tm, y.x, y.y)) { tagOut(y, x); }
        }
        // flags
        for (const t of [0, 1]) {
          const f = flags[t];
          if (f.st === 1) { const c = byId.get(f.by!); if (c && c.out <= 0) { f.x = c.x; f.y = c.y; } else home(t); continue; }
          if (f.st === 2) { f.ret -= dt; if (f.ret <= 0) { home(t); ctx.fx('flaghome', { t }); } }
          for (const p of ps) {
            if (p.out > 0 || p.stun > 0 || p.z > 20 || Math.hypot(p.x - f.x, p.y - f.y) > 44) continue;
            if (p.tm !== t && p.carry < 0) { f.st = 1; f.by = p.id; p.carry = t; p.steals++; ctx.fx('steal', { id: p.id, t }); ctx.buzz(p.id, 100); hud(p); break; }
            if (p.tm === t && f.st === 2) { home(t); ctx.fx('flaghome', { t }); break; } // a teammate touches the dropped flag: it flies home
          }
        }
        // captures
        for (const p of ps) if (p.carry >= 0 && p.out <= 0 && inBase(p.tm, p.x, p.y)) {
          score[p.tm]++; p.caps++; const t = p.carry; p.carry = -1; home(t);
          ctx.fx('capture', { id: p.id, tm: p.tm, a: score[0], b: score[1] }); ctx.buzz(p.id, 300); ps.forEach(hud);
          if (score[p.tm] >= WIN || overtime) over = true;
        }
        if (time >= TIME && !over) { if (score[0] === score[1]) { if (!overtime) { overtime = true; ctx.fx('overtime', {}); ps.forEach(hud); } if (time >= TIME + 60) over = true; } else over = true; }
        if (hudT > 1) { hudT = 0; ps.forEach(hud); }
      },
      snapshot: () => ({
        t: r1(time), left: Math.max(0, Math.ceil(TIME - time)), sc: score, ot: overtime ? 1 : 0, win: WIN,
        fl: flags.map((f) => [Math.round(f.x), Math.round(f.y), f.st, f.by ?? '']),
        p: ps.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z), tm: p.tm, ro: p.role, cr: p.carry >= 0 ? 1 : 0, ...(p.out > 0 ? { o: 1 } : {}), ...(p.stun > 0 ? { s: 1 } : {}), ...(p.shield > 0 ? { sh: 1 } : {}), ...(p.slow > 0 ? { sl: 1 } : {}), ...(p.lungeT > 0 ? { lg: 1 } : {}), ...(p.pwT > 0 ? { ds: 1 } : {}), st: Math.round(p.stam), fx: r1(p.ax), fy: r1(p.ay), ...mods.extras(p.id) })),
      }),
      isOver: () => over,
      standings(): StandingRow[] {
        const w = score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : -1;
        return [...ps].sort((a, b) => (w >= 0 ? (b.tm === w ? 1 : 0) - (a.tm === w ? 1 : 0) : 0) || b.caps - a.caps || b.tags - a.tags).map((p) => ({
          playerId: p.id, score: p.caps, detail: `${score[p.tm]}–${score[1 - p.tm]} · ${p.caps} :flag: · ${p.tags} tags`,
          tie: w < 0 ? 0 : p.tm === w ? 0 : 1, stars: w < 0 ? 2 : p.tm === w ? 3 : 1,
        }));
      },
    };
  },
};
