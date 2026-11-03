import { BOARD, makeBoard, type TileKind } from '../../shared/board';
import { BTN } from '../../shared/protocol';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// FAMILY BOARD PARTY: take turns rolling dice around a loop, collect coins, buy stars (the star keeps moving),
// draw power cards, duel rivals, and play a tap-race minigame at the end of every round. Most stars wins.
// Everything is decided here; phones only send A ("roll / yes") and B ("power / no").
export { BOARD };
export const BOARDC = {
  START_COINS: 5, ROLL_TIMEOUT: 14, BUY_TIMEOUT: 10, STEP: 0.38, LAND_PAUSE: 1.5, MINI_TIME: 5, DUEL_TIME: 3.5, RESULT_PAUSE: 2.2,
  PASS_START: 2, MINI_PRIZE: [5, 3, 1],
} as const;

type Ph = 'roll' | 'move' | 'buy' | 'land' | 'duel' | 'mini' | 'result' | 'done';
type Power = '' | 'double' | 'steal';

interface Pl { id: string; pos: number; coins: number; stars: number; power: Power; taps: number }

export const boardGame: GameModule = {
  id: 'board',
  create(ctx: GameContext): GameInstance {
    const C = BOARDC;
    const rounds = ctx.options.rounds ?? 8;
    const seed = Math.floor(ctx.rand() * 1e9);
    const tiles: TileKind[] = makeBoard(seed);
    const N = tiles.length;
    const ps: Pl[] = ctx.players.map((p) => ({ id: p.id, pos: 0, coins: C.START_COINS, stars: 0, power: '', taps: 0 }));
    const byId = new Map(ps.map((p) => [p.id, p]));
    let starAt = 1 + Math.floor(ctx.rand() * (N - 1));
    let round = 1, turn = 0;
    let ph: Ph = 'roll';
    let timer: number = C.ROLL_TIMEOUT;
    let time = 0;
    let dice: number[] = [];
    let steps = 0;
    let stepT = 0;
    let doubleActive = false;
    let msg: { k: string; [x: string]: unknown } | null = null;
    let duel: { a: string; b: string } | null = null;
    let miniKind: 'round' | 'duel' = 'round';
    let results: { id: string; taps: number; prize: number }[] = [];
    let after: (() => void) | null = null; // what happens when the current pause ends
    const active = () => ps[turn];

    function say(k: string, extra: Record<string, unknown> = {}) { msg = { k, ...extra }; ctx.fx('msg', msg); }
    function hudAll() {
      const who = ctx.players.find((x) => x.id === active().id)?.name ?? '';
      for (const p of ps) ctx.hud(p.id, { who, me: p.id === active().id ? 1 : 0, ph, coins: p.coins, stars: p.stars, power: p.power, can: p.coins >= BOARD.STAR_COST ? 1 : 0, mini: ph === 'mini' || ph === 'duel' ? 1 : 0, taps: p.taps, round, rounds });
    }
    function startTurn() {
      ph = 'roll'; timer = C.ROLL_TIMEOUT; dice = []; msg = null; doubleActive = false;
      ctx.fx('turn', { id: active().id });
      ctx.buzz(active().id, 120);
      hudAll();
    }
    function pause(seconds: number, then: () => void, phase: Ph = 'land') { ph = phase; timer = seconds; after = then; hudAll(); }
    function nextPlayer() {
      turn++;
      if (turn >= ps.length) { turn = 0; startMini('round'); return; }
      startTurn();
    }
    function startMini(kind: 'round' | 'duel') {
      miniKind = kind;
      ps.forEach((p) => { p.taps = 0; });
      ph = kind === 'round' ? 'mini' : 'duel';
      timer = kind === 'round' ? C.MINI_TIME : C.DUEL_TIME;
      ctx.fx('mini', { kind });
      hudAll();
    }
    function endMini() {
      if (miniKind === 'duel' && duel) {
        const a = byId.get(duel.a)!, b = byId.get(duel.b)!;
        const w = a.taps === b.taps ? null : a.taps > b.taps ? a : b, l = w === a ? b : a;
        results = [a, b].map((p) => ({ id: p.id, taps: p.taps, prize: w && p === w ? 3 : 0 }));
        if (w) { const take = Math.min(3, l.coins); l.coins -= take; w.coins += take; ctx.fx('coin', { id: w.id, n: take }); }
        say('duelResult', { w: w?.id ?? '', l: l?.id ?? '' });
        duel = null;
        pause(C.RESULT_PAUSE, nextPlayer, 'result');
        return;
      }
      const order = [...ps].sort((a, b) => b.taps - a.taps);
      results = order.map((p, i) => ({ id: p.id, taps: p.taps, prize: p.taps > 0 ? C.MINI_PRIZE[i] ?? 0 : 0 }));
      results.forEach((r) => { byId.get(r.id)!.coins += r.prize; if (r.prize) ctx.fx('coin', { id: r.id, n: r.prize }); });
      say('miniResult');
      pause(C.RESULT_PAUSE + 0.8, () => {
        if (round >= rounds) { ph = 'done'; hudAll(); return; }
        round++; startTurn();
      }, 'result');
    }

    function gain(p: Pl, n: number) {
      const before = p.coins;
      p.coins = Math.max(0, p.coins + n);
      ctx.fx(n >= 0 ? 'coin' : 'lose', { id: p.id, n: p.coins - before });
    }
    function arrive(p: Pl, last: boolean) {
      if (p.pos === 0 && !last) { gain(p, C.PASS_START); say('passStart', { id: p.id }); }
      if (p.pos === starAt && p.coins >= BOARD.STAR_COST) {
        ph = 'buy'; timer = C.BUY_TIMEOUT; hudAll();
        after = () => { if (steps > 0) { ph = 'move'; stepT = C.STEP; hudAll(); } else land(p); };
        ctx.fx('starOffer', { id: p.id });
        return true;
      }
      return false;
    }
    function land(p: Pl) {
      const k = tiles[p.pos];
      ctx.fx('land', { id: p.id, tile: k, pos: p.pos });
      switch (k) {
        case 'coin3': gain(p, 3); say('coin', { id: p.id, n: 3 }); break;
        case 'coin5': gain(p, 5); say('coin', { id: p.id, n: 5 }); break;
        case 'trap': gain(p, -3); say('trap', { id: p.id }); break;
        case 'power': {
          if (!p.power) { p.power = ctx.rand() < 0.5 ? 'double' : 'steal'; say('power', { id: p.id, p: p.power }); } else { gain(p, 2); say('coin', { id: p.id, n: 2 }); }
          break;
        }
        case 'chance': {
          const others = ps.filter((o) => o !== p);
          const r = Math.floor(ctx.rand() * 6);
          if (r === 0) { gain(p, 6); say('chance', { id: p.id, c: 'plus6' }); }
          else if (r === 1) { gain(p, -4); say('chance', { id: p.id, c: 'minus4' }); }
          else if (r === 2 && others.length) { const o = others[Math.floor(ctx.rand() * others.length)]; [p.pos, o.pos] = [o.pos, p.pos]; say('chance', { id: p.id, c: 'swap', o: o.id }); }
          else if (r === 3 && others.length) {
            const lead = [...others].sort((a, b) => b.stars - a.stars || b.coins - a.coins)[0];
            const take = Math.min(3, lead.coins); lead.coins -= take; p.coins += take; ctx.fx('coin', { id: p.id, n: take }); say('chance', { id: p.id, c: 'steal', o: lead.id });
          }
          else if (r === 4) { p.pos = (p.pos + 3) % N; say('chance', { id: p.id, c: 'forward' }); }
          else { gain(p, 2); say('chance', { id: p.id, c: 'plus2' }); }
          break;
        }
        case 'duel': {
          const others = ps.filter((o) => o !== p);
          if (others.length) { const o = others[Math.floor(ctx.rand() * others.length)]; duel = { a: p.id, b: o.id }; say('duel', { a: p.id, b: o.id }); pause(1.2, () => startMini('duel'), 'land'); return; }
          break;
        }
        default: say('nothing', { id: p.id });
      }
      pause(C.LAND_PAUSE, nextPlayer);
    }
    function roll(p: Pl) {
      const n = doubleActive ? 2 : 1;
      dice = Array.from({ length: n }, () => 1 + Math.floor(ctx.rand() * 6));
      steps = dice.reduce((a, b) => a + b, 0);
      ctx.fx('roll', { id: p.id, dice });
      ph = 'move'; stepT = 0.9; // let the dice animation play
      hudAll();
    }

    startTurn();

    return {
      onPress(pid, btn) {
        const p = byId.get(pid);
        if (!p) return;
        if (ph === 'mini' || ph === 'duel') {
          if (btn === BTN.A && (ph === 'mini' || (duel && (pid === duel.a || pid === duel.b)))) { p.taps++; if (p.taps % 5 === 0) ctx.buzz(pid, 15); }
          return;
        }
        if (pid !== active().id) return;
        if (ph === 'roll') {
          if (btn === BTN.A) roll(p);
          else if (btn === BTN.B && p.power) {
            if (p.power === 'double') { doubleActive = true; p.power = ''; ctx.fx('usePower', { id: pid, p: 'double' }); hudAll(); }
            else {
              const others = ps.filter((o) => o !== p && o.coins > 0);
              const v = others.sort((a, b) => b.coins - a.coins)[0];
              p.power = '';
              if (v) { const take = Math.min(4, v.coins); v.coins -= take; p.coins += take; ctx.fx('usePower', { id: pid, p: 'steal', o: v.id, n: take }); }
              hudAll();
            }
          }
        } else if (ph === 'buy') {
          if (btn === BTN.A && p.coins >= BOARD.STAR_COST) {
            p.coins -= BOARD.STAR_COST; p.stars++;
            ctx.fx('star', { id: pid, pos: starAt }); ctx.buzz(pid, 300);
            const old = starAt;
            do { starAt = 1 + Math.floor(ctx.rand() * (N - 1)); } while (starAt === old);
            say('star', { id: pid });
            const a = after; after = null; a?.();
          } else if (btn === BTN.B) { const a = after; after = null; a?.(); }
        }
      },

      tick(dt) {
        time += dt;
        if (ph === 'done') return;
        const act = active();
        timer -= dt;
        if (ph === 'roll') {
          if (timer <= 0 || (!ctx.connected(act.id) && timer < C.ROLL_TIMEOUT - 1.5)) roll(act); // idle or gone: roll for them
        } else if (ph === 'move') {
          stepT -= dt;
          if (stepT <= 0) {
            if (steps > 0) {
              act.pos = (act.pos + 1) % N; steps--; stepT = C.STEP;
              ctx.fx('step', { id: act.id });
              if (arrive(act, steps === 0)) return;
              if (steps === 0) land(act);
            } else land(act);
          }
        } else if (ph === 'buy') {
          if (timer <= 0 || !ctx.connected(act.id)) { const a = after; after = null; a?.(); }
        } else if (ph === 'land' || ph === 'result') {
          if (timer <= 0) { const a = after; after = null; a?.(); }
        } else if (ph === 'mini' || ph === 'duel') {
          if (timer <= 0) endMini();
          // players who are gone never tap: that is fine, they simply score nothing
        }
      },

      snapshot() {
        return {
          t: Math.round(time * 10) / 10, sd: seed, ph, round, rounds, turn: act(), dice, star: starAt, msg,
          tm: ph === 'mini' || ph === 'duel' ? Math.max(0, Math.ceil(timer)) : -1,
          du: duel ? [duel.a, duel.b] : null,
          res: ph === 'result' ? results : null,
          p: ps.map((p) => ({ id: p.id, pos: p.pos, c: p.coins, s: p.stars, w: p.power, tp: p.taps })),
        };
        function act() { return active().id; }
      },

      isOver: () => ph === 'done',

      standings(): StandingRow[] {
        return [...ps].sort((a, b) => b.stars - a.stars || b.coins - a.coins).map((p) => ({
          playerId: p.id, score: p.stars, detail: `${p.stars}★ · ${p.coins}`, tie: p.stars * 1000 + p.coins,
        }));
      },
    };
  },
};
