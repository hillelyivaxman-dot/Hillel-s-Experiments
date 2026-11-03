import { BTN } from '../../shared/protocol';
import { r1 } from '../util';
import { collide, damp, integrate, spawnRing, type Body } from './physics';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// HOT POTATO: the bomb holder must touch someone to pass it before the fuse runs out.
export const POTATO = { W: 1400, H: 760, R: 30, ACC: 1000, KEEP: 0.06, SPRINT: 1.65, SPRINT_T: 0.9, SPRINT_CD: 3 };

interface Runner extends Body {
  id: string;
  out: boolean;
  outRound: number;
  sprintT: number;
  sprintCd: number;
  passes: number;
}

export const potatoGame: GameModule = {
  id: 'potato',
  create(ctx: GameContext): GameInstance {
    const P = POTATO;
    let time = 0;
    let round = 0;
    let ph: 'play' | 'boom' | 'done' = 'play';
    let fuse = 0;
    let fuseMax = 1;
    let phEnd = 0;
    let holder = '';
    let prevHolder = '';
    let passCd = 0;
    let throwCd = 0; // holder's THROW cooldown
    let flight: { f: string; t: string; at: number } | null = null; // bomb in the air (visual)
    let boom: { x: number; y: number; id: string } | null = null;
    const ring = spawnRing(ctx.players.length, 260);
    const rs: Runner[] = ctx.players.map((p, i) => ({
      id: p.id, x: ring[i].x, y: ring[i].y, vx: 0, vy: 0, r: P.R, m: 1,
      out: false, outRound: 0, sprintT: 0, sprintCd: 0, passes: 0,
    }));
    const byId = new Map(rs.map((r) => [r.id, r]));
    const alive = () => rs.filter((r) => !r.out);

    function hud() {
      for (const r of rs) ctx.hud(r.id, { hot: r.id === holder ? 1 : 0, out: r.out ? 1 : 0, round, sprint: r.sprintCd <= 0 ? 1 : 0, throw: r.id === holder && throwCd <= 0 ? 1 : 0 });
    }

    function newRound() {
      round++;
      const al = alive();
      holder = al[Math.floor(ctx.rand() * al.length)].id;
      prevHolder = '';
      passCd = 1;
      throwCd = 1.5;
      flight = null;
      fuseMax = fuse = 9 + ctx.rand() * 10 - Math.min(4, round * 0.5);
      ph = 'play';
      boom = null;
      ctx.fx('round', { holder });
      ctx.buzz(holder, 250);
      hud();
    }
    newRound();

    return {
      onPress(pid, btn) {
        const r = byId.get(pid);
        if (!r || r.out) return;
        if (btn === BTN.B) { // THROW: lob the bomb to the closest player in the stick direction (or closest overall)
          if (ph !== 'play' || pid !== holder || throwCd > 0) return;
          const inp = ctx.input(pid);
          const aim = Math.hypot(inp.x, inp.y) > 0.3 ? Math.atan2(inp.y, inp.x) : null;
          const cands = alive().filter((o) => o.id !== pid && Math.hypot(o.x - r.x, o.y - r.y) < 520);
          const score = (o: Runner) => {
            const d = Math.hypot(o.x - r.x, o.y - r.y);
            if (aim === null) return d;
            let da = Math.abs(Math.atan2(o.y - r.y, o.x - r.x) - aim);
            if (da > Math.PI) da = 2 * Math.PI - da;
            return da < 0.8 ? d : d + 1000;
          };
          const target = cands.sort((a, b) => score(a) - score(b))[0];
          if (!target) { ctx.fx('miss', { id: pid }); return; }
          prevHolder = holder;
          holder = target.id;
          r.passes++;
          throwCd = 2.5;
          passCd = 0.6;
          flight = { f: pid, t: target.id, at: time };
          ctx.fx('throw', { from: pid, to: target.id });
          ctx.buzz(target.id, 220);
          hud();
          return;
        }
        if (btn !== BTN.A || r.sprintCd > 0) return;
        r.sprintT = P.SPRINT_T;
        r.sprintCd = P.SPRINT_CD;
        ctx.fx('sprint', { id: pid });
        hud();
      },

      tick(dt) {
        time += dt;
        if (ph === 'done') return;
        if (ph === 'boom') {
          if (time >= phEnd) {
            if (alive().length >= 2) newRound();
            else { ph = 'done'; }
          }
        }
        for (const r of rs) {
          if (r.out) continue;
          const inp = ctx.input(r.id);
          const k = (r.sprintT > 0 ? P.SPRINT : 1) * (r.id === holder ? 1.12 : 1);
          r.vx += inp.x * P.ACC * k * dt;
          r.vy += inp.y * P.ACC * k * dt;
          damp(r, P.KEEP, dt);
          integrate(r, dt);
          const hw = P.W / 2 - r.r, hh = P.H / 2 - r.r;
          if (r.x < -hw) { r.x = -hw; r.vx = Math.abs(r.vx) * 0.5; }
          if (r.x > hw) { r.x = hw; r.vx = -Math.abs(r.vx) * 0.5; }
          if (r.y < -hh) { r.y = -hh; r.vy = Math.abs(r.vy) * 0.5; }
          if (r.y > hh) { r.y = hh; r.vy = -Math.abs(r.vy) * 0.5; }
          const had = r.sprintCd > 0;
          r.sprintT = Math.max(0, r.sprintT - dt);
          r.sprintCd = Math.max(0, r.sprintCd - dt);
          if (had && r.sprintCd <= 0) hud();
        }
        const al = alive();
        for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) collide(al[i], al[j], 0.4);

        if (ph !== 'play') return;
        passCd = Math.max(0, passCd - dt);
        const hadThrow = throwCd > 0;
        throwCd = Math.max(0, throwCd - dt);
        if (hadThrow && throwCd <= 0) hud();
        if (flight && time - flight.at > 0.4) flight = null;
        const h = byId.get(holder)!;
        if (passCd <= 0) {
          const target = al.find((o) => o.id !== holder && (o.id !== prevHolder || al.length === 2) &&
            Math.hypot(o.x - h.x, o.y - h.y) < h.r + o.r + 8);
          if (target) {
            prevHolder = holder;
            holder = target.id;
            h.passes++;
            passCd = 0.5;
            throwCd = Math.max(throwCd, 0.8);
            ctx.fx('pass', { from: h.id, to: target.id });
            ctx.buzz(target.id, 200);
            hud();
          }
        }
        fuse -= dt;
        if (fuse <= 0) {
          h.out = true;
          h.outRound = round;
          boom = { x: r1(h.x), y: r1(h.y), id: h.id };
          ctx.fx('boom', { id: h.id, x: r1(h.x), y: r1(h.y) });
          ctx.buzz(h.id, 700);
          for (const o of alive()) {
            const d = Math.hypot(o.x - h.x, o.y - h.y) || 1;
            if (d < 260) { o.vx += ((o.x - h.x) / d) * 900; o.vy += ((o.y - h.y) / d) * 900; }
          }
          holder = '';
          ph = 'boom';
          phEnd = time + 2.6;
          hud();
        }
      },

      snapshot() {
        return {
          t: r1(time), ph, round, h: holder,
          heat: ph === 'play' ? r1(1 - fuse / fuseMax) : 1,
          p: rs.map((r) => ({ id: r.id, x: Math.round(r.x), y: Math.round(r.y), o: r.out ? 1 : 0, s: r.sprintT > 0 ? 1 : 0 })),
          b: boom,
          fl: flight ? { f: flight.f, t: flight.t, k: r1(Math.min(1, (time - flight.at) / 0.4)) } : null,
        };
      },

      isOver: () => ph === 'done',

      standings(): StandingRow[] {
        const key = (r: Runner) => (r.out ? r.outRound : 1000);
        return [...rs]
          .sort((a, b) => key(b) - key(a) || a.passes - b.passes)
          .map((r) => ({
            playerId: r.id,
            score: r.out ? r.outRound - 1 : round,
            detail: r.out ? `💥 R${r.outRound}` : '👑',
            tie: key(r),
          }));
      },
    };
  },
};
