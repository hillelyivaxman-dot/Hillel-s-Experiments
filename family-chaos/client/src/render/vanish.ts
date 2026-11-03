import { VANISH } from '../../../shared/vanish';
import { sfx } from '../sound';
import { drawCritter, nameTag } from './critter';
import { hudText, type Renderer } from './types';

const { COLS, ROWS, TILE } = VANISH;
const W = COLS * TILE, H = ROWS * TILE;

export const vanishRenderer: Renderer = {
  world: { x: -80, y: -110, w: W + 160, h: H + 200 },
  background(g, w, h, t) {
    const gr = g.createRadialGradient(w / 2, h * 0.7, 40, w / 2, h / 2, Math.max(w, h) * 0.75);
    gr.addColorStop(0, '#7a1630'); gr.addColorStop(0.45, '#2c0d3d'); gr.addColorStop(1, '#0a0420');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,120,60,.25)';
    for (let i = 0; i < 26; i++) { const x = (i * 131 + t * 20) % w, y = h - ((t * 40 + i * 77) % h); g.beginPath(); g.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); g.fill(); }
  },

  draw(g, f, { players, t, fx }) {
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = i % COLS, r = Math.floor(i / COLS), s = f.tl[i];
      const x = c * TILE, y = r * TILE;
      if (s === '2') { g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 2; g.strokeRect(x + 6, y + 6, TILE - 12, TILE - 12); continue; }
      const shake = s === '1' ? Math.sin(t * 70 + i) * 3 : 0;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(x + 6 + shake, y + 16, TILE - 8, TILE - 8, 18); g.fill();
      const base = (c + r) % 2 ? '#8b5cf6' : '#6d3fd8';
      g.fillStyle = s === '1' ? '#ff6b3c' : base; g.strokeStyle = '#1d1040'; g.lineWidth = 4;
      g.beginPath(); g.roundRect(x + 4 + shake, y + 4, TILE - 8, TILE - 8, 18); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.roundRect(x + 14 + shake, y + 12, TILE - 28, 12, 6); g.fill();
      if (s === '1') { // cracks
        g.strokeStyle = '#2b0a05'; g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x + 30, y + 24); g.lineTo(x + 58, y + 62); g.lineTo(x + 46, y + 96); g.moveTo(x + 58, y + 62); g.lineTo(x + 100, y + 70); g.stroke();
      }
    }
    const sorted = [...f.p].sort((a: any, b: any) => a.y - b.y);
    for (const p of sorted) {
      const info = players.get(p.id); if (!info) continue;
      if (!p.al) { // falling: shrink and drop
        const k = Math.min(1, p.fl / 0.9);
        if (k < 1) { g.globalAlpha = 1 - k; drawCritter(g, p.x, p.y + k * 260, 26 * (1 - k * 0.7), info.color, info.avatar, { t, hurt: true }); g.globalAlpha = 1; }
        continue;
      }
      g.fillStyle = `rgba(0,0,0,${0.3 - p.z / 400})`; g.beginPath(); g.ellipse(p.x, p.y + 26, 28 - p.z / 6, 11 - p.z / 12, 0, 0, Math.PI * 2); g.fill();
      drawCritter(g, p.x, p.y - p.z, 27, info.color, info.avatar, { t, squash: p.z > 1 ? -0.1 : 0 });
      nameTag(g, p.x, p.y - p.z - 48, info.name, info.color, 15);
    }
    fx.draw(g);
  },

  hud(g, f, { players, lang }, Wd) {
    hudText(g, `${lang === 'he' ? 'נותרו' : 'LEFT'}: ${f.left}`, Wd / 2, 44, 44, '#ffd23f');
    f.p.filter((p: any) => p.al).forEach((p: any, i: number) => { const info = players.get(p.id); if (info) hudText(g, info.name, 24, 40 + i * 28, 21, info.color, 'left'); });
  },

  event(e, _f, { fx }) {
    switch (e.k) {
      case 'crack': sfx.tick(); break;
      case 'gone': sfx.click(); break;
      case 'bump': fx.burst(e.x, e.y, '#fff', 8, 260, 5); fx.kick(4); sfx.bump(); break;
      case 'jump': sfx.pass(); break;
      case 'dash': fx.kick(5); sfx.dash(); break;
      case 'fall': fx.burst(e.x, e.y, '#ff6b3c', 24, 360, 7, 500); fx.kick(10); sfx.fall(); break;
      case 'winner': sfx.win(); break;
    }
  },
};
