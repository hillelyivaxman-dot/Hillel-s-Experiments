import { BTN } from '../../shared/protocol';
import { r1 } from '../util';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// REACTION DUEL: wait for green, tap first. Early taps cost a point. Fake-outs from round 2.
type Phase = 'wait' | 'fake' | 'go' | 'show' | 'done';

interface Tap { ms: number | null; early: boolean }

export const reactionGame: GameModule = {
  id: 'reaction',
  create(ctx: GameContext): GameInstance {
    const rounds = ctx.options.rounds ?? 5;
    const ids = ctx.players.map((p) => p.id);
    const score = new Map(ids.map((id) => [id, 0]));
    const times = new Map<string, number[]>(ids.map((id) => [id, []]));
    let round = 0;
    let ph: Phase = 'wait';
    let time = 0;
    let goAt = 0; // game time
    let goAtMs = 0; // server clock
    let fakeAt = -1;
    let phEnd = 0;
    let taps = new Map<string, Tap>();
    let lastWinner: string | null = null;

    function startRound() {
      round++;
      ph = 'wait';
      taps = new Map();
      goAt = time + 1.8 + ctx.rand() * 3;
      fakeAt = round >= 2 && ctx.rand() < 0.4 ? time + 0.7 + ctx.rand() * Math.max(0.2, goAt - time - 1.3) : -1;
      lastWinner = null;
      ids.forEach((id) => ctx.hud(id, { round, rounds, msg: 'wait', score: score.get(id)! }));
    }
    startRound();

    function award() {
      const valid = [...taps.entries()].filter(([, t]) => t.ms !== null).sort((a, b) => a[1].ms! - b[1].ms!);
      const pts = [3, 2, 1];
      valid.forEach(([id, t], i) => {
        if (i < pts.length) score.set(id, score.get(id)! + pts[i]);
        times.get(id)!.push(t.ms!);
      });
      lastWinner = valid[0]?.[0] ?? null;
      if (lastWinner) { ctx.fx('win', { id: lastWinner }); ctx.buzz(lastWinner, 200); }
      ids.forEach((id) => ctx.hud(id, { round, rounds, msg: 'show', score: score.get(id)! }));
    }

    return {
      onPress(pid, btn, at) {
        if (btn !== BTN.A || !score.has(pid) || taps.has(pid)) return;
        if (ph === 'wait' || ph === 'fake') {
          taps.set(pid, { ms: null, early: true });
          score.set(pid, score.get(pid)! - 1);
          ctx.fx('early', { id: pid });
          ctx.buzz(pid, 350);
          ctx.hud(pid, { round, rounds, msg: 'early', score: score.get(pid)! });
        } else if (ph === 'go') {
          // compensate for network: half of host-screen RTT (seeing) + half of phone RTT (tapping)
          const ms = Math.max(0, Math.round(at - goAtMs - ctx.hostRtt() / 2 - ctx.rtt(pid) / 2));
          taps.set(pid, { ms, early: false });
          ctx.fx('tap', { id: pid, ms });
          ctx.hud(pid, { round, rounds, msg: 'tapped', ms, score: score.get(pid)! });
        }
      },

      tick(dt) {
        time += dt;
        if (ph === 'wait' && fakeAt > 0 && time >= fakeAt) { ph = 'fake'; phEnd = time + 0.6; ctx.fx('fake'); }
        else if (ph === 'fake' && time >= phEnd) { ph = 'wait'; fakeAt = -1; }
        if (ph === 'wait' && time >= goAt) {
          ph = 'go';
          goAtMs = ctx.now();
          phEnd = time + 2.5;
          ctx.fx('go');
        } else if (ph === 'go') {
          const waiting = ids.filter((id) => !taps.has(id) && ctx.connected(id));
          if (waiting.length === 0 || time >= phEnd) {
            award();
            ph = 'show';
            phEnd = time + 2.6;
          }
        } else if (ph === 'show' && time >= phEnd) {
          if (round >= rounds) ph = 'done';
          else startRound();
        }
      },

      snapshot() {
        return {
          t: r1(time), ph, round, rounds, w: lastWinner,
          s: ids.map((id) => {
            const tp = taps.get(id);
            return { id, sc: score.get(id)!, ms: tp?.ms ?? -1, e: tp?.early ? 1 : 0, tp: tp ? 1 : 0 };
          }),
        };
      },

      isOver: () => ph === 'done',

      standings(): StandingRow[] {
        const avg = (id: string) => {
          const t = times.get(id)!;
          return t.length ? t.reduce((a, b) => a + b, 0) / t.length : 99999;
        };
        return [...ids]
          .sort((a, b) => score.get(b)! - score.get(a)! || avg(a) - avg(b))
          .map((id) => ({
            playerId: id,
            score: score.get(id)!,
            detail: times.get(id)!.length ? `${Math.round(avg(id))} ms` : '—',
            tie: score.get(id)!,
          }));
      },
    };
  },
};
