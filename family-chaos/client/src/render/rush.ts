import { makeLevel, platX, RUSH, sawY } from '../../../shared/rush';
import { sfx } from '../sound';
import { drawCritter, nameTag } from './critter';
import { hudText, type Renderer } from './types';

// Camera follows the front runner (smoothed). State is per page; reset when a new match starts.
let cam = 0;
let lastT = Infinity;

function hill(g: CanvasRenderingContext2D, off: number, base: number, amp: number, len: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, RUSH.VIEW_H);
  for (let x = 0; x <= RUSH.VIEW_W + 40; x += 40) g.lineTo(x, base - Math.sin((x + off) / len) * amp - Math.sin((x + off) / (len * 0.43)) * amp * 0.35);
  g.lineTo(RUSH.VIEW_W + 40, RUSH.VIEW_H);
  g.fill();
}

function saw(g: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  g.save();
  g.translate(x, y);
  g.rotate(t * 9);
  g.fillStyle = '#cfd6e6';
  g.strokeStyle = '#1d2540';
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, b = ((i + 0.5) / 16) * Math.PI * 2;
    g.lineTo(Math.cos(a) * (r + 7), Math.sin(a) * (r + 7));
    g.lineTo(Math.cos(b) * (r - 2), Math.sin(b) * (r - 2));
  }
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#ff4d6d';
  g.beginPath(); g.arc(0, 0, r * 0.35, 0, Math.PI * 2); g.fill(); g.stroke();
  g.restore();
}

export const rushRenderer: Renderer = {
  world: { x: 0, y: 0, w: RUSH.VIEW_W, h: RUSH.VIEW_H },
  background(g, W, H) {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2b1b6b');
    grad.addColorStop(0.55, '#ff7eb6');
    grad.addColorStop(1, '#ffd29d');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  },

  draw(g, f, { players, t, fx }) {
    const lv = makeLevel(f.sd, f.ln);
    const G = RUSH.GROUND;
    const racing = f.p.filter((p: any) => !p.c);
    const lead = Math.max(...(racing.length ? racing : f.p).map((p: any) => p.x));
    const target = Math.max(-120, Math.min(lv.length - RUSH.VIEW_W + 60, lead - RUSH.VIEW_W * 0.58));
    if (f.t < lastT - 0.5) cam = target;
    lastT = f.t;
    cam += (target - cam) * 0.12;

    // sun + parallax hills
    g.fillStyle = '#fff3c4';
    g.beginPath(); g.arc(1080, 190, 90, 0, Math.PI * 2); g.fill();
    hill(g, cam * 0.15, 470, 60, 190, '#7b4fd1');
    hill(g, cam * 0.3, 530, 50, 140, '#5a3aa8');
    hill(g, cam * 0.5, 600, 36, 100, '#3d2a80');

    g.save();
    g.translate(-cam, 0);
    const x0 = cam - 60, x1 = cam + RUSH.VIEW_W + 60;

    // ground
    for (const s of lv.ground) {
      if (s.x1 < x0 || s.x0 > x1) continue;
      const gr = g.createLinearGradient(0, G, 0, G + 240);
      gr.addColorStop(0, '#7a4a2b'); gr.addColorStop(1, '#3a2316');
      g.fillStyle = gr;
      g.fillRect(s.x0, G, s.x1 - s.x0, RUSH.VIEW_H - G + 10);
      g.fillStyle = '#5ee27a';
      g.fillRect(s.x0, G - 6, s.x1 - s.x0, 18);
      g.fillStyle = '#3cb85a';
      for (let x = Math.max(s.x0, Math.floor(x0 / 24) * 24); x < Math.min(s.x1, x1); x += 24) g.fillRect(x, G + 8, 12, 5);
    }
    // pits: dark void
    // (the gap simply shows the background; add a glow at the bottom so it reads as deadly)
    g.fillStyle = 'rgba(255,60,90,0.18)';
    g.fillRect(x0, G + 170, x1 - x0, 60);

    // platforms
    lv.plats.forEach((p) => {
      const px = platX(p, f.t);
      if (px + p.w < x0 || px > x1) return;
      g.fillStyle = p.mv ? '#3ec1ff' : '#ffd23f';
      g.strokeStyle = '#1d2540';
      g.lineWidth = 3;
      g.beginPath(); g.roundRect(px, p.y, p.w, 22, 8); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.4)';
      g.fillRect(px + 8, p.y + 4, p.w - 16, 4);
      if (p.mv) { g.fillStyle = '#1d2540'; g.font = '900 14px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText('◀ ▶', px + p.w / 2, p.y + 17); }
    });

    // spikes
    for (const s of lv.spikes) {
      if (s.x + s.w < x0 || s.x > x1) continue;
      g.fillStyle = '#e9edf7'; g.strokeStyle = '#1d2540'; g.lineWidth = 2.5;
      const n = Math.max(1, Math.round(s.w / 24)), w = s.w / n;
      for (let i = 0; i < n; i++) {
        g.beginPath(); g.moveTo(s.x + i * w, G); g.lineTo(s.x + i * w + w / 2, G - 30); g.lineTo(s.x + (i + 1) * w, G); g.closePath(); g.fill(); g.stroke();
      }
    }
    // saws on a rail
    for (const s of lv.saws) {
      if (s.x < x0 || s.x > x1) continue;
      g.strokeStyle = 'rgba(29,37,64,.6)'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(s.x, s.y0 - s.amp - 40); g.lineTo(s.x, G); g.stroke();
      saw(g, s.x, sawY(s, f.t), s.r, t);
    }
    // checkpoints
    const reached = Math.max(...f.p.map((p: any) => p.cp));
    lv.checkpoints.forEach((cx, i) => {
      if (i === 0 || cx < x0 || cx > x1) return;
      g.strokeStyle = '#1d2540'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx, G); g.lineTo(cx, G - 110); g.stroke();
      g.fillStyle = i <= reached ? '#5dfc8d' : '#ffffff';
      g.beginPath(); g.moveTo(cx, G - 110); g.lineTo(cx + 46, G - 94 + Math.sin(t * 5 + i) * 3); g.lineTo(cx, G - 76); g.closePath(); g.fill(); g.stroke();
    });
    // finish arch
    if (lv.finishX > x0 && lv.finishX < x1) {
      const fx0 = lv.finishX;
      g.fillStyle = '#1d2540'; g.fillRect(fx0 - 8, G - 220, 16, 220); g.fillRect(fx0 + 112, G - 220, 16, 220);
      for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#fff' : '#111';
        g.fillRect(fx0 - 8 + i * 11.7, G - 220 + j * 22, 11.7, 22);
      }
      hudText(g, 'FINISH', fx0 + 60, G - 250, 38, '#ffd23f');
    }

    // runners
    const sorted = [...f.p].sort((a: any, b: any) => a.y - b.y);
    let slot = 0;
    for (const p of sorted) {
      const info = players.get(p.id);
      if (!info || p.x < x0 - 60 || p.x > x1 + 60) continue;
      if (p.i && Math.floor(t * 14) % 2) continue;
      if (p.d) {
        for (let k = 1; k <= 3; k++) drawCritter(g, p.x - p.f * k * 22, p.y - 26, 22, info.color, info.avatar, { alpha: 0.16, t });
      }
      drawCritter(g, p.x, p.y - 26, 24, info.color, info.avatar, { look: p.f > 0 ? 0 : Math.PI, t: p.g ? t : 0, hurt: !!p.k, squash: p.g ? 0 : -0.1 });
      nameTag(g, p.x, p.y - 74 - (slot++ % 3) * 20, info.name, info.color, 15); // staggered so stacked runners stay readable
    }
    fx.draw(g);
    g.restore();
  },

  hud(g, f, { players, lang }, W, H) {
    const lv = makeLevel(f.sd, f.ln);
    hudText(g, f.end >= 0 ? `🏁 ${f.end}` : `${f.left}`, W / 2, 44, 44, f.end >= 0 || f.left <= 15 ? '#ff4d6d' : '#fff');
    // standings (left)
    f.o.slice(0, 8).forEach((id: string, i: number) => {
      const info = players.get(id);
      if (info) hudText(g, `${i + 1}. ${info.name}`, 24, 40 + i * 30, 22, info.color, 'left');
    });
    // progress bar
    const bw = Math.min(W * 0.7, 1100), bx = (W - bw) / 2, by = H - 36;
    g.fillStyle = 'rgba(10,5,30,.6)';
    g.beginPath(); g.roundRect(bx - 12, by - 16, bw + 24, 32, 16); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw, by); g.stroke();
    for (const c of lv.checkpoints.slice(1)) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(bx + (c / lv.finishX) * bw - 1, by - 8, 3, 16); }
    hudText(g, '🏁', bx + bw + 4, by, 26);
    for (const p of f.p) {
      const info = players.get(p.id);
      if (!info) continue;
      const k = Math.max(0, Math.min(1, p.x / lv.finishX));
      g.fillStyle = info.color; g.strokeStyle = '#120a2a'; g.lineWidth = 3;
      g.beginPath(); g.arc(bx + k * bw, by, 10, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    void lang;
  },

  event(e, f, { players, fx }) {
    const p = e.id ? f.p.find((q: any) => q.id === e.id) : null;
    const col = players.get(e.id)?.color ?? '#fff';
    switch (e.k) {
      case 'jump': if (p) fx.burst(p.x, p.y, '#fff', 5, 120, 4, 400); break;
      case 'land': fx.burst(e.x, e.y, '#d8c7a4', 6, 140, 4, 300); break;
      case 'hit':
        if (p) { fx.burst(p.x, p.y - 20, col, 30, 380, 7, 500); fx.text(p.x, p.y - 80, e.kind === 'pit' ? 'SPLAT!' : 'OUCH!', col, 36); }
        fx.kick(7); sfx.bad();
        break;
      case 'dash': sfx.dash(); break;
      case 'shove': fx.kick(5); sfx.bump(); break;
      case 'checkpoint': fx.text(e.x, 380, '✓', '#5dfc8d', 44); sfx.coin(); break;
      case 'finish': if (p) { fx.burst(p.x, p.y - 30, col, 60, 450, 8, 300); fx.text(p.x, p.y - 100, `#${e.place}`, '#ffd23f', 60); } sfx.win(); break;
    }
  },
};
