import { BTN } from '../../shared/protocol';
import { DRAW_WORDS, TRIVIA } from '../../shared/words';
import { r1 } from '../util';
import type { GameContext, GameModule, StandingRow } from './types';

const shuffle = <T,>(a: T[], rand: () => number) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };

// ---------------- SPACE RACE ----------------
import { SPACE } from '../../shared/spacerace';
export { SPACE };
export const spaceRaceGame: GameModule = {
  id: 'spacerace',
  create(ctx: GameContext) {
    const rocks: { x: number; y: number; r: number }[] = [];
    for (let y = 700; y < SPACE.LEN - 300; y += 130 + ctx.rand() * 90) for (let k = 0; k < 2; k++) rocks.push({ x: 60 + ctx.rand() * (SPACE.W - 120), y: y + ctx.rand() * 80, r: 26 + ctx.rand() * 30 });
    const orbs: { x: number; y: number; got: boolean }[] = [];
    for (let y = 500; y < SPACE.LEN - 300; y += 600) orbs.push({ x: 100 + ctx.rand() * (SPACE.W - 200), y, got: false });
    const ps = ctx.players.map((p, i) => ({ id: p.id, x: 200 + (i * SPACE.W - 400) / Math.max(1, ctx.players.length) * 0.9 + 60, y: 0, vx: 0, hit: 0, boost: 0, energy: 60, fin: -1, spd: 0 }));
    let time = 0, endAt = Infinity;
    const order: string[] = [];
    const hud = () => { const o = [...ps].sort((a, b) => b.y - a.y); ps.forEach((p) => ctx.hud(p.id, { place: p.fin >= 0 ? order.indexOf(p.id) + 1 : o.indexOf(p) + 1, of: ps.length, pct: Math.min(100, Math.round((p.y / SPACE.LEN) * 100)), en: Math.round(p.energy), done: p.fin >= 0 ? 1 : 0 })); };
    hud();
    return {
      tick(dt) {
        time += dt;
        const lead = Math.max(...ps.map((p) => p.y));
        for (const p of ps) {
          if (p.fin >= 0) continue;
          const i = ctx.input(p.id);
          p.hit = Math.max(0, p.hit - dt);
          const wantB = (i.b & BTN.A) !== 0 && p.energy > 0;
          p.boost = wantB ? 1 : 0;
          p.energy = Math.max(0, Math.min(100, p.energy + (wantB ? -38 : 11) * dt));
          const rubber = 1 + Math.min(0.25, Math.max(0, (lead - p.y) / 3000));
          const target = (300 + (wantB ? 220 : 0) + i.y * -90) * rubber * (p.hit > 0 ? 0.4 : 1);
          p.spd += (target - p.spd) * Math.min(1, 3 * dt);
          p.y += p.spd * dt;
          p.vx += (i.x * 700 - p.vx) * Math.min(1, 6 * dt);
          p.x = Math.max(30, Math.min(SPACE.W - 30, p.x + p.vx * dt));
          for (const r of rocks) if (Math.abs(r.y - p.y) < r.r + 22 && Math.hypot(r.x - p.x, r.y - p.y) < r.r + 20 && p.hit <= 0) { p.hit = 1.1; p.spd *= 0.3; ctx.fx('crash', { id: p.id, x: Math.round(p.x), y: Math.round(p.y) }); ctx.buzz(p.id, 200); }
          for (const o of orbs) if (!o.got && Math.hypot(o.x - p.x, o.y - p.y) < 40) { o.got = true; p.energy = Math.min(100, p.energy + 40); ctx.fx('orb', { id: p.id, x: Math.round(o.x), y: Math.round(o.y) }); }
          if (p.y >= SPACE.LEN) { p.fin = time; order.push(p.id); ctx.fx('finish', { id: p.id, place: order.length }); if (endAt === Infinity) endAt = time + 15; }
        }
        if (Math.floor(time * 4) !== Math.floor((time - dt) * 4)) hud();
      },
      snapshot: () => ({
        t: r1(time), len: SPACE.LEN, cam: Math.round(Math.max(...ps.map((p) => p.y))),
        p: ps.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), h: p.hit > 0 ? 1 : 0, b: p.boost, f: p.fin >= 0 ? 1 : 0 })),
        r: rocks.filter((r) => r.y > Math.min(...ps.map((p) => p.y)) - 800 && r.y < Math.max(...ps.map((p) => p.y)) + 1200).map((r) => [Math.round(r.x), Math.round(r.y), Math.round(r.r)]),
        o: orbs.filter((o) => !o.got).map((o) => [Math.round(o.x), Math.round(o.y)]),
      }),
      isOver: () => ps.every((p) => p.fin >= 0) || time >= endAt || time > 180,
      standings: (): StandingRow[] => [...ps].sort((a, b) => (a.fin >= 0 && b.fin >= 0 ? a.fin - b.fin : a.fin >= 0 ? -1 : b.fin >= 0 ? 1 : b.y - a.y)).map((p) => ({ playerId: p.id, score: p.fin >= 0 ? r1(p.fin) : Math.round(p.y), detail: p.fin >= 0 ? `${p.fin.toFixed(1)}s` : `${Math.round((p.y / SPACE.LEN) * 100)}%`, tie: p.fin >= 0 ? Math.round(p.fin * 10) : -Math.round(p.y) })),
    };
  },
};

// ---------------- BALLOON PANIC ----------------
export const balloonGame: GameModule = {
  id: 'balloon',
  create(ctx: GameContext) {
    const TIME = ctx.options.time ?? 60;
    const newLimit = () => 6 + Math.floor(ctx.rand() * 16);
    const ps = ctx.players.map((p) => ({ id: p.id, pumps: 0, limit: newLimit(), bank: 0, pop: 0, bankAt: 0, pops: 0 }));
    let time = 0;
    const hud = (p: (typeof ps)[number]) => ctx.hud(p.id, { pumps: p.pumps, bank: p.bank, left: Math.max(0, Math.ceil(TIME - time)) });
    ps.forEach(hud);
    return {
      onPress(pid, b) {
        const p = ps.find((q) => q.id === pid); if (!p || time >= TIME) return;
        if (b === BTN.A) {
          p.pumps++;
          if (p.pumps >= p.limit) { ctx.fx('pop', { id: pid }); ctx.buzz(pid, 300); p.pop = 0.9; p.pops++; p.pumps = 0; p.limit = newLimit(); }
          else ctx.fx('pump', { id: pid, n: p.pumps });
          hud(p);
        } else if (b === BTN.B && p.pumps > 0) { p.bank += p.pumps + Math.floor(p.pumps / 4); ctx.fx('bank', { id: pid, v: p.pumps }); p.bankAt = time; p.pumps = 0; p.limit = newLimit(); hud(p); }
      },
      tick(dt) { time += dt; for (const p of ps) p.pop = Math.max(0, p.pop - dt); if (Math.floor(time) !== Math.floor(time - dt)) ps.forEach(hud); },
      snapshot: () => ({ t: r1(time), left: Math.max(0, Math.ceil(TIME - time)), p: ps.map((p) => ({ id: p.id, n: p.pumps, b: p.bank, pp: p.pop > 0 ? 1 : 0, pc: p.pops })) }),
      isOver: () => time >= TIME,
      standings: (): StandingRow[] => [...ps].sort((a, b) => b.bank - a.bank).map((p) => ({ playerId: p.id, score: p.bank, detail: `${p.bank} 🎈 (${p.pops}💥)`, tie: p.bank })),
    };
  },
};

// ---------------- TEAM PUZZLE (co-op memory) ----------------
export const puzzleGame: GameModule = {
  id: 'puzzle',
  create(ctx: GameContext) {
    const LEVELS = ctx.options.levels ?? 6;
    const n = ctx.players.length;
    const owner = [0, 1, 2, 3].map((c) => ctx.players[c % n].id);
    let level = 0, lives = 3, ph: 'show' | 'enter' | 'ok' | 'bad' | 'done' = 'show', pt = 0, pos = 0, time = 0, over = false, seq: number[] = [];
    const credit = new Map(ctx.players.map((p) => [p.id, 0]));
    const mkSeq = () => { seq = Array.from({ length: 3 + level }, () => Math.floor(ctx.rand() * 4)); };
    mkSeq();
    const showT = () => 1.2 + seq.length * 0.7;
    const hud = () => ctx.players.forEach((p) => ctx.hud(p.id, { mine: owner.map((o, c) => (o === p.id ? c : -1)).filter((c) => c >= 0).join(','), level: level + 1, levels: LEVELS, lives, ph, pos, len: seq.length }));
    hud();
    function setPh(p: typeof ph) { ph = p; pt = 0; hud(); }
    return {
      onPress(pid, btn) {
        if (ph !== 'enter') return;
        const c = btn === BTN.A ? 0 : btn === BTN.B ? 1 : btn === BTN.C ? 2 : btn === BTN.D ? 3 : -1;
        if (c < 0 || owner[c] !== pid) return;
        if (c === seq[pos]) {
          pos++; credit.set(pid, (credit.get(pid) ?? 0) + 1); ctx.fx('right', { c, pos });
          if (pos >= seq.length) { ctx.fx('level', { n: level + 1 }); setPh('ok'); } else hud();
        } else { ctx.fx('wrong', { c }); ctx.buzz(pid, 200); lives--; setPh('bad'); }
      },
      tick(dt) {
        time += dt; pt += dt;
        if (ph === 'show' && pt > showT()) setPh('enter');
        else if (ph === 'enter' && pt > 10 + seq.length * 3) { lives--; ctx.fx('wrong', { c: -1 }); setPh('bad'); }
        else if (ph === 'ok' && pt > 1.6) { level++; if (level >= LEVELS) { over = true; setPh('done'); } else { mkSeq(); pos = 0; setPh('show'); } }
        else if (ph === 'bad' && pt > 1.8) { if (lives <= 0) { over = true; setPh('done'); } else { pos = 0; setPh('show'); } }
      },
      snapshot: () => ({ t: r1(time), ph, pt: r1(pt), showT: r1(showT()), seq: ph === 'show' || ph === 'bad' || ph === 'ok' ? seq : [], len: seq.length, pos, level: level + 1, levels: LEVELS, lives, own: owner.map((o) => ctx.players.findIndex((p) => p.id === o)), p: ctx.players.map((p) => ({ id: p.id, c: credit.get(p.id) })) }),
      isOver: () => over,
      standings(): StandingRow[] {
        const solved = Math.min(level, LEVELS), stars = solved >= LEVELS ? 3 : solved >= Math.ceil(LEVELS / 2) ? 2 : 1;
        return ctx.players.map((p) => ({ playerId: p.id, score: credit.get(p.id) ?? 0, detail: `${solved}/${LEVELS} · ${credit.get(p.id)}`, stars })).sort((a, b) => b.score - a.score);
      },
    };
  },
};

// ---------------- DRAW & GUESS ----------------
export const drawGame: GameModule = {
  id: 'draw',
  create(ctx: GameContext) {
    const n = ctx.players.length;
    const ROUNDS = Math.min(ctx.options.rounds ?? n, 6) || 1;
    const order = shuffle(DRAW_WORDS.map((_, i) => i), ctx.rand);
    const pts = new Map(ctx.players.map((p) => [p.id, 0]));
    let round = 0, ph: 'draw' | 'reveal' | 'done' = 'draw', pt = 0, time = 0, over = false, ver = 0, tick = 0;
    let word = 0, opts: number[] = [], strokes: number[][] = [], cur = { x: 600, y: 350 }, pen = false, prevPen = false, correct = 0;
    const guess = new Map<string, number>();
    const drawer = () => ctx.players[round % n];
    function start() {
      word = order[round % order.length]; strokes = []; pen = false; cur = { x: 600, y: 350 }; guess.clear(); correct = 0; ver++;
      const others = shuffle(DRAW_WORDS.map((_, i) => i).filter((i) => i !== word), ctx.rand).slice(0, 3);
      opts = shuffle([word, ...others], ctx.rand);
      ph = 'draw'; pt = 0; hud();
    }
    const hud = () => ctx.players.forEach((p) => ctx.hud(p.id, { ph, drawer: p.id === drawer().id ? 1 : 0, who: drawer().name, word: p.id === drawer().id ? `${DRAW_WORDS[word].he}|${DRAW_WORDS[word].en}` : '', opts: opts.map((o) => `${DRAW_WORDS[o].he}|${DRAW_WORDS[o].en}`).join(';'), round: round + 1, rounds: ROUNDS, locked: guess.has(p.id) ? 1 : 0, pts: pts.get(p.id) ?? 0 }));
    start();
    const dirOf = (x: number, y: number) => (Math.hypot(x, y) < 0.35 ? -1 : Math.abs(x) > Math.abs(y) ? (x > 0 ? 1 : 3) : y < 0 ? 0 : 2); // up,right,down,left
    return {
      onPress(pid, b) {
        if (ph !== 'draw') return;
        if (pid === drawer().id) { if (b === BTN.B) { strokes = []; ver++; ctx.fx('clear', {}); } return; }
        if (b !== BTN.A || guess.has(pid)) return;
        const i = ctx.input(pid), d = dirOf(i.x, i.y);
        if (d < 0) return;
        guess.set(pid, d);
        if (opts[d] === word) {
          const bonus = Math.max(1, Math.round(10 - pt / 3)); correct++;
          pts.set(pid, (pts.get(pid) ?? 0) + bonus + 2); pts.set(drawer().id, (pts.get(drawer().id) ?? 0) + 3);
          ctx.fx('correct', { id: pid }); ctx.buzz(pid, 100);
        } else { ctx.fx('nope', { id: pid }); }
        hud();
        if (ctx.players.every((p) => p.id === drawer().id || guess.has(p.id) || !ctx.connected(p.id))) { ph = 'reveal'; pt = 0; hud(); }
      },
      tick(dt) {
        time += dt; pt += dt; tick++;
        if (ph === 'draw') {
          const d = ctx.input(drawer().id);
          cur.x = Math.max(20, Math.min(1180, cur.x + d.x * 520 * dt)); cur.y = Math.max(20, Math.min(680, cur.y + d.y * 520 * dt));
          pen = (d.b & BTN.A) !== 0;
          if (pen) {
            let s = strokes[strokes.length - 1];
            if (!prevPen || !s) { s = []; strokes.push(s); }
            const lx = s[s.length - 2], ly = s[s.length - 1];
            if (lx === undefined || Math.hypot(lx - cur.x, ly - cur.y) > 4) { if (s.length < 1200) s.push(Math.round(cur.x), Math.round(cur.y)); ver++; }
            if (strokes.length > 60) strokes.shift();
          }
          prevPen = pen;
          if (pt > 40 || !ctx.connected(drawer().id)) { ph = 'reveal'; pt = 0; hud(); }
        } else if (ph === 'reveal' && pt > 4) { round++; if (round >= ROUNDS) { over = true; ph = 'done'; } else start(); }
      },
      snapshot: () => ({
        t: r1(time), ph, pt: r1(pt), round: round + 1, rounds: ROUNDS, dr: drawer().id, cur, pen: pen ? 1 : 0, v: ver,
        ...(tick % 10 === 0 || ph === 'reveal' ? { st: strokes } : {}),
        word: ph === 'reveal' ? DRAW_WORDS[word] : null, opts: opts.map((o) => DRAW_WORDS[o]), ok: correct,
        p: ctx.players.map((p) => ({ id: p.id, s: pts.get(p.id) ?? 0, g: guess.has(p.id) ? 1 : 0 })),
      }),
      isOver: () => over,
      standings: (): StandingRow[] => ctx.players.map((p) => ({ playerId: p.id, score: pts.get(p.id) ?? 0, detail: `${pts.get(p.id)} pts`, tie: pts.get(p.id) ?? 0 })).sort((a, b) => b.score - a.score),
    };
  },
};

// ---------------- PARTY TRIVIA ----------------
export const triviaGame: GameModule = {
  id: 'trivia',
  create(ctx: GameContext) {
    const QN = ctx.options.questions ?? 8;
    const qs = shuffle(TRIVIA, ctx.rand).slice(0, Math.min(QN, TRIVIA.length)).map((q) => {
      const idx = shuffle([0, 1, 2, 3], ctx.rand); // shuffle answer positions
      return { q: q.q, a: idx.map((i) => q.a[i]), c: idx.indexOf(q.c) };
    });
    const pts = new Map(ctx.players.map((p) => [p.id, 0]));
    const streak = new Map(ctx.players.map((p) => [p.id, 0]));
    const ans = new Map<string, { v: number; at: number }>();
    let qi = 0, ph: 'ask' | 'reveal' | 'done' = 'ask', pt = 0, time = 0, over = false;
    const LIM = 14;
    const hud = () => ctx.players.forEach((p) => ctx.hud(p.id, { ph, q: qi + 1, qs: qs.length, pts: pts.get(p.id) ?? 0, ans: ans.has(p.id) ? ans.get(p.id)!.v : -1, ok: ph === 'reveal' ? (ans.get(p.id)?.v === qs[qi].c ? 1 : 0) : -1 }));
    hud();
    function reveal() {
      ph = 'reveal'; pt = 0;
      for (const p of ctx.players) {
        const a = ans.get(p.id);
        if (a && a.v === qs[qi].c) { const sp = Math.max(0, 1 - a.at / LIM); const gain = 100 + Math.round(sp * 100) + Math.min(3, streak.get(p.id) ?? 0) * 20; pts.set(p.id, (pts.get(p.id) ?? 0) + gain); streak.set(p.id, (streak.get(p.id) ?? 0) + 1); }
        else streak.set(p.id, 0);
      }
      ctx.fx('reveal', { c: qs[qi].c }); hud();
    }
    return {
      onPress(pid, btn) {
        if (ph !== 'ask' || ans.has(pid)) return;
        const v = btn === BTN.A ? 0 : btn === BTN.B ? 1 : btn === BTN.C ? 2 : btn === BTN.D ? 3 : -1;
        if (v < 0) return;
        ans.set(pid, { v, at: pt }); ctx.fx('answered', { id: pid }); hud();
        if (ctx.players.every((p) => ans.has(p.id) || !ctx.connected(p.id))) reveal();
      },
      tick(dt) {
        time += dt; pt += dt;
        if (ph === 'ask' && pt > LIM) reveal();
        else if (ph === 'reveal' && pt > 3.5) { qi++; if (qi >= qs.length) { over = true; ph = 'done'; } else { ans.clear(); ph = 'ask'; pt = 0; hud(); } }
      },
      snapshot: () => ({ t: r1(time), ph, pt: r1(pt), lim: LIM, qi: qi + 1, qn: qs.length, q: qs[Math.min(qi, qs.length - 1)].q, a: qs[Math.min(qi, qs.length - 1)].a, c: ph === 'reveal' ? qs[qi].c : -1, p: ctx.players.map((p) => ({ id: p.id, s: pts.get(p.id) ?? 0, an: ans.has(p.id) ? 1 : 0, ok: ph === 'reveal' && ans.get(p.id)?.v === qs[qi].c ? 1 : 0, v: ph === 'reveal' ? (ans.get(p.id)?.v ?? -1) : -1 })) }),
      isOver: () => over,
      standings: (): StandingRow[] => ctx.players.map((p) => ({ playerId: p.id, score: pts.get(p.id) ?? 0, detail: `${pts.get(p.id)} pts`, tie: pts.get(p.id) ?? 0 })).sort((a, b) => b.score - a.score),
    };
  },
};
