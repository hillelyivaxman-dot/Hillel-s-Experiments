import { BTN } from '../../shared/protocol';
import { SOCCER } from '../../shared/soccer';
import { r1 } from '../util';
import { collide, damp, integrate, type Body } from './physics';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// SOCCER: teams (alternating by join order). The ball is CARRIED: touch it and it sticks in front of you, wherever you look.
// A = shoot (when you have it) or SLIDE TACKLE (when you don't: a slide steals the ball from a carrier). C = pass. B = sprint.
// Most goals when time runs out wins; a tie goes to golden-goal overtime.
export { SOCCER };

interface Pl extends Body {
  id: string; team: 0 | 1; face: number; stamina: number; sprinting: boolean; kickCd: number; kickFx: number; goals: number; touches: number;
  noPick: number; slide: number; slideCd: number; rec: number; sdx: number; sdy: number; // pick-up lock, slide time / cooldown / recovery / direction
}

export const soccerGame: GameModule = {
  id: 'soccer',
  create(ctx: GameContext): GameInstance {
    const C = SOCCER;
    const total = ctx.options.time ?? 120;
    let time = 0;
    let ot = false, otEnd = 0;
    let over = false;
    let celebrate = 0;
    let lastScorer: string | null = null;
    const score: [number, number] = [0, 0];

    const ps: Pl[] = ctx.players.map((p, i) => ({
      id: p.id, team: (i % 2) as 0 | 1, x: 0, y: 0, vx: 0, vy: 0, r: C.PLAYER_R, m: 1.6,
      face: i % 2 ? Math.PI : 0, stamina: 100, sprinting: false, kickCd: 0, kickFx: 0, goals: 0, touches: 0, noPick: 0, slide: 0, slideCd: 0, rec: 0, sdx: 0, sdy: 0,
    }));
    const byId = new Map(ps.map((p) => [p.id, p]));
    const ball: Body & { lastTouch: string | null } = { x: 0, y: 0, vx: 0, vy: 0, r: C.BALL_R, m: 0.55, lastTouch: null };
    let owner: Pl | null = null; // who carries the ball
    const SLIDE_T = 0.38, SLIDE_V = 760, SLIDE_CD = 1.3, REC_T = 0.45;
    const posts: Body[] = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => ({ x: sx * C.HW, y: sy * C.GOAL_HALF, vx: 0, vy: 0, r: C.POST_R, m: Infinity })));

    function kickoff(conceding?: 0 | 1) {
      ball.x = 0; ball.y = 0; ball.vx = 0; ball.vy = 0; ball.lastTouch = null; owner = null;
      const team = [[], []] as Pl[][];
      ps.forEach((p) => team[p.team].push(p));
      for (const t of [0, 1] as const) {
        const side = t === 0 ? -1 : 1;
        team[t].forEach((p, k) => {
          const n = team[t].length;
          p.x = side * (k === 0 ? 120 : 330);
          p.y = n === 1 ? 0 : (k - (n - 1) / 2) * 190;
          p.vx = 0; p.vy = 0; p.face = t === 0 ? 0 : Math.PI; p.slide = 0; p.rec = 0; p.noPick = 0;
        });
      }
      void conceding;
    }
    kickoff();

    function hud(p: Pl) {
      ctx.hud(p.id, { team: p.team, a: score[0], b: score[1], own: owner === p ? 1 : 0, sl: p.slideCd <= 0 && p.rec <= 0 ? 1 : 0, kick: p.kickCd <= 0 ? 1 : 0, stamina: Math.round(p.stamina), ot: ot ? 1 : 0 });
    }
    ps.forEach(hud);
    let hudT = 0;

    function goal(team: 0 | 1) {
      score[team]++;
      const scorer = ball.lastTouch ? byId.get(ball.lastTouch) : null;
      if (scorer && scorer.team === team) scorer.goals++;
      lastScorer = scorer && scorer.team === team ? scorer.id : null;
      celebrate = C.CELEBRATE;
      ctx.fx('goal', { team, id: lastScorer ?? '', x: team === 0 ? C.HW : -C.HW });
      for (const p of ps) { ctx.buzz(p.id, p.team === team ? 300 : 120); hud(p); }
      if (ot || Math.abs(score[0] - score[1]) >= C.MERCY) over = true; // golden goal, or mercy rule at an 8-goal lead
    }

    const give = (p: Pl | null) => { owner = p; if (p) { ball.lastTouch = p.id; p.touches++; } ps.forEach((q) => { if (q === p || q.team === p?.team) hud(q); }); if (!p) ps.forEach(hud); };
    const release = (p: Pl) => { if (owner === p) { owner = null; p.noPick = 0.35; ps.forEach(hud); } };

    /** PASS: the ball goes to the teammate best lined up with where you aim, led a little so it arrives at his feet. */
    function pass(p: Pl) {
      p.kickCd = C.KICK_CD; p.kickFx = 0.18;
      if (owner !== p) { ctx.fx('swing', { id: p.id }); return; }
      const inp = ctx.input(p.id);
      const aim = Math.hypot(inp.x, inp.y) > 0.3 ? Math.atan2(inp.y, inp.x) : p.face;
      let best: Pl | null = null, bs = -1;
      for (const q of ps) {
        if (q === p || q.team !== p.team) continue;
        const a = Math.atan2(q.y - p.y, q.x - p.x), cos = Math.cos(a - aim), d = Math.hypot(q.x - p.x, q.y - p.y);
        const sc = cos > 0.35 ? cos * 2 - d / 900 : -1;
        if (sc > bs) { bs = sc; best = q; }
      }
      let ax = Math.cos(aim), ay = Math.sin(aim), v = 520;
      if (best) {
        const d = Math.hypot(best.x - ball.x, best.y - ball.y), t = d / 560;
        const tx = best.x + best.vx * Math.min(0.5, t), ty = best.y + best.vy * Math.min(0.5, t);
        const l = Math.hypot(tx - ball.x, ty - ball.y) || 1; ax = (tx - ball.x) / l; ay = (ty - ball.y) / l; v = Math.min(700, 320 + d * 0.8);
      }
      ball.vx = ax * v; ball.vy = ay * v; ball.lastTouch = p.id; p.touches++; release(p);
      ctx.fx('pass', { id: p.id, to: best?.id ?? '', x: r1(ball.x), y: r1(ball.y) }); ctx.buzz(p.id, 25);
    }

    return {
      onPress(pid, btn) {
        const p = byId.get(pid);
        if (!p || celebrate > 0 || p.slide > 0 || p.rec > 0) return;
        if (btn === BTN.C && p.kickCd <= 0) { pass(p); return; }
        if (btn !== BTN.A) return;
        const inp = ctx.input(pid);
        if (owner === p) { // SHOOT where you aim (stick), otherwise where you look
          if (p.kickCd > 0) return;
          const aim = Math.hypot(inp.x, inp.y) > 0.3 ? Math.atan2(inp.y, inp.x) : p.face;
          p.kickCd = C.KICK_CD; p.kickFx = 0.18;
          ball.vx = Math.cos(aim) * C.KICK_V + p.vx * 0.3;
          ball.vy = Math.sin(aim) * C.KICK_V + p.vy * 0.3;
          ball.lastTouch = pid; p.touches++; release(p);
          ctx.fx('kick', { id: pid, x: r1(ball.x), y: r1(ball.y) });
          ctx.buzz(pid, 40);
          return;
        }
        if (p.slideCd > 0) return; // SLIDE TACKLE: a quick lunge forward; it steals the ball from whoever carries it
        const aim = Math.hypot(inp.x, inp.y) > 0.3 ? Math.atan2(inp.y, inp.x) : p.face;
        p.slide = SLIDE_T; p.slideCd = SLIDE_CD; p.sdx = Math.cos(aim); p.sdy = Math.sin(aim); p.face = aim;
        ctx.fx('slide', { id: pid, x: r1(p.x), y: r1(p.y) });
        ctx.buzz(pid, 30);
        hud(p);
      },

      tick(dt) {
        if (celebrate > 0) {
          celebrate -= dt;
          if (celebrate <= 0 && !over) kickoff();
        } else {
          time += dt;
        }
        for (const p of ps) {
          p.kickCd = Math.max(0, p.kickCd - dt); p.kickFx = Math.max(0, p.kickFx - dt);
          const hadSl = p.slideCd <= 0 && p.rec <= 0;
          p.noPick = Math.max(0, p.noPick - dt); p.slideCd = Math.max(0, p.slideCd - dt); p.rec = Math.max(0, p.rec - dt);
          if (p.slide > 0) { // sliding: committed, can't steer; ends in a short recovery
            p.slide -= dt;
            p.vx = p.sdx * SLIDE_V * (0.4 + 0.6 * (p.slide / SLIDE_T)); p.vy = p.sdy * SLIDE_V * (0.4 + 0.6 * (p.slide / SLIDE_T));
            if (p.slide <= 0) { p.rec = REC_T; p.vx *= 0.3; p.vy *= 0.3; }
            integrate(p, dt);
            p.x = Math.max(-C.HW + p.r, Math.min(C.HW - p.r, p.x)); p.y = Math.max(-C.HH + p.r, Math.min(C.HH - p.r, p.y));
            // contact: steal from a carrier, or win a loose ball
            const target = owner && owner.team !== p.team && Math.hypot(owner.x - p.x, owner.y - p.y) < p.r + owner.r + 22 ? owner : null;
            if (target) { target.rec = 0.55; target.noPick = 0.8; owner = null; give(p); ctx.fx('steal', { id: p.id, from: target.id, x: r1(ball.x), y: r1(ball.y) }); ctx.buzz(target.id, 120); ctx.buzz(p.id, 60); }
            else if (!owner && p.noPick <= 0 && Math.hypot(ball.x - p.x, ball.y - p.y) < p.r + ball.r + 26) give(p);
            continue;
          }
          const inp = ctx.input(p.id);
          if (hadSl !== (p.slideCd <= 0 && p.rec <= 0)) hud(p);
          const want = celebrate <= 0 && (inp.b & BTN.B) !== 0 && p.stamina > 4 && Math.hypot(inp.x, inp.y) > 0.2;
          p.sprinting = want;
          p.stamina = want ? Math.max(0, p.stamina - C.STAMINA_USE * dt) : Math.min(100, p.stamina + C.STAMINA_REGEN * dt);
          const k = celebrate > 0 ? 0 : (want ? C.SPRINT_K : 1) * (p.rec > 0 ? 0.35 : owner === p ? 0.92 : 1);
          p.vx += inp.x * C.ACC * k * dt; p.vy += inp.y * C.ACC * k * dt;
          if (Math.hypot(inp.x, inp.y) > 0.25) p.face = Math.atan2(inp.y, inp.x);
          damp(p, C.KEEP, dt);
          integrate(p, dt);
          p.x = Math.max(-C.HW + p.r, Math.min(C.HW - p.r, p.x));
          p.y = Math.max(-C.HH + p.r, Math.min(C.HH - p.r, p.y));
        }
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) collide(ps[i], ps[j], 0.5);
        for (const p of ps) { p.x = Math.max(-C.HW + p.r, Math.min(C.HW - p.r, p.x)); p.y = Math.max(-C.HH + p.r, Math.min(C.HH - p.r, p.y)); }

        // ball: carried in front of its owner, otherwise rolls free; the first free player to touch it picks it up
        if (owner) {
          const rr = owner.r + ball.r + 2, tx = owner.x + Math.cos(owner.face) * rr, ty = owner.y + Math.sin(owner.face) * rr;
          const k = Math.min(1, 22 * dt);
          ball.x += (tx - ball.x) * k; ball.y += (ty - ball.y) * k; ball.vx = owner.vx; ball.vy = owner.vy; ball.lastTouch = owner.id;
        } else {
          damp(ball, C.BALL_KEEP, dt);
          integrate(ball, dt);
          const sp0 = Math.hypot(ball.vx, ball.vy);
          let pick: Pl | null = null, pd = Infinity;
          for (const p of ps) {
            if (p.noPick > 0 || p.rec > 0 || p.slide > 0) continue;
            const d = Math.hypot(ball.x - p.x, ball.y - p.y);
            if (d < p.r + ball.r + 8 && d < pd && sp0 < 640) { pd = d; pick = p; }
          }
          if (pick) give(pick);
          else for (const p of ps) {
            const s = collide(p, ball, 0.35, 60); // a fast ball bounces off players that cannot take it yet
            if (s > 0) { ball.lastTouch = p.id; if (s > 220) ctx.fx('touch', { x: r1(ball.x), y: r1(ball.y) }); }
          }
        }
        for (const po of posts) if (collide(po, ball, 0.8) > 120) ctx.fx('post', { x: po.x, y: po.y });
        const inMouth = Math.abs(ball.y) < C.GOAL_HALF - 4;
        if (celebrate <= 0 && Math.abs(ball.x) > C.HW + 4 && inMouth) goal(ball.x > 0 ? 0 : 1);
        // walls: side lines; end lines except the goal mouths, back of the net
        if (Math.abs(ball.y) > (inMouth && Math.abs(ball.x) > C.HW ? C.GOAL_HALF : C.HH) - ball.r) {
          const lim = (inMouth && Math.abs(ball.x) > C.HW ? C.GOAL_HALF : C.HH) - ball.r;
          ball.y = Math.sign(ball.y) * lim; ball.vy *= -0.75;
        }
        const xl = inMouth ? C.HW + C.GOAL_DEPTH - ball.r : C.HW - ball.r;
        if (Math.abs(ball.x) > xl) { ball.x = Math.sign(ball.x) * xl; ball.vx *= -0.6; }
        const sp = Math.hypot(ball.vx, ball.vy);
        if (sp > 1100) { ball.vx *= 1100 / sp; ball.vy *= 1100 / sp; }

        // match clock / overtime
        if (!ot && time >= total && celebrate <= 0) {
          if (score[0] !== score[1]) over = true;
          else { ot = true; otEnd = time + C.OT; ctx.fx('overtime'); ps.forEach(hud); }
        }
        if (ot && time >= otEnd && celebrate <= 0) over = true;
        hudT += dt;
        if (hudT > 0.5) { hudT = 0; ps.forEach(hud); }
      },

      snapshot() {
        return {
          t: r1(time), left: Math.max(0, Math.ceil((ot ? otEnd : total) - time)), ot: ot ? 1 : 0,
          sc: score, cel: celebrate > 0 ? 1 : 0, ls: lastScorer ?? '',
          b: [{ id: 'ball', x: Math.round(ball.x), y: Math.round(ball.y) }],
          o: owner ? owner.id : '',
          p: ps.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), a: Math.round(p.face * 100) / 100, tm: p.team, k: p.kickFx > 0 ? 1 : 0, s: p.sprinting ? 1 : 0, ...(p.slide > 0 ? { l: 1 } : {}), ...(p.rec > 0 ? { r: 1 } : {}) })),
        };
      },

      isOver: () => over,

      standings(): StandingRow[] {
        const win = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
        // team result first, then goals; players of the same team and result share a place
        const rank = (p: Pl) => (win === -1 ? 1 : p.team === win ? 2 : 0);
        return [...ps].sort((a, b) => rank(b) - rank(a) || b.goals - a.goals).map((p) => ({
          playerId: p.id, score: p.goals,
          detail: `${p.goals} goals · ${score[p.team]}–${score[1 - p.team]}`,
          tie: rank(p),
        }));
      },
    };
  },
};
