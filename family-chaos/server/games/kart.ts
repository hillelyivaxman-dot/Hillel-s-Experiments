import { BTN } from '../../shared/protocol';
import { getTrack, pointAt, TRACK_WIDTH, trackBoxes, trackFeatures, trackPads, type RaceMode, type Track } from '../../shared/tracks';
import { r1 } from '../util';
import type { GameContext, GameInstance, GameModule, StandingRow } from './types';

// KART CHAOS: top-down arcade racing with items, boost pads and laps.
export const KART = {
  ACC: 620,
  MAX: 470,
  BOOST_MAX: 740,
  REVERSE: -160,
  // arcade handling
  TURN_LOW: 2.9, // max yaw rate (rad/s) at low speed ...
  TURN_HIGH: 1.7, // ... falling to this at top speed: no snap turns when fast
  STEER_IN: 6.5, // steering smoothing (1/s): wheel/arrow input ramps instead of jumping
  STEER_OUT: 10,
  GRIP: 9, // lateral grip (1/s); the car slides a little instead of turning on rails
  GRIP_DRIFT: 3.2, // while braking in a turn
  CORNER_DRAG: 150, // speed lost per second at full lock and full speed
  ASSIST: 1.15, // rad/s pull towards the track direction when not steering
  CAR_R: 22,
  WALL: 48, // extra room beyond the asphalt before the wall
  SECTORS: 8,
  MAX_TIME: 300,
  FINISH_GRACE: 15,
} as const;

type Item = '' | 'turbo' | 'oil' | 'shield';

interface Car {
  id: string;
  x: number; y: number; a: number; v: number;
  idx: number; s: number; // nearest sample, distance along track
  sector: number; mask: number; lap: number; cross: number;
  item: Item; boostT: number; spinT: number; shieldT: number;
  turbo: number; // 0..100 turbo meter, TURBO button spends 50
  steer: number; // smoothed steering -1..1
  lat: number; // sideways velocity (px/s, + = right of heading)
  drift: boolean;
  finished: number; // finish time, -1 if racing
  offTrack: boolean;
  air: number; airMax: number; jumpCd: number; surgeCd: number; combo: number; comboT: number; stumble: number; // boat / bike mechanics
  lapStart: number; lastLap: number; bestLap: number; stuckT: number; recoverT: number;
  fcd: Record<string, number>; // per-feature cooldowns (rocks, hurdles, ramps...)
}

function nearest(tr: Track, x: number, y: number, hint: number) {
  const n = tr.pts.length;
  let best = hint, bestD = Infinity;
  const scan = (from: number, to: number) => {
    for (let k = from; k <= to; k++) {
      const i = ((k % n) + n) % n;
      const p = tr.pts[i];
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
  };
  scan(hint - 25, hint + 25);
  // Off the road near a track crossing (figure eight) the window can sit on the wrong branch: when the
  // windowed best is off-road, look at the whole track and switch if another part of it is clearly closer.
  if (bestD > (TRACK_WIDTH / 2 + 8) ** 2) {
    const wBest = best, wD = bestD;
    bestD = Infinity;
    scan(0, n - 1);
    if (bestD > wD - 15 * 15) { best = wBest; bestD = wD; } // no clearly closer spot: keep the continuous one
  }
  return { idx: best, dist: Math.sqrt(bestD) };
}

/** Handling presets: the same racing engine drives karts, boats (slidey, heavy) and bikes (fast, grippy). */
export const RACER_TUNING: Record<string, Partial<Record<keyof typeof KART, number>>> = {
  kart: {},
  boat: { ACC: 500, MAX: 420, BOOST_MAX: 660, REVERSE: -90, TURN_LOW: 2.3, TURN_HIGH: 1.5, GRIP: 3.4, GRIP_DRIFT: 1.8, CORNER_DRAG: 110, ASSIST: 0.7 },
  bike: { ACC: 760, MAX: 540, BOOST_MAX: 820, REVERSE: -120, TURN_LOW: 3.3, TURN_HIGH: 2.1, GRIP: 12, GRIP_DRIFT: 4.2, CORNER_DRAG: 190, ASSIST: 1.3 },
};

function makeRacer(id: string): GameModule {
  return {
  id,
  phoneHz: id === 'kart' ? 20 : undefined,
  create(ctx: GameContext): GameInstance {
    const K = { ...KART, ...RACER_TUNING[id] } as typeof KART;
    const laps = ctx.options.laps ?? 3;
    const trackId = ctx.options.track ?? 0;
    const tr = getTrack(trackId);
    const mode = id as RaceMode;
    const F = trackFeatures(trackId, mode);
    let time = 0;
    let endAt = Infinity;
    const finishOrder: string[] = [];

    // starting grid behind the line, 2 per row
    const cars: Car[] = ctx.players.map((p, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const back = 40 + row * 55;
      const pt = pointAt(tr, 1 - back / tr.length);
      const nx = -pt.ty, ny = pt.tx;
      const side = (col === 0 ? -1 : 1) * 30;
      const x = pt.x + nx * side, y = pt.y + ny * side;
      const nr = nearest(tr, x, y, 0);
      return {
        id: p.id, x, y, a: Math.atan2(pt.ty, pt.tx), v: 0, idx: nr.idx, s: tr.cum[nr.idx],
        sector: K.SECTORS - 1, mask: 1 << (K.SECTORS - 1), lap: 0, cross: -1,
        item: '', boostT: 0, spinT: 0, shieldT: 0, turbo: 50, steer: 0, lat: 0, drift: false, finished: -1, offTrack: false,
        lapStart: 0, lastLap: 0, bestLap: 0, stuckT: 0, recoverT: 0, air: 0, airMax: 1, jumpCd: 0, surgeCd: 0, combo: 0, comboT: 0, stumble: 0, fcd: {},
      };
    });
    const byId = new Map(cars.map((c) => [c.id, c]));

    const boxes = mode === 'kart' ? trackBoxes(tr).map((b) => ({ ...b, cd: 0 })) : []; // item boxes are a kart thing
    const pads = trackPads(tr);
    const oils: { x: number; y: number; owner: string; t: number; ttl: number }[] = [];

    const raceDist = (c: Car) => c.cross * tr.length + c.s;
    const order = () =>
      [...cars].sort((a, b) => {
        if (a.finished >= 0 || b.finished >= 0) {
          if (a.finished >= 0 && b.finished >= 0) return a.finished - b.finished;
          return a.finished >= 0 ? -1 : 1;
        }
        return raceDist(b) - raceDist(a);
      });
    let lastHud = 0;

    function sendHud() {
      const o = order();
      o.forEach((c, i) => ctx.hud(c.id, {
        place: i + 1, of: cars.length, lap: Math.min(c.lap + 1, laps), laps, item: c.item, turbo: Math.floor(c.turbo),
        done: c.finished >= 0 ? 1 : 0, mode: mode === 'kart' ? 0 : mode === 'boat' ? 1 : 2, surge: c.surgeCd <= 0 ? 1 : 0, combo: c.combo, jump: c.jumpCd <= 0 && c.air <= 0 ? 1 : 0,
      }));
    }
    sendHud();

    function useItem(c: Car) {
      if (!c.item || c.finished >= 0) return;
      const it = c.item;
      c.item = '';
      if (it === 'turbo') { c.boostT = 1.6; ctx.fx('boost', { id: c.id }); }
      if (it === 'shield') { c.shieldT = 5; ctx.fx('shield', { id: c.id }); }
      if (it === 'oil') {
        oils.push({ x: c.x - Math.cos(c.a) * 42, y: c.y - Math.sin(c.a) * 42, owner: c.id, t: time, ttl: 20 });
        ctx.fx('oil', { id: c.id });
      }
      sendHud();
    }

    return {
      onPress(pid, btn) {
        const c = byId.get(pid);
        if (!c) return;
        if (mode === 'kart' && btn === BTN.C) useItem(c);
        if (mode === 'boat' && btn === BTN.A && c.surgeCd <= 0 && c.finished < 0) { c.surgeCd = 2.6; c.boostT = Math.max(c.boostT, 0.8); ctx.fx('surge', { id: c.id }); ctx.buzz(c.id, 40); sendHud(); }
        if (mode === 'bike' && btn === BTN.A && c.air <= 0 && c.jumpCd <= 0 && c.finished < 0) { c.air = c.airMax = 0.5; c.jumpCd = 0.85; ctx.fx('jump', { id: c.id }); ctx.buzz(c.id, 25); }
        if (btn === BTN.D && c.turbo >= 50 && c.finished < 0) { // TURBO from the meter
          c.turbo -= 50;
          c.boostT = Math.max(c.boostT, 1.2);
          ctx.fx('boost', { id: c.id });
          ctx.buzz(c.id, 60);
          sendHud();
        }
      },

      tick(dt) {
        time += dt;
        for (const c of cars) {
          const inp = ctx.input(c.id);
          const racing = c.finished < 0;
          const brake = racing && ((inp.b & BTN.B) !== 0 || inp.y > 0.65);
          const manual = (inp.b & BTN.M) !== 0; // phone option: gas only while GAS is held
          const gas = racing && c.stumble <= 0 && (!manual || (inp.b & BTN.A) !== 0); // everybody accelerates by themselves: you steer, brake and use your special
          const wasAir = c.air > 0;
          c.air = Math.max(0, c.air - dt); if (wasAir && c.air <= 0 && Math.abs(c.steer) < 0.35 && mode === 'bike') { c.boostT = Math.max(c.boostT, 0.4); ctx.fx('land', { id: c.id }); } c.jumpCd = Math.max(0, c.jumpCd - dt); c.stumble = Math.max(0, c.stumble - dt);
          const hadSurge = c.surgeCd <= 0; c.surgeCd = Math.max(0, c.surgeCd - dt);
          if (!hadSurge && c.surgeCd <= 0) sendHud();
          c.comboT = Math.max(0, c.comboT - dt); if (c.comboT <= 0 && c.combo) { c.combo = 0; sendHud(); }
          for (const k in c.fcd) if (c.fcd[k] > 0) c.fcd[k] -= dt;
          const steerIn = racing ? Math.max(-1, Math.min(1, inp.x)) * (c.air > 0 ? 0.3 : 1) : 0; // no real steering in the air
          const max = (c.boostT > 0 ? K.BOOST_MAX : K.MAX) * (c.offTrack && c.air <= 0 ? 0.55 : 1) * (1 + 0.04 * c.combo);

          // --- steering input smoothing (wheel, arrows and tilt all feel the same) ---
          const rate = Math.abs(steerIn) > Math.abs(c.steer) ? K.STEER_IN : K.STEER_OUT;
          const dSt = steerIn - c.steer;
          c.steer += Math.max(-rate * dt, Math.min(rate * dt, dSt));

          // --- longitudinal ---
          const sp = Math.min(1.2, Math.abs(c.v) / K.MAX);
          if (c.boostT > 0) c.v += 1300 * dt;
          else if (gas) c.v += K.ACC * (1 - 0.6 * Math.min(1, c.v / K.MAX) ** 2) * (brake ? 0.35 : 1) * dt;
          if (brake) c.v -= (c.v > 15 ? 720 : 320) * dt;
          if (!gas && !brake && c.boostT <= 0) c.v *= Math.exp(-1.05 * dt);
          if (c.offTrack) c.v *= Math.exp(-0.9 * dt);
          if (!racing) c.v *= Math.exp(-1.6 * dt);
          c.v -= Math.sign(c.v) * K.CORNER_DRAG * Math.abs(c.steer) * Math.min(1, sp) * Math.min(1, sp) * dt; // scrub speed in hard turns
          if (c.v > max) c.v = Math.max(max, c.v - 900 * dt);
          if (c.v < K.REVERSE) c.v = K.REVERSE;

          // --- yaw: rate falls with speed, so full lock at full speed is a wide, stable arc ---
          c.drift = brake && Math.abs(c.steer) > 0.45 && c.v > 140 && c.spinT <= 0;
          const yawMax = (K.TURN_LOW + (K.TURN_HIGH - K.TURN_LOW) * Math.min(1, sp)) * (c.drift ? 1.25 : 1);
          const dirK = Math.max(-1, Math.min(1, c.v / 120)); // no turning on the spot, reverse flips steering
          let dA = c.steer * yawMax * dirK * dt;
          // gentle straight-line assist towards the track direction when the player is not steering
          if (racing && Math.abs(c.v) > 80 && c.spinT <= 0) {
            const p0 = tr.pts[c.idx], p1 = tr.pts[(c.idx + 3) % tr.pts.length];
            let diff = Math.atan2(p1.y - p0.y, p1.x - p0.x) - c.a;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            if (Math.abs(diff) < 1.2) dA += Math.max(-1, Math.min(1, diff * 2)) * K.ASSIST * (1 - Math.abs(steerIn)) * Math.sign(c.v) * dt;
          }
          if (c.recoverT > 0) {
            c.recoverT -= dt;
            const q0 = tr.pts[c.idx], q1 = tr.pts[(c.idx + 4) % tr.pts.length];
            let dd = Math.atan2(q1.y - q0.y, q1.x - q0.x) - c.a; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
            dA += Math.max(-2.4, Math.min(2.4, dd * 5)) * (1 - Math.min(1, Math.abs(steerIn))) * dt; c.v = Math.max(c.v, 40) + 380 * dt;
          }
          if (c.spinT > 0) { dA += 7 * dt; c.v *= Math.exp(-1.9 * dt); c.spinT -= dt; }
          // rotate the velocity frame with the heading: the sideways part appears as slip
          const sn = Math.sin(dA), cs = Math.cos(dA);
          const v2 = c.v * cs + c.lat * sn, l2 = -c.v * sn + c.lat * cs;
          c.v = v2; c.lat = l2; c.a += dA;
          // lateral grip; part of the removed slide is converted to forward speed (keeps cornering fast and fun)
          const grip = c.air > 0 ? 0.6 : c.drift ? K.GRIP_DRIFT : c.offTrack ? 5 : K.GRIP;
          const removed = c.lat * (1 - Math.exp(-grip * dt));
          c.lat -= removed;
          c.v += Math.sign(c.v || 1) * Math.abs(removed) * 0.6;
          c.lat = Math.max(-0.75 * Math.abs(c.v) - 60, Math.min(0.75 * Math.abs(c.v) + 60, c.lat));
          c.boostT = Math.max(0, c.boostT - dt);
          if (racing) c.turbo = Math.min(100, c.turbo + 3 * dt); // slow regen
          c.shieldT = Math.max(0, c.shieldT - dt);

          const fx0 = Math.cos(c.a), fy0 = Math.sin(c.a);
          let vxw = c.v * fx0 - c.lat * fy0, vyw = c.v * fy0 + c.lat * fx0;
          c.x += vxw * dt;
          c.y += vyw * dt;

          // track / walls
          const nr = nearest(tr, c.x, c.y, c.idx);
          c.idx = nr.idx;
          c.s = tr.cum[nr.idx];
          c.offTrack = nr.dist > TRACK_WIDTH / 2;
          if (racing) {
            const pA = tr.pts[nr.idx], pB = tr.pts[(nr.idx + 1) % tr.pts.length];
            const tl = Math.hypot(pB.x - pA.x, pB.y - pA.y) || 1, tx = (pB.x - pA.x) / tl, ty = (pB.y - pA.y) / tl;
            const lat = (c.x - pA.x) * -ty + (c.y - pA.y) * tx, frac = c.s / tr.length;
            // BOAT: streams carry you (take the fast side!), eddies push you back, rocks bounce you, whirlpools spin you
            for (const cu of F.currents) {
              if (!((frac >= cu.f0 && frac < cu.f1) || (cu.f1 > 1 && frac < cu.f1 - 1))) continue;
              if (Math.abs(lat - cu.off) < cu.w) { c.x += tx * cu.push * dt; c.y += ty * cu.push * dt; if (cu.push > 0 && c.boostT < 0.05) c.v += 90 * dt; }
            }
            F.rocks.forEach((r, i) => {
              const d = Math.hypot(c.x - r.x, c.y - r.y);
              if (d < r.r + K.CAR_R && !(c.fcd['r' + i] > 0)) {
                c.fcd['r' + i] = 0.6; const nx = (c.x - r.x) / (d || 1), ny = (c.y - r.y) / (d || 1);
                c.x = r.x + nx * (r.r + K.CAR_R); c.y = r.y + ny * (r.r + K.CAR_R);
                if (c.shieldT <= 0) c.v *= 0.5; c.lat += (nx * -Math.sin(c.a) + ny * Math.cos(c.a)) * 160;
                ctx.fx('rock', { x: r1(r.x), y: r1(r.y) }); ctx.buzz(c.id, 70);
              }
            });
            F.whirls.forEach((w, i) => {
              const d = Math.hypot(c.x - w.x, c.y - w.y);
              if (d < w.r) {
                c.x += (w.x - c.x) * 0.7 * dt; c.y += (w.y - c.y) * 0.7 * dt; c.v *= Math.exp(-0.7 * dt);
                if (c.spinT <= 0 && !(c.fcd['w' + i] > 0)) { c.spinT = 0.7; c.fcd['w' + i] = 1.6; ctx.fx('whirl', { id: c.id }); ctx.buzz(c.id, 120); }
              }
            });
            // BIKE: ramps launch you, hurdles must be hopped; a chain of clean hops builds a speed combo
            F.ramps.forEach((r, i) => {
              if (Math.hypot(c.x - r.x, c.y - r.y) < 46 && !(c.fcd['p' + i] > 0)) { c.fcd['p' + i] = 2; c.air = c.airMax = 0.95; c.boostT = Math.max(c.boostT, 0.7); ctx.fx('ramp', { id: c.id }); ctx.buzz(c.id, 60); }
            });
            F.hurdles.forEach((h, i) => {
              if (Math.hypot(c.x - h.x, c.y - h.y) > 34 || c.fcd['h' + i] > 0) return;
              c.fcd['h' + i] = 1.5;
              if (c.air > 0) { c.combo = Math.min(5, c.combo + 1); c.comboT = 9; c.turbo = Math.min(100, c.turbo + 12); ctx.fx('clear', { id: c.id, n: c.combo }); sendHud(); }
              else if (c.shieldT <= 0) { c.v *= 0.35; c.combo = 0; c.stumble = 0.45; ctx.fx('crash', { id: c.id }); ctx.buzz(c.id, 150); sendHud(); }
            });
          }
          const lim = TRACK_WIDTH / 2 + K.WALL;
          if (nr.dist > lim) {
            const p = tr.pts[nr.idx];
            const nx = (c.x - p.x) / nr.dist, ny = (c.y - p.y) / nr.dist; // outward normal
            const k = lim / nr.dist;
            c.x = p.x + (c.x - p.x) * k;
            c.y = p.y + (c.y - p.y) * k;
            const into = vxw * nx + vyw * ny;
            if (into > 0) {
              if (into > 120) { ctx.fx('wall', { x: r1(c.x), y: r1(c.y) }); ctx.buzz(c.id, 40); }
              vxw -= 1.15 * into * nx; vyw -= 1.15 * into * ny; // slide along the wall with a small bounce
              vxw *= 0.9; vyw *= 0.9;
              c.v = vxw * Math.cos(c.a) + vyw * Math.sin(c.a);
              c.lat = -vxw * Math.sin(c.a) + vyw * Math.cos(c.a);
            }
          }

          // arcade recovery: a kart pinned against a wall for a second turns itself back onto the road (a quick, smooth turn)
          if (racing && Math.abs(c.v) < 35 && c.spinT <= 0 && c.recoverT <= 0) c.stuckT += dt; else c.stuckT = 0;
          if (c.stuckT > 1.0) { c.recoverT = 0.7; c.stuckT = 0; ctx.fx('recover', { id: c.id }); }
          // sectors & laps
          const sector = Math.min(K.SECTORS - 1, Math.floor((c.s / tr.length) * K.SECTORS));
          if (sector !== c.sector) {
            if (c.sector === K.SECTORS - 1 && sector === 0) {
              c.cross++;
              if (c.mask === (1 << K.SECTORS) - 1 && racing) {
                c.lap++;
                c.lastLap = time - c.lapStart; c.lapStart = time; c.bestLap = c.bestLap ? Math.min(c.bestLap, c.lastLap) : c.lastLap;
                if (c.lap >= laps) {
                  c.finished = time;
                  finishOrder.push(c.id);
                  if (endAt === Infinity) endAt = time + K.FINISH_GRACE;
                  ctx.fx('finish', { id: c.id, place: finishOrder.length });
                  ctx.buzz(c.id, 400);
                } else {
                  ctx.fx('lap', { id: c.id, lap: c.lap + 1, lt: r1(c.lastLap) });
                  ctx.buzz(c.id, 80);
                }
              }
              c.mask = 1;
            } else if (c.sector === 0 && sector === K.SECTORS - 1) {
              c.cross--;
              c.mask = 1 << (K.SECTORS - 1);
            } else {
              c.mask |= 1 << sector;
            }
            c.sector = sector;
          }

          // boost pads
          for (const p of pads) if (Math.hypot(c.x - p.x, c.y - p.y) < 42) {
            if (c.boostT < 0.2) ctx.fx('pad', { id: c.id });
            c.boostT = Math.max(c.boostT, 0.9);
          }
          // item boxes
          for (const b of boxes) {
            if (b.cd > 0 || Math.hypot(c.x - b.x, c.y - b.y) > 30) continue;
            b.cd = 4;
            if (racing) c.turbo = Math.min(100, c.turbo + 25); // every box also tops up the turbo meter
            if (!c.item && racing) {
              const r = ctx.rand();
              c.item = r < 0.3 ? 'turbo' : r < 0.65 ? 'oil' : 'shield';
              ctx.buzz(c.id, 50);
              sendHud();
            }
            ctx.fx('box', { x: r1(b.x), y: r1(b.y) });
          }
          // oil
          for (let i = oils.length - 1; i >= 0; i--) {
            const o = oils[i];
            if (o.owner === c.id && time - o.t < 1.2) continue;
            if (Math.hypot(c.x - o.x, c.y - o.y) < 34) {
              oils.splice(i, 1);
              if (c.shieldT > 0) continue;
              c.spinT = 0.9;
              ctx.fx('spin', { id: c.id });
              ctx.buzz(c.id, 250);
            }
          }
        }
        for (const b of boxes) b.cd = Math.max(0, b.cd - dt);
        for (let i = oils.length - 1; i >= 0; i--) if (time - oils[i].t > oils[i].ttl) oils.splice(i, 1);

        // car vs car
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i], b = cars[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d >= K.CAR_R * 2 || d < 1e-6) continue;
          const push = (K.CAR_R * 2 - d) / 2;
          const nx = dx / d, ny = dy / d;
          const wa = a.shieldT > 0 ? 0.2 : 1, wb = b.shieldT > 0 ? 0.2 : 1;
          a.x -= nx * push * wa; a.y -= ny * push * wa;
          b.x += nx * push * wb; b.y += ny * push * wb;
          if (a.shieldT <= 0) a.v *= 0.92;
          if (b.shieldT <= 0) b.v *= 0.92;
          if (Math.abs(a.v - b.v) > 140) ctx.fx('bump', { x: r1((a.x + b.x) / 2), y: r1((a.y + b.y) / 2) });
        }

        lastHud += dt;
        if (lastHud > 0.5) { lastHud = 0; sendHud(); }
      },

      snapshot() {
        const o = order();
        return {
          t: r1(time), tr: trackId, laps,
          end: endAt === Infinity ? -1 : Math.max(0, Math.ceil(endAt - time)),
          c: cars.map((c) => ({
            id: c.id, x: Math.round(c.x), y: Math.round(c.y), a: Math.round(c.a * 100) / 100,
            ...(c.boostT > 0 ? { b: 1 } : {}), ...(c.spinT > 0 ? { s: 1 } : {}), ...(c.drift ? { dr: 1 } : {}), st: Math.round(c.steer * 10) / 10, ...(c.shieldT > 0 ? { h: 1 } : {}),
            lap: Math.min(c.lap + 1, laps), ...(c.finished >= 0 ? { fin: 1 } : {}), ...(c.item ? { it: c.item } : {}), v: Math.round(c.v), ...(c.lastLap ? { lt: r1(c.lastLap), bl: r1(c.bestLap) } : {}), tb: Math.round(c.turbo), ...(c.air > 0 ? { ar: Math.round(Math.sin((1 - c.air / c.airMax) * Math.PI) * 10) / 10 } : {}), ...(c.combo ? { cb: c.combo } : {}),
          })),
          ord: o.map((c) => c.id),
          bo: boxes.map((b) => (b.cd <= 0 ? 1 : 0)).join(''), // box on/off flags; positions come from the track
          oil: oils.map((o2) => [Math.round(o2.x), Math.round(o2.y)]),
        };
      },

      isOver() {
        return time >= K.MAX_TIME || time >= endAt || cars.every((c) => c.finished >= 0);
      },

      standings(): StandingRow[] {
        return order().map((c, i) => ({
          playerId: c.id,
          score: c.finished >= 0 ? Math.round(c.finished * 100) / 100 : 0,
          detail: (c.finished >= 0 ? `${c.finished.toFixed(2)}s` : `lap ${Math.min(c.lap + 1, laps)}/${laps}`) + (c.bestLap ? ` · best ${c.bestLap.toFixed(1)}s` : ''),
          tie: i,
        }));
      },
    };
  },
};
}

export const kartGame = makeRacer('kart');
export const boatGame = makeRacer('boat');
export const bikeGame = makeRacer('bike');
