import { BTN } from '../../shared/protocol';
import { r1 } from '../util';
import { BOWL, PINS } from '../../shared/minigames';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// CRAZY BOWLING: turn based. Aim with the stick, press to lock the aim, press again to stop the power meter.
// Ten pins, two rolls per frame. Pins knock each other over; strikes and spares give bonus points.

type Ph = 'aim' | 'power' | 'roll' | 'pause' | 'done';
interface Pl { id: string; frames: number[][]; total: number }

export const bowlingGame: GameModule = {
  id: 'bowling',
  create(ctx: GameContext): GameInstance {
    const FRAMES = ctx.options.frames ?? 4;
    const ps: Pl[] = ctx.players.map((p) => ({ id: p.id, frames: [], total: 0 }));
    let turn = 0, frame = 0, roll = 0, ph: Ph = 'aim', pt = 0;
    let standing = PINS.map(() => true);
    let aim = 0, power = 0, pdir = 1, hook = 0, ballY = 0, lastHit = 0, done = false, time = 0;
    let anim: { x0: number; x1: number; hits: number[] } | null = null;
    const cur = () => ps[turn];
    const hud = () => ps.forEach((p, i) => ctx.hud(p.id, { me: i === turn ? 1 : 0, ph, who: cur().id === p.id ? '' : ctx.players[turn].name, fr: frame + 1, frs: FRAMES, roll: roll + 1, total: p.total }));
    hud();

    function resolve() {
      // the ball travels from lane bottom to top; its lateral drift grows with an off-sweet-spot power
      const curve = hook * 100; // the stick during the power phase bends the throw
      const x0 = aim * 100, x1 = x0 + curve;
      const hits: number[] = [];
      const speed = 0.45 + power * 0.65;
      PINS.forEach((pin, i) => {
        if (!standing[i]) return;
        const k = (130 - pin.y) / 260 + 0.5; // 0..1 progress along lane when reaching the pin row
        const bx = x0 + (x1 - x0) * Math.min(1, Math.max(0, k));
        if (Math.abs(pin.x - bx) < BOWL.PIN_R + BOWL.BALL_R - 4 && power > 0.3) hits.push(i); // a weak roll never reaches the pins
      });
      // chain reaction: knocked pins knock neighbours with a probability that grows with speed
      const down = new Set(hits);
      for (let pass = 0; pass < 3; pass++) {
        for (const i of [...down]) PINS.forEach((q, j) => {
          if (!standing[j] || down.has(j)) return;
          const d = Math.hypot(q.x - PINS[i].x, q.y - PINS[i].y);
          if (d < 62 && ctx.rand() < 0.35 + speed * 0.45) down.add(j);
        });
      }
      anim = { x0, x1, hits: [...down] };
      return [...down];
    }
    function nextTurn() {
      if (roll === 0 && standing.some((s) => s)) { roll = 1; } else {
        roll = 0; standing = PINS.map(() => true); turn++;
        if (turn >= ps.length) { turn = 0; frame++; if (frame >= FRAMES) { done = true; ph = 'done'; hud(); return; } }
      }
      ph = 'aim'; pt = 0; aim = 0; hud();
    }
    function lock() {
      if (ph === 'aim') { ph = 'power'; pt = 0; power = 0; pdir = 1; }
      else if (ph === 'power') {
        hook = Math.max(-1, Math.min(1, ctx.input(cur().id).x));
        const fell = resolve();
        const p = cur();
        const n = fell.length;
        for (const i of fell) standing[i] = false;
        (p.frames[frame] ??= []).push(n);
        let pts = n;
        if (n === 10 && roll === 0) pts += 5; // strike
        else if (!standing.some((s) => s) && roll === 1) pts += 3; // spare
        p.total += pts; lastHit = n;
        ph = 'roll'; pt = 0; ballY = 0;
        ctx.fx('roll', { id: p.id });
      }
    }
    return {
      onPress(pid, b) { if (b === BTN.A && !done && pid === cur().id && (ph === 'aim' || ph === 'power')) lock(); },
      tick(dt) {
        time += dt; pt += dt;
        if (done) return;
        const p = cur();
        if (ph === 'aim') {
          const inp = ctx.input(p.id);
          aim = Math.max(-1, Math.min(1, aim + inp.x * 1.6 * dt));
          if (!ctx.connected(p.id) || pt > BOWL.AIM_T) lock();
        } else if (ph === 'power') {
          power += pdir * 1.5 * dt;
          if (power >= 1) { power = 1; pdir = -1; } else if (power <= 0) { power = 0; pdir = 1; }
          if (!ctx.connected(p.id) || pt > BOWL.POWER_T) lock();
        } else if (ph === 'roll') {
          ballY = Math.min(1, pt / BOWL.ROLL_T);
          if (pt >= BOWL.ROLL_T) {
            ctx.fx(lastHit === 10 ? 'strike' : lastHit === 0 ? 'gutter' : 'pins', { id: p.id, n: lastHit });
            if (lastHit) ctx.buzz(p.id, 100);
            ph = 'pause'; pt = 0;
          }
        } else if (ph === 'pause' && pt > 1.3) nextTurn();
      },
      snapshot: () => ({
        t: r1(time), ph, turn: ps[turn].id, fr: frame + 1, frs: FRAMES, roll: roll + 1,
        aim: Math.round(aim * 100) / 100, pw: Math.round(power * 100) / 100, hk: ph === 'power' ? Math.round(Math.max(-1, Math.min(1, ctx.input(ps[turn].id).x)) * 10) / 10 : Math.round(hook * 10) / 10, by: Math.round(ballY * 100) / 100,
        an: ph === 'roll' || ph === 'pause' ? anim : null, pin: standing.map((s) => (s ? 1 : 0)).join(''),
        p: ps.map((p) => ({ id: p.id, s: p.total, f: p.frames.map((f) => f.join('/')).join(' ') })),
      }),
      isOver: () => done,
      standings: (): StandingRow[] => [...ps].sort((a, b) => b.total - a.total).map((p) => ({ playerId: p.id, score: p.total, detail: `${p.total} pts`, tie: p.total })),
    };
  },
};
