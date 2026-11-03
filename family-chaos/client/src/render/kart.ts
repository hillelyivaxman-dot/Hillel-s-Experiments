import { getTrack, pointAt, TRACK_WIDTH, trackBoxes, trackFeatures, trackPads, WORLD_H, WORLD_W } from '../../../shared/tracks';
import { sfx } from '../sound';
import { drawCritter } from './critter';
import { hudText, type Renderer } from './types';

const paths = new Map<number, Path2D>();
function trackPath(id: number) {
  let p = paths.get(id);
  if (!p) {
    const tr = getTrack(id);
    p = new Path2D();
    tr.pts.forEach((pt, i) => (i ? p!.lineTo(pt.x, pt.y) : p!.moveTo(pt.x, pt.y)));
    p.closePath();
    paths.set(id, p);
  }
  return p;
}

const ITEM_ICON: Record<string, string> = { turbo: ':rocket:', oil: ':oil:', shield: ':shield:' };

type Kind = 'kart' | 'boat' | 'bike';
const THEME: Record<Kind, { bg: string; stripe: string; sand: string; curb1: string; curb2: string; road: string; line: string }> = {
  kart: { bg: '#1f8a4c', stripe: '#23964f', sand: '#e8c27a', curb1: '#fff', curb2: '#ff4d6d', road: '#3a3a4a', line: 'rgba(255,255,255,0.35)' },
  boat: { bg: '#0b6fa8', stripe: '#0e7bb8', sand: '#f0d9a0', curb1: '#ffffff', curb2: '#ff8c42', road: '#2aa7d8', line: 'rgba(255,255,255,0.5)' },
  bike: { bg: '#7a4b22', stripe: '#835227', sand: '#b3763a', curb1: '#f2e2c4', curb2: '#e0592a', road: '#a8692f', line: 'rgba(255,255,255,0.3)' },
};

function make(kind: Kind): Renderer { const TH = THEME[kind]; return {
  world: { x: 0, y: 0, w: WORLD_W, h: WORLD_H },
  background: (g, W, H) => {
    g.fillStyle = TH.bg;
    g.fillRect(0, 0, W, H);
  },

  draw(g, f, { players, t, fx }) {
    // grass stripes
    g.fillStyle = TH.stripe;
    for (let x = 0; x < WORLD_W; x += 80) g.fillRect(x, 0, 40, WORLD_H);
    const path = trackPath(f.tr);
    const tr = getTrack(f.tr);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    // run-off sand
    g.strokeStyle = TH.sand;
    g.lineWidth = TRACK_WIDTH + 96;
    g.stroke(path);
    // curbs
    g.strokeStyle = TH.curb1;
    g.lineWidth = TRACK_WIDTH + 18;
    g.stroke(path);
    g.strokeStyle = TH.curb2;
    g.setLineDash([22, 22]);
    g.stroke(path);
    g.setLineDash([]);
    // asphalt
    g.strokeStyle = TH.road;
    g.lineWidth = TRACK_WIDTH;
    g.stroke(path);
    g.strokeStyle = TH.line;
    g.lineWidth = 3;
    g.setLineDash([26, 30]);
    g.stroke(path);
    g.setLineDash([]);
    // start line (checkered)
    const p0 = tr.pts[0], p1 = tr.pts[1];
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    g.save();
    g.translate(p0.x, p0.y);
    g.rotate(ang);
    for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#fff' : '#111';
      g.fillRect(j * 10 - 10, -TRACK_WIDTH / 2 + i * (TRACK_WIDTH / 10), 10, TRACK_WIDTH / 10);
    }
    g.restore();

    // vehicle-specific track features
    if (kind !== 'kart') {
      const F = trackFeatures(f.tr, kind);
      for (const cu of F.currents) { // streams: flowing chevrons along one side of the lane (blue = fast, orange = eddy against you)
        g.beginPath();
        for (let k = 0; k <= 14; k++) { const fr = cu.f0 + ((cu.f1 - cu.f0) * k) / 14, pt = pointAt(tr, fr); const x = pt.x - pt.ty * cu.off, y = pt.y + pt.tx * cu.off; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
        g.lineCap = 'butt'; g.strokeStyle = cu.push > 0 ? 'rgba(255,255,255,.22)' : 'rgba(255,140,60,.28)'; g.lineWidth = cu.w * 2; g.stroke();
        g.strokeStyle = cu.push > 0 ? 'rgba(210,245,255,.85)' : 'rgba(255,170,90,.85)'; g.lineWidth = 5; g.setLineDash([14, 26]); g.lineDashOffset = (cu.push > 0 ? -1 : 1) * t * 90; g.stroke(); g.setLineDash([]);
      }
      for (const r of F.rocks) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(r.x + 4, r.y + 8, r.r, r.r * 0.7, 0, 0, 7); g.fill(); g.fillStyle = '#7b8794'; g.strokeStyle = '#1f2937'; g.lineWidth = 4; g.beginPath(); g.moveTo(r.x - r.r, r.y + 4); g.lineTo(r.x - r.r * 0.5, r.y - r.r * 0.8); g.lineTo(r.x + r.r * 0.4, r.y - r.r * 0.9); g.lineTo(r.x + r.r, r.y + 2); g.lineTo(r.x + r.r * 0.3, r.y + r.r * 0.7); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(r.x - r.r * 0.3, r.y - r.r * 0.6, r.r * 0.5, 5); }
      for (const w of F.whirls) { for (let k = 0; k < 4; k++) { g.strokeStyle = `rgba(255,255,255,${0.7 - k * 0.14})`; g.lineWidth = 5; g.beginPath(); for (let a = 0; a < 5.5; a += 0.2) { const rr = w.r * (0.25 + k * 0.2) * (1 - a / 14); const th = a - t * (2 + k) + k * 1.5; if (a === 0) g.moveTo(w.x + Math.cos(th) * rr, w.y + Math.sin(th) * rr); else g.lineTo(w.x + Math.cos(th) * rr, w.y + Math.sin(th) * rr); } g.stroke(); } g.fillStyle = 'rgba(8,40,90,.55)'; g.beginPath(); g.arc(w.x, w.y, w.r * 0.2, 0, 7); g.fill(); }
      for (const r of F.ramps) { g.save(); g.translate(r.x, r.y); g.rotate(r.a); g.fillStyle = '#c98a4b'; g.strokeStyle = '#4a2a0c'; g.lineWidth = 4; g.beginPath(); g.moveTo(-34, -52); g.lineTo(34, -34); g.lineTo(34, 34); g.lineTo(-34, 52); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ffd23f'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-22 + k * 16, -22); g.lineTo(-8 + k * 16, 0); g.lineTo(-22 + k * 16, 22); g.lineTo(-14 + k * 16, 22); g.lineTo(0 + k * 16, 0); g.lineTo(-14 + k * 16, -22); g.fill(); } g.restore(); }
      for (const h of F.hurdles) { g.save(); g.translate(h.x, h.y); g.rotate(h.a + Math.PI / 2); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-36, 6, 72, 12); g.fillStyle = '#8b5a2b'; g.strokeStyle = '#2e1a08'; g.lineWidth = 3; g.beginPath(); g.roundRect(-38, -12, 76, 22, 10); g.fill(); g.stroke(); g.fillStyle = '#e9d8b4'; g.beginPath(); g.ellipse(-38, -1, 7, 11, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#ff4d6d'; g.fillRect(-14, -12, 8, 22); g.fillRect(8, -12, 8, 22); g.restore(); }
    }
    // boost pads
    for (const p of trackPads(tr)) {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.a);
      g.fillStyle = 'rgba(255,210,63,0.25)';
      g.fillRect(-40, -34, 80, 68);
      const phase = (t * 3) % 1;
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = `rgba(255,210,63,${0.4 + 0.6 * ((k / 3 + phase) % 1)})`;
        g.lineWidth = 8;
        g.beginPath();
        g.moveTo(-26 + k * 20, -22); g.lineTo(-10 + k * 20, 0); g.lineTo(-26 + k * 20, 22);
        g.stroke();
      }
      g.restore();
    }
    // oil
    for (const [ox, oy] of f.oil as [number, number][]) {
      g.fillStyle = 'rgba(15,10,25,0.85)';
      g.beginPath();
      g.ellipse(ox, oy, 30, 22, 0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(160,100,255,0.35)';
      g.beginPath();
      g.ellipse(ox - 6, oy - 5, 10, 5, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    // item boxes
    for (const b of trackBoxes(tr)) {
      if (f.bo[b.id] !== '1') continue;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(t * 1.5 + b.id);
      g.fillStyle = `hsl(${(t * 120 + b.id * 40) % 360} 90% 60%)`;
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(-14, -14, 28, 28, 6);
      g.fill();
      g.stroke();
      g.rotate(-(t * 1.5 + b.id));
      g.fillStyle = '#fff';
      g.font = '900 20px Rubik, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('?', 0, 1);
      g.restore();
    }
    // cars
    for (const c of f.c) {
      const info = players.get(c.id);
      if (!info) continue;
      const air = c.ar ?? 0;
      if (air) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(c.x + 6, c.y + 8, 24 - air * 6, 11 - air * 3, c.a, 0, 7); g.fill(); }
      g.save();
      g.translate(c.x, c.y - air * 34);
      if (air) g.scale(1 + air * 0.25, 1 + air * 0.25);
      g.rotate(c.a);
      if (c.b) {
        g.fillStyle = Math.floor(t * 20) % 2 ? '#ffd23f' : '#ff8c42';
        g.beginPath();
        g.moveTo(-24, -8); g.lineTo(-44 - Math.random() * 14, 0); g.lineTo(-24, 8);
        g.fill();
      }
      if (kind === 'kart') {
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.beginPath(); g.roundRect(-22, -12, 48, 30, 8); g.fill();
        g.fillStyle = '#111';
        for (const [wx, wy] of [[-14, -15], [12, -15], [-14, 15], [12, 15]]) g.fillRect(wx - 6, wy - 4, 12, 8);
        g.fillStyle = info.color;
        g.strokeStyle = '#120a2a';
        g.lineWidth = 3;
        g.beginPath(); g.roundRect(-24, -14, 48, 28, 9); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(-16, -11, 30, 5);
      } else if (kind === 'boat') {
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; // wake
        g.beginPath(); g.moveTo(-26, -8); g.quadraticCurveTo(-56 - Math.sin(t * 9) * 4, -16, -78, -20); g.moveTo(-26, 8); g.quadraticCurveTo(-56 + Math.sin(t * 9) * 4, 16, -78, 20); g.stroke();
        g.fillStyle = info.color; g.strokeStyle = '#120a2a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-26, -13); g.lineTo(14, -15); g.quadraticCurveTo(38, -8, 40, 0); g.quadraticCurveTo(38, 8, 14, 15); g.lineTo(-26, 13); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-18, -4, 30, 8);
      } else {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(2, 4, 30, 8, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.ellipse(-20, 0, 11, 5, 0, 0, Math.PI * 2); g.ellipse(22, 0, 11, 5, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.fillStyle = info.color;
        g.beginPath(); g.roundRect(-18, -5, 38, 10, 5); g.fill(); g.stroke();
        g.strokeStyle = '#ddd'; g.lineWidth = 4; g.beginPath(); g.moveTo(18, -13); g.lineTo(22, 13); g.stroke();
      }
      g.rotate(-c.a);
      drawCritter(g, 0, -4, 11, info.color, info.avatar, { look: c.a, t, hurt: !!c.s, outline: '#120a2a' });
      g.restore();
      if (c.h) {
        g.strokeStyle = 'rgba(62,193,255,0.9)';
        g.lineWidth = 4;
        g.beginPath(); g.arc(c.x, c.y, 34, 0, Math.PI * 2); g.stroke();
      }
      g.font = '700 14px Rubik, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.fillText(info.name, c.x, c.y - 34);
    }
    fx.draw(g);
  },

  hud(g, f, { players }, W) {
    const x = W - 24;
    let y = 40;
    f.ord.forEach((id: string, i: number) => {
      const c = f.c.find((cc: any) => cc.id === id);
      const info = players.get(id);
      if (!c || !info) return;
      const right = c.fin ? ':flag:' : `${c.lap}/${f.laps}`;
      hudText(g, `${i + 1}. ${info.name}  ${right} ${c.it ? ITEM_ICON[c.it] : ''}`, x, y, 22, info.color, 'right');
      y += 32;
    });
    if (f.end >= 0) hudText(g, `:flag: ${f.end}`, W / 2, 48, 44, '#ffd23f');
  },

  event(e, f, { players, fx }) {
    const car = e.id ? f.c.find((c: any) => c.id === e.id) : null;
    const col = players.get(e.id)?.color ?? '#fff';
    switch (e.k) {
      case 'lap': if (car) fx.text(car.x, car.y - 50, `LAP ${e.lap}`, col, 34); sfx.coin(); break;
      case 'finish':
        if (car) { fx.text(car.x, car.y - 50, `#${e.place}!`, '#ffd23f', 56); fx.burst(car.x, car.y, col, 50, 400, 7); }
        sfx.win();
        break;
      case 'box': fx.burst(e.x, e.y, '#fff', 12, 220, 5); sfx.coin(); break;
      case 'boost': case 'pad': sfx.boost(); break;
      case 'shield': sfx.power(); break;
      case 'oil': sfx.pass(); break;
      case 'spin': if (car) fx.text(car.x, car.y - 40, 'SPIN!', '#b26bff', 32); sfx.bad(); break;
      case 'wall': fx.kick(4); fx.burst(e.x, e.y, '#ddd', 6, 200, 4); sfx.bump(); break;
      case 'bump': fx.kick(3); sfx.bump(); break;
      case 'surge': if (car) fx.burst(car.x, car.y, '#bfe9ff', 16, 260, 5); sfx.boost(); break;
      case 'rock': fx.burst(e.x, e.y, '#9ca3af', 10, 240, 5); fx.kick(4); sfx.bump(); break;
      case 'whirl': if (car) fx.text(car.x, car.y - 40, 'WHIRL!', '#9bd8ff', 30); sfx.bad(); break;
      case 'ramp': if (car) fx.text(car.x, car.y - 50, 'AIR!', '#ffd23f', 36); sfx.boost(); break;
      case 'jump': sfx.pass(); break;
      case 'land': if (car) fx.burst(car.x, car.y, '#e5c9a0', 12, 220, 4); sfx.coin(); break;
      case 'clear': if (car) fx.text(car.x, car.y - 46, `x${e.n}`, '#5dfc8d', 34); sfx.coin(); break;
      case 'crash': if (car) { fx.burst(car.x, car.y, '#ff8c42', 14, 260, 5); fx.text(car.x, car.y - 40, 'OOPS', '#ff4d6d', 30); } sfx.bad(); break;
    }
  },
}; }

export const kartRenderer = make('kart');
export const boatRenderer = make('boat');
export const bikeRenderer = make('bike');
