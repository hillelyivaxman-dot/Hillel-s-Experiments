import { BTN } from '../../shared/protocol';
import { itemCode, KITCHEN, matchRecipe, plateable, RECIPES, STATIONS, type Kind, type State, type StationDef } from '../../shared/kitchen';
import { r1 } from '../util';
import { damp, integrate, type Body } from './physics';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// CRAZY KITCHEN (co-op): everyone cooks for the same restaurant. Take ingredients from crates, chop them on boards
// (hold CHOP next to the board), cook patties on the stove (don't let them burn!), assemble on plates and serve orders
// before they expire. Half way through, the kitchen reshuffles: stations move! Stars for the whole team by final score.
export { KITCHEN };
export const KITCHENC = { ORDER_EVERY: 13, MAX_ORDERS: 4, ORDER_TIME: 80, LATE_PENALTY: 8, STAR_AT: [40, 90, 150] as const };

interface Item { k: Kind; s: State }
interface Plate { plate: true; items: string[] }
type Held = Item | Plate | null;
const isPlate = (h: Held): h is Plate => !!h && 'plate' in h;
interface Content { held: Item | Plate; prog: number } // progress: chopping (0..1) or cooking (0..2: 1 = cooked, 2 = burnt)
interface Pl extends Body { id: string; face: number; hold: Held; working: boolean }
interface Order { id: number; r: string; t: number }

export const kitchenGame: GameModule = {
  id: 'kitchen',
  create(ctx: GameContext): GameInstance {
    const C = KITCHEN, K = KITCHENC;
    const total = ctx.options.time ?? 180;
    let time = 0, layout = 0, over = false;
    let score = 0, served = 0, late = 0, orderId = 0, nextOrder = 1.5;
    const orders: Order[] = [];
    const contents = new Map<string, Content>(); // station id -> what is on it
    const ps: Pl[] = ctx.players.map((p, i) => ({
      id: p.id, x: 560 + (i % 4) * 70, y: 220 + Math.floor(i / 4) * 70, vx: 0, vy: 0, r: C.R, m: 1, face: Math.PI / 2, hold: null, working: false,
    }));
    const byId = new Map(ps.map((p) => [p.id, p]));
    const rect = (s: StationDef) => ({ x: s.pos[layout][0], y: s.pos[layout][1], w: s.w, h: s.h });

    const label = (h: Held) => (!h ? '' : isPlate(h) ? `plate:${h.items.join(',')}` : itemCode(h.k, h.s));
    function hud(p: Pl) { ctx.hud(p.id, { score, hold: label(p.hold), orders: orders.length, left: Math.max(0, Math.ceil(total - time)) }); }
    ps.forEach(hud);

    const dist = (p: Pl, s: StationDef) => {
      const r = rect(s);
      const nx = Math.max(r.x, Math.min(p.x, r.x + r.w)), ny = Math.max(r.y, Math.min(p.y, r.y + r.h));
      return Math.hypot(p.x - nx, p.y - ny);
    };
    const nearest = (p: Pl) => {
      let best: StationDef | null = null, bd: number = C.REACH;
      for (const s of STATIONS) { const d = dist(p, s); if (d < bd) { bd = d; best = s; } }
      return best;
    };
    const choppable = (i: Item) => (i.k === 'tomato' || i.k === 'lettuce') && i.s === 'r';

    function addToPlate(plate: Plate, it: Item): boolean {
      const code = itemCode(it.k, it.s);
      if (!plateable(code) || plate.items.includes(code)) return false;
      plate.items.push(code);
      return true;
    }
    function interact(p: Pl) {
      const s = nearest(p);
      if (!s) return;
      const c = contents.get(s.id);
      const h = p.hold;
      switch (s.kind) {
        case 'crate':
          if (!h) { p.hold = { k: s.crate!, s: 'r' }; ctx.fx('take', { id: p.id, x: Math.round(p.x), y: Math.round(p.y) }); }
          else if (isPlate(h) && addToPlate(h, { k: s.crate!, s: 'r' })) ctx.fx('put', { id: p.id });
          break;
        case 'plates':
          if (!h) { p.hold = { plate: true, items: [] }; ctx.fx('take', { id: p.id }); }
          break;
        case 'trash':
          if (h) { p.hold = null; ctx.fx('trash', { id: p.id }); }
          break;
        case 'serve':
          if (isPlate(h)) {
            const rec = matchRecipe(h.items);
            const idx = rec ? orders.findIndex((o) => o.r === rec.id) : -1;
            if (rec && idx >= 0) {
              const o = orders.splice(idx, 1)[0];
              const bonus = Math.round((o.t / K.ORDER_TIME) * 10);
              score += rec.pts + bonus; served++;
              ctx.fx('serve', { id: p.id, r: rec.id, pts: rec.pts + bonus });
            } else ctx.fx('wrong', { id: p.id });
            p.hold = null; // the plate is gone either way
            ctx.buzz(p.id, rec && idx >= 0 ? 120 : 250);
            ps.forEach(hud);
          }
          break;
        case 'board': case 'stove': case 'counter': {
          if (!h && c) { p.hold = c.held; contents.delete(s.id); ctx.fx('take', { id: p.id }); break; }
          if (h && !c) {
            const ok = isPlate(h) || (s.kind === 'board' ? choppable(h) : s.kind === 'stove' ? h.k === 'patty' && h.s === 'r' : true);
            if (ok) { contents.set(s.id, { held: h, prog: 0 }); p.hold = null; ctx.fx('put', { id: p.id }); }
            break;
          }
          if (h && c) { // combine onto a plate (either the plate is in hand or on the station)
            if (isPlate(h) && !isPlate(c.held)) {
              const it = c.held, ready = s.kind === 'board' ? it.s === 'c' : s.kind === 'stove' ? it.s === 'k' : true;
              if (ready && addToPlate(h, it)) { contents.delete(s.id); ctx.fx('put', { id: p.id }); }
            } else if (!isPlate(h) && isPlate(c.held) && addToPlate(c.held, h)) { p.hold = null; ctx.fx('put', { id: p.id }); }
          }
        }
      }
      hud(p);
    }

    function nameOf(r: string) { return RECIPES.find((x) => x.id === r)!.id; }

    return {
      onPress(pid, btn) {
        const p = byId.get(pid);
        if (p && btn === BTN.A && !over) interact(p);
      },

      tick(dt) {
        time += dt;
        // reshuffle at half time
        if (layout === 0 && time >= total / 2) {
          layout = 1;
          ctx.fx('shuffle');
          for (const p of ps) { p.x = Math.min(C.W - 60, Math.max(60, p.x)); p.y = Math.min(C.H - 60, Math.max(60, p.y)); }
        }
        // orders
        nextOrder -= dt;
        if (nextOrder <= 0 && orders.length < K.MAX_ORDERS && total - time > 25) {
          nextOrder = K.ORDER_EVERY * (0.8 + ctx.rand() * 0.4);
          const r = RECIPES[Math.floor(ctx.rand() * RECIPES.length)];
          orders.push({ id: ++orderId, r: nameOf(r.id), t: K.ORDER_TIME });
          ctx.fx('order', { r: r.id });
          ps.forEach(hud);
        }
        for (let i = orders.length - 1; i >= 0; i--) {
          orders[i].t -= dt;
          if (orders[i].t <= 0) { orders.splice(i, 1); late++; score = Math.max(0, score - K.LATE_PENALTY); ctx.fx('late'); ps.forEach(hud); }
        }
        // stations at work
        for (const [id, c] of contents) {
          const s = STATIONS.find((x) => x.id === id)!;
          if (isPlate(c.held)) continue;
          if (s.kind === 'stove' && c.held.k === 'patty') {
            const before = c.prog;
            c.prog += dt / C.COOK_TIME; // cooked at 1, burnt after BURN_TIME more
            if (c.prog >= 1 && c.held.s === 'r') { c.held.s = 'k'; ctx.fx('cooked', { id }); }
            if (c.prog >= 1 + C.BURN_TIME / C.COOK_TIME && c.held.s === 'k') { c.held.s = 'b'; ctx.fx('burnt', { id }); }
            if (before < 0.85 && c.prog >= 0.85 && c.held.s === 'r') ctx.fx('almost', { id });
          }
        }
        // players
        for (const p of ps) {
          const inp = ctx.input(p.id);
          p.vx += inp.x * 1700 * dt; p.vy += inp.y * 1700 * dt;
          if (Math.hypot(inp.x, inp.y) > 0.25) p.face = Math.atan2(inp.y, inp.x);
          damp(p, 0.04, dt);
          const sp = Math.hypot(p.vx, p.vy);
          if (sp > C.SPEED) { p.vx *= C.SPEED / sp; p.vy *= C.SPEED / sp; }
          integrate(p, dt);
          p.x = Math.max(p.r, Math.min(C.W - p.r, p.x)); p.y = Math.max(p.r, Math.min(C.H - p.r, p.y));
          for (const s of STATIONS) { // push out of counters
            const r = rect(s);
            const nx = Math.max(r.x, Math.min(p.x, r.x + r.w)), ny = Math.max(r.y, Math.min(p.y, r.y + r.h));
            const dx = p.x - nx, dy = p.y - ny, d = Math.hypot(dx, dy);
            if (d < p.r) {
              if (d > 1e-6) { p.x += (dx / d) * (p.r - d); p.y += (dy / d) * (p.r - d); }
              else { p.y = r.y - p.r; }
            }
          }
          // chopping: hold B next to a board that has something choppable
          p.working = false;
          if ((inp.b & BTN.B) !== 0 && sp < 60) {
            const s = nearest(p);
            const c = s && contents.get(s.id);
            if (s && s.kind === 'board' && c && !isPlate(c.held) && c.held.s === 'r') {
              p.working = true;
              c.prog += dt / C.CHOP_TIME;
              if (c.prog >= 1) { c.held.s = 'c'; c.prog = 1; ctx.fx('chopped', { id: s.id }); ctx.buzz(p.id, 60); }
            }
          }
        }
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { // soft player-player push
          const a = ps[i], b = ps[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d > 0 && d < a.r * 2) { const push = (a.r * 2 - d) / 2; a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push; }
        }
        if (time >= total) over = true;
      },

      snapshot() {
        return {
          t: r1(time), left: Math.max(0, Math.ceil(total - time)), lo: layout, sc: score, sv: served, tot: total,
          o: orders.map((o) => ({ id: o.id, r: o.r, t: Math.round(o.t) })),
          c: [...contents].map(([id, c]) => [id, label(c.held), Math.round(c.prog * 100) / 100]),
          p: ps.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), a: Math.round(p.face * 100) / 100, h: label(p.hold), w: p.working ? 1 : 0 })),
        };
      },

      isOver: () => over,

      standings(): StandingRow[] {
        const stars = K.STAR_AT.filter((t) => score >= t).length;
        // co-op: everyone shares the team result and its stars
        return ps.map((p) => ({ playerId: p.id, score, detail: `${score} · ${served} ✓ · ${late} ✗`, tie: 1, stars }));
      },
    };
  },
};
