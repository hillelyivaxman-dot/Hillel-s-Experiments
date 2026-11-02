import { getTrack, TRACK_WIDTH, WORLD_H, WORLD_W } from '../../../shared/tracks';
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

const ITEM_ICON: Record<string, string> = { turbo: '🚀', oil: '🛢', shield: '🛡' };

export const kartRenderer: Renderer = {
  world: { x: 0, y: 0, w: WORLD_W, h: WORLD_H },
  background: (g, W, H) => {
    g.fillStyle = '#1f8a4c';
    g.fillRect(0, 0, W, H);
  },

  draw(g, f, { players, t, fx }) {
    // grass stripes
    g.fillStyle = '#23964f';
    for (let x = 0; x < WORLD_W; x += 80) g.fillRect(x, 0, 40, WORLD_H);
    const path = trackPath(f.tr);
    const tr = getTrack(f.tr);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    // run-off sand
    g.strokeStyle = '#e8c27a';
    g.lineWidth = TRACK_WIDTH + 96;
    g.stroke(path);
    // curbs
    g.strokeStyle = '#fff';
    g.lineWidth = TRACK_WIDTH + 18;
    g.stroke(path);
    g.strokeStyle = '#ff4d6d';
    g.setLineDash([22, 22]);
    g.stroke(path);
    g.setLineDash([]);
    // asphalt
    g.strokeStyle = '#3a3a4a';
    g.lineWidth = TRACK_WIDTH;
    g.stroke(path);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
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

    // boost pads
    for (const p of f.pd) {
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
    for (const o of f.oil) {
      g.fillStyle = 'rgba(15,10,25,0.85)';
      g.beginPath();
      g.ellipse(o.x, o.y, 30, 22, 0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(160,100,255,0.35)';
      g.beginPath();
      g.ellipse(o.x - 6, o.y - 5, 10, 5, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    // item boxes
    for (const b of f.bx) {
      if (!b.on) continue;
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
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.a);
      if (c.b) {
        g.fillStyle = Math.floor(t * 20) % 2 ? '#ffd23f' : '#ff8c42';
        g.beginPath();
        g.moveTo(-24, -8); g.lineTo(-44 - Math.random() * 14, 0); g.lineTo(-24, 8);
        g.fill();
      }
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
      const right = c.fin ? '🏁' : `${c.lap}/${f.laps}`;
      hudText(g, `${i + 1}. ${info.name}  ${right} ${c.it ? ITEM_ICON[c.it] : ''}`, x, y, 22, info.color, 'right');
      y += 32;
    });
    if (f.end >= 0) hudText(g, `🏁 ${f.end}`, W / 2, 48, 44, '#ffd23f');
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
    }
  },
};
