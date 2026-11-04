import { BTN } from '../../shared/protocol';
import { HOCKEY } from '../../shared/hockey';
import { r1 } from '../util';
import { collide, damp, integrate, type Body } from './physics';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// AIR HOCKEY: 1v1 or 2v2 (teams alternate by join order). Mallets are confined to their own half and driven
// by the stick; SMASH is a short speed burst. First to 7 goals, or most goals after 2.5 minutes (tie = sudden death).
export { HOCKEY };

interface Mallet extends Body { id: string; team: 0 | 1; boostT: number; boostCd: number; goals: number }

export const hockeyGame: GameModule = {
  id: 'hockey',
  create(ctx: GameContext): GameInstance {
    const C = HOCKEY;
    const total = ctx.options.time ?? C.MAX_TIME;
    const winGoals = ctx.options.goals ?? C.WIN_GOALS;
    let time = 0, pause = 0, over = false, sudden = false, suddenEnd = 0;
    let lastScorer: string | null = null;
    let stall = 0; // seconds the puck has been (almost) still
    const score: [number, number] = [0, 0];
    const puck: Body & { lastTouch: string | null } = { x: 0, y: 0, vx: 0, vy: 0, r: C.PUCK_R, m: 1, lastTouch: null };
    const ms: Mallet[] = ctx.players.map((p, i) => ({
      id: p.id, team: (i % 2) as 0 | 1, x: 0, y: 0, vx: 0, vy: 0, r: C.MALLET_R, m: 9, boostT: 0, boostCd: 0, goals: 0,
    }));
    const byId = new Map(ms.map((m) => [m.id, m]));

    function placeMallets() {
      const side = [[], []] as Mallet[][];
      ms.forEach((m) => side[m.team].push(m));
      for (const t of [0, 1] as const) side[t].forEach((m, k) => {
        m.x = (t === 0 ? -1 : 1) * 330; m.y = side[t].length === 1 ? 0 : (k === 0 ? -1 : 1) * 110; m.vx = 0; m.vy = 0;
      });
    }
    function serve(toward: 0 | 1 | null) {
      puck.x = toward === null ? 0 : (toward === 0 ? -1 : 1) * 150; puck.y = 0; puck.vx = 0; puck.vy = 0; puck.lastTouch = null;
      placeMallets();
    }
    serve(null);
    const hud = (m: Mallet) => ctx.hud(m.id, { team: m.team, a: score[0], b: score[1], smash: m.boostCd <= 0 ? 1 : 0, sd: sudden ? 1 : 0 });
    ms.forEach(hud);
    let hudT = 0;

    function scored(team: 0 | 1) {
      score[team]++;
      const s = puck.lastTouch ? byId.get(puck.lastTouch) : null;
      if (s && s.team === team) s.goals++;
      lastScorer = s && s.team === team ? s.id : null;
      pause = C.SERVE_PAUSE;
      ctx.fx('goal', { team, id: lastScorer ?? '', x: team === 0 ? C.HW : -C.HW });
      ms.forEach((m) => { ctx.buzz(m.id, m.team === team ? 250 : 100); hud(m); });
      if (score[team] >= winGoals || sudden) over = true;
      else serve(team === 0 ? 1 : 0);
    }

    return {
      onPress(pid, btn) {
        const m = byId.get(pid);
        if (!m || btn !== BTN.A || m.boostCd > 0 || pause > 0) return;
        m.boostT = C.BOOST_T; m.boostCd = C.BOOST_CD;
        ctx.fx('smash', { id: pid });
        hud(m);
      },

      tick(dt) {
        if (pause > 0) { pause -= dt; } else time += dt;
        for (const m of ms) {
          const had = m.boostCd <= 0;
          m.boostT = Math.max(0, m.boostT - dt); m.boostCd = Math.max(0, m.boostCd - dt);
          if (!had && m.boostCd <= 0) hud(m);
          const inp = pause > 0 ? { x: 0, y: 0 } : ctx.input(m.id);
          const max = C.MAXV * (m.boostT > 0 ? C.BOOST_K : 1);
          const x0 = m.team === 0 ? -C.HW + m.r : m.r + 8, x1 = m.team === 0 ? -m.r - 8 : C.HW - m.r;
          let tx = inp.x * max, ty = inp.y * max;
          const abs = pause <= 0 && (ctx.input(m.id).b & BTN.M) !== 0; // touchpad: the finger IS the mallet (x, y = position over your half, -1..1)
          if (abs) {
            const gx = x0 + ((inp.x + 1) / 2) * (x1 - x0), gy = inp.y * (C.HH - m.r);
            tx = Math.max(-max, Math.min(max, (gx - m.x) * 16)); ty = Math.max(-max, Math.min(max, (gy - m.y) * 16));
          }
          const step = (abs ? C.ACC * 2.2 : C.ACC) * dt;
          m.vx += Math.max(-step, Math.min(step, tx - m.vx));
          m.vy += Math.max(-step, Math.min(step, ty - m.vy));
          integrate(m, dt);
          if (m.x < x0) { m.x = x0; m.vx = Math.max(0, m.vx); }
          if (m.x > x1) { m.x = x1; m.vx = Math.min(0, m.vx); }
          if (Math.abs(m.y) > C.HH - m.r) { m.y = Math.sign(m.y) * (C.HH - m.r); m.vy = 0; }
        }
        for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) collide(ms[i], ms[j], 0.3);

        if (pause <= 0) {
          damp(puck, C.PUCK_KEEP, dt);
          integrate(puck, dt);
          for (const m of ms) {
            const mv = { vx: m.vx, vy: m.vy };
            const s = collide(m, puck, 1, 0);
            if (s > 0) {
              puck.lastTouch = m.id;
              // a mallet is player-driven: it keeps its velocity; give the puck a bit of the mallet's push too
              puck.vx += mv.vx * 0.25; puck.vy += mv.vy * 0.25;
              m.vx = mv.vx; m.vy = mv.vy;
              if (s > 160) { ctx.fx('hit', { x: r1(puck.x), y: r1(puck.y), s: Math.round(s) }); ctx.buzz(m.id, 25); }
            }
          }
          const inMouth = Math.abs(puck.y) < C.GOAL_HALF - puck.r * 0.3;
          if (Math.abs(puck.x) > C.HW + 2 && inMouth) scored(puck.x > 0 ? 0 : 1);
          else {
            if (Math.abs(puck.y) > C.HH - puck.r) { puck.y = Math.sign(puck.y) * (C.HH - puck.r); puck.vy *= -C.WALL_E; ctx.fx('wall', { x: r1(puck.x), y: r1(puck.y) }); }
            if (Math.abs(puck.x) > C.HW - puck.r && !inMouth) { puck.x = Math.sign(puck.x) * (C.HW - puck.r); puck.vx *= -C.WALL_E; ctx.fx('wall', { x: r1(puck.x), y: r1(puck.y) }); }
          }
          const sp = Math.hypot(puck.vx, puck.vy);
          if (sp > C.PUCK_MAX) { puck.vx *= C.PUCK_MAX / sp; puck.vy *= C.PUCK_MAX / sp; }
          // a dead puck (e.g. resting on the centre line, out of every mallet's reach) is nudged to the rival's half
          stall = Math.hypot(puck.vx, puck.vy) < 30 ? stall + dt : 0;
          if (stall > 2.2) {
            stall = 0;
            const last = puck.lastTouch ? byId.get(puck.lastTouch) : null;
            const toRight = last ? last.team === 0 : ctx.rand() < 0.5; // away from whoever touched it last
            puck.vx = (toRight ? 1 : -1) * 320; puck.vy = (ctx.rand() - 0.5) * 120;
            ctx.fx('nudge', { x: r1(puck.x), y: r1(puck.y) });
          }
          if (!over && !sudden && time >= total) {
            if (score[0] !== score[1]) over = true;
            else { sudden = true; suddenEnd = time + C.SUDDEN; ctx.fx('overtime'); ms.forEach(hud); }
          }
          if (sudden && time >= suddenEnd) over = true;
        }
        hudT += dt;
        if (hudT > 0.5) { hudT = 0; ms.forEach(hud); }
      },

      snapshot() {
        return {
          t: r1(time), left: Math.max(0, Math.ceil((sudden ? suddenEnd : total) - time)), sd: sudden ? 1 : 0, sc: score, to: winGoals,
          pz: pause > 0 ? 1 : 0, ls: lastScorer ?? '',
          b: [{ id: 'puck', x: Math.round(puck.x), y: Math.round(puck.y) }],
          p: ms.map((m) => ({ id: m.id, x: Math.round(m.x), y: Math.round(m.y), tm: m.team, bo: m.boostT > 0 ? 1 : 0 })),
        };
      },

      isOver: () => over && pause <= 0,

      standings(): StandingRow[] {
        const win = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
        const rank = (m: Mallet) => (win === -1 ? 1 : m.team === win ? 2 : 0);
        return [...ms].sort((a, b) => rank(b) - rank(a) || b.goals - a.goals).map((m) => ({
          playerId: m.id, score: m.goals, detail: `${m.goals} goals · ${score[m.team]}–${score[1 - m.team]}`, tie: rank(m),
        }));
      },
    };
  },
};
