import { BTN } from '../../shared/protocol';
import { r1 } from '../util';
import { collide, damp, integrate, spawnRing, type Body } from './physics';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// BUMPER BATTLE: push everyone out of a shrinking circular arena.
export const BUMPER = {
  R0: 380,
  RMIN: 180,
  SHRINK_START: 15,
  SHRINK_END: 80,
  MAX_TIME: 120,
  ACC: 950,
  KEEP: 0.12,
  DASH: 720,
  DASH_CD: 1.4,
  RADIUS: 30,
  RESPAWN: 1.6,
  INVULN: 1.5,
} as const;

type Power = 'mega' | 'shield' | 'speed';

interface Bumper extends Body {
  id: string;
  lives: number;
  ko: number;
  falling: number; // >0 while falling/respawning
  inv: number;
  dashCd: number;
  dashT: number;
  pow: Power | null; // active power
  powT: number;
  held: Power | null; // stored power, fired with SPECIAL (B)
  dodgeCd: number;
  dodgeT: number; // >0 while dodging: passes through others
  hitBy: string | null;
  hitT: number;
  outAt: number; // elimination order (time); -1 while alive
  face: number;
}

export const bumperGame: GameModule = {
  id: 'bumper',
  create(ctx: GameContext): GameInstance {
    const C = BUMPER;
    const lives = ctx.options.lives ?? 3;
    let time = 0;
    let R: number = C.R0;
    let nextPow = 6;
    let powId = 0;
    const pows: { id: number; k: Power; x: number; y: number }[] = [];
    const ring = spawnRing(ctx.players.length, 200);
    const bs: Bumper[] = ctx.players.map((p, i) => ({
      id: p.id, x: ring[i].x, y: ring[i].y, vx: 0, vy: 0, r: C.RADIUS, m: 1,
      lives, ko: 0, falling: 0, inv: 0, dashCd: 0, dashT: 0, pow: null, powT: 0, held: null, dodgeCd: 0, dodgeT: 0,
      hitBy: null, hitT: -99, outAt: -1, face: Math.atan2(-ring[i].y, -ring[i].x),
    }));
    const byId = new Map(bs.map((b) => [b.id, b]));
    const active = (b: Bumper) => b.lives > 0 && b.falling <= 0;

    function updateMass(b: Bumper) {
      b.r = b.pow === 'mega' ? C.RADIUS * 1.5 : C.RADIUS;
      b.m = (b.dashT > 0 ? 2.2 : 1) * (b.pow === 'mega' ? 3 : 1) * (b.pow === 'shield' || b.inv > 0 ? 8 : 1);
    }

    function hud(b: Bumper) {
      ctx.hud(b.id, { lives: b.lives, ko: b.ko, dash: b.dashCd <= 0 ? 1 : 0, dodge: b.dodgeCd <= 0 ? 1 : 0, held: b.held ?? '', power: b.pow ?? '' });
    }
    bs.forEach(hud);

    const inst: GameInstance = {
      onPress(pid, btn) {
        const b = byId.get(pid);
        if (!b || !active(b)) return;
        if (btn === BTN.B) { // SPECIAL: fire the stored power-up
          if (!b.held) return;
          b.pow = b.held; b.powT = 5; b.held = null;
          ctx.fx('power', { id: pid, k: b.pow });
          ctx.buzz(pid, 80);
          hud(b);
          return;
        }
        if (btn === BTN.C) { // DODGE: quick sidestep (stick direction, else sideways), passes through others
          if (b.dodgeCd > 0) return;
          const inp = ctx.input(pid);
          let dx = inp.x, dy = inp.y;
          if (Math.hypot(dx, dy) < 0.2) { dx = -Math.sin(b.face); dy = Math.cos(b.face); }
          const len = Math.hypot(dx, dy) || 1;
          b.vx = (dx / len) * 560; b.vy = (dy / len) * 560;
          b.dodgeT = 0.28; b.dodgeCd = 2;
          ctx.fx('dodge', { id: pid });
          hud(b);
          return;
        }
        if (btn !== BTN.A || b.dashCd > 0) return;
        const inp = ctx.input(pid);
        let dx = inp.x, dy = inp.y;
        let len = Math.hypot(dx, dy);
        if (len < 0.2) { dx = Math.cos(b.face); dy = Math.sin(b.face); len = 1; }
        b.vx += (dx / len) * C.DASH;
        b.vy += (dy / len) * C.DASH;
        b.dashCd = C.DASH_CD;
        b.dashT = 0.25;
        ctx.fx('dash', { id: pid });
        hud(b);
      },

      tick(dt) {
        time += dt;
        const k = Math.min(1, Math.max(0, (time - C.SHRINK_START) / (C.SHRINK_END - C.SHRINK_START)));
        R = C.R0 - (C.R0 - C.RMIN) * k;

        for (const b of bs) {
          if (b.lives <= 0) continue;
          if (b.falling > 0) {
            b.falling -= dt;
            if (b.falling <= 0) {
              const a = ctx.rand() * Math.PI * 2;
              const d = ctx.rand() * R * 0.4;
              b.x = Math.cos(a) * d; b.y = Math.sin(a) * d; b.vx = 0; b.vy = 0;
              b.inv = C.INVULN; b.hitBy = null;
              ctx.fx('spawn', { id: b.id });
            }
            continue;
          }
          const inp = ctx.input(b.id);
          const acc = C.ACC * (b.pow === 'speed' ? 1.6 : 1);
          b.vx += inp.x * acc * dt;
          b.vy += inp.y * acc * dt;
          if (Math.hypot(inp.x, inp.y) > 0.2) b.face = Math.atan2(inp.y, inp.x);
          damp(b, C.KEEP, dt);
          integrate(b, dt);
          const wasReady = b.dashCd <= 0 && b.dodgeCd <= 0;
          b.dodgeCd = Math.max(0, b.dodgeCd - dt);
          b.dodgeT = Math.max(0, b.dodgeT - dt);
          b.dashCd = Math.max(0, b.dashCd - dt);
          b.dashT = Math.max(0, b.dashT - dt);
          b.inv = Math.max(0, b.inv - dt);
          if (b.pow) {
            b.powT -= dt;
            if (b.powT <= 0) { b.pow = null; hud(b); }
          }
          if (!wasReady && b.dashCd <= 0 && b.dodgeCd <= 0) hud(b);
          else if (!wasReady && (b.dashCd <= 0 || b.dodgeCd <= 0)) hud(b);
          updateMass(b);
        }

        // collisions
        for (let i = 0; i < bs.length; i++) {
          const a = bs[i];
          if (!active(a) || a.dodgeT > 0) continue;
          for (let j = i + 1; j < bs.length; j++) {
            const b = bs[j];
            if (!active(b) || b.dodgeT > 0) continue;
            const s = collide(a, b, 0.95, 140);
            if (s > 0) {
              a.hitBy = b.id; a.hitT = time;
              b.hitBy = a.id; b.hitT = time;
              if (s > 160) {
                ctx.fx('bump', { x: r1((a.x + b.x) / 2), y: r1((a.y + b.y) / 2), s: Math.round(s) });
                ctx.buzz(a.id, 35); ctx.buzz(b.id, 35);
              }
            }
          }
        }

        // falling off the edge
        for (const b of bs) {
          if (!active(b)) continue;
          if (Math.hypot(b.x, b.y) > R + b.r * 0.35) {
            b.lives -= 1;
            b.falling = C.RESPAWN;
            b.pow = null;
            if (b.hitBy && time - b.hitT < 3) {
              const killer = byId.get(b.hitBy);
              if (killer) { killer.ko += 1; hud(killer); }
            }
            if (b.lives <= 0) b.outAt = time;
            ctx.fx('fall', { id: b.id, x: r1(b.x), y: r1(b.y), out: b.lives <= 0 ? 1 : 0 });
            ctx.buzz(b.id, 300);
            hud(b);
          }
        }

        // power-ups
        nextPow -= dt;
        if (nextPow <= 0 && pows.length < 2) {
          nextPow = 6 + ctx.rand() * 4;
          const a = ctx.rand() * Math.PI * 2;
          const d = ctx.rand() * R * 0.6;
          const kinds: Power[] = ['mega', 'shield', 'speed'];
          pows.push({ id: ++powId, k: kinds[Math.floor(ctx.rand() * 3)], x: Math.cos(a) * d, y: Math.sin(a) * d });
        }
        for (let i = pows.length - 1; i >= 0; i--) {
          const p = pows[i];
          if (Math.hypot(p.x, p.y) > R) { pows.splice(i, 1); continue; }
          const taker = bs.find((b) => active(b) && !b.held && Math.hypot(b.x - p.x, b.y - p.y) < b.r + 22);
          if (taker) {
            taker.held = p.k;
            pows.splice(i, 1);
            ctx.fx('pickup', { id: taker.id, k: p.k });
            ctx.buzz(taker.id, 60);
            hud(taker);
          }
        }
      },

      snapshot() {
        return {
          t: r1(time),
          left: Math.max(0, Math.ceil(C.MAX_TIME - time)),
          R: r1(R),
          p: bs.map((b) => ({
            id: b.id, x: Math.round(b.x), y: Math.round(b.y), r: b.r, a: r1(b.face), l: b.lives,
            f: b.falling > 0 ? 1 : 0, d: b.dashT > 0 ? 1 : 0, i: b.inv > 0 ? 1 : 0, w: b.pow ?? '', k: b.ko, h: b.held ?? '', g: b.dodgeT > 0 ? 1 : 0,
          })),
          u: pows.map((p) => ({ id: p.id, k: p.k, x: r1(p.x), y: r1(p.y) })),
        };
      },

      isOver() {
        const alive = bs.filter((b) => b.lives > 0).length;
        return time >= C.MAX_TIME || (bs.length > 1 ? alive <= 1 : alive === 0);
      },

      standings(): StandingRow[] {
        const outKey = (b: Bumper) => (b.outAt === -1 ? 1e9 : b.outAt);
        const sorted = [...bs].sort((a, b) => b.lives - a.lives || outKey(b) - outKey(a) || b.ko - a.ko);
        return sorted.map((b) => ({
          playerId: b.id,
          score: b.ko,
          detail: `${b.lives}♥ · ${b.ko} KO`,
          tie: b.lives > 0 ? b.lives * 1000 + b.ko : -Math.round((1000 - b.outAt) * 30),
        }));
      },
    };
    return inst;
  },
};
