import { sfx } from '../sound';
import { drawCritter, nameTag } from './critter';
import { drawIcon } from './icons';
import { hearts } from './kit';
import { hudText, starfield, type Renderer } from './types';

const POW_COLOR: Record<string, string> = { mega: '#ff4d6d', shield: '#3ec1ff', speed: '#ffd23f' };
const POW_ICON: Record<string, string> = { mega: 'star', shield: 'shield', speed: 'bolt' };

export const bumperRenderer: Renderer = {
  world: { x: -480, y: -470, w: 960, h: 940 },
  background: (g, W, H, t) => starfield(g, W, H, t, '#2a0f4f', '#06021a'),

  draw(g, f, { players, t, fx }) {
    const R: number = f.R;
    // platform side (fake depth)
    g.fillStyle = '#3b1d6e';
    g.beginPath();
    g.ellipse(0, 34, R, R, 0, 0, Math.PI * 2);
    g.fill();
    // top
    const grad = g.createRadialGradient(0, -R * 0.3, R * 0.1, 0, 0, R);
    grad.addColorStop(0, '#8b5cf6');
    grad.addColorStop(1, '#4c1d95');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    // rings
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 3;
    for (let r = 80; r < R; r += 80) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    // rim
    const shrinking = f.R > 181 && f.t > 15;
    g.strokeStyle = shrinking ? `rgba(255,${80 + 80 * Math.sin(t * 10)},110,0.95)` : '#ffd23f';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.stroke();

    for (const u of f.u) {
      const pulse = 1 + Math.sin(t * 6 + u.id) * 0.12;
      g.save();
      g.translate(u.x, u.y);
      g.shadowColor = POW_COLOR[u.k];
      g.shadowBlur = 24;
      g.fillStyle = POW_COLOR[u.k];
      g.beginPath();
      g.arc(0, 0, 20 * pulse, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      drawIcon(g, POW_ICON[u.k], 0, 0, 26);
      g.restore();
    }

    const sorted = [...f.p].sort((a: any, b: any) => a.y - b.y);
    for (const p of sorted) {
      const info = players.get(p.id);
      if (!info || p.l <= 0 || p.f) continue;
      if (p.i && Math.floor(t * 12) % 2) continue; // invulnerable blink
      if (p.d) {
        g.fillStyle = info.color;
        g.globalAlpha = 0.3;
        g.beginPath();
        g.arc(p.x - Math.cos(p.a) * 26, p.y - Math.sin(p.a) * 26, p.r * 0.9, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      if (p.w === 'shield') {
        g.strokeStyle = 'rgba(62,193,255,0.9)';
        g.lineWidth = 5;
        g.beginPath();
        g.arc(p.x, p.y, p.r + 12 + Math.sin(t * 8) * 2, 0, Math.PI * 2);
        g.stroke();
      }
      if (p.w === 'speed') {
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 3;
        for (let k = -1; k <= 1; k++) {
          g.beginPath();
          g.moveTo(p.x - Math.cos(p.a) * (p.r + 8) + k * 8, p.y - Math.sin(p.a) * (p.r + 8));
          g.lineTo(p.x - Math.cos(p.a) * (p.r + 30) + k * 8, p.y - Math.sin(p.a) * (p.r + 30));
          g.stroke();
        }
      }
      if (p.g) { // dodging: translucent after-images
        for (let k = 1; k <= 2; k++) drawCritter(g, p.x - Math.cos(p.a) * 16 * k, p.y - Math.sin(p.a) * 16 * k, p.r, info.color, info.avatar, { alpha: 0.18, t });
      }
      drawCritter(g, p.x, p.y, p.r, info.color, info.avatar, { look: p.a, t, squash: p.d ? 0.6 : 0, alpha: p.iv ? 0.16 : p.g ? 0.5 : 1 });
      if (p.h) { // stored power orbits the head, ready to fire
        const oa = t * 4;
        const ox = p.x + Math.cos(oa) * (p.r + 10), oy = p.y - p.r * 0.4 + Math.sin(oa) * 8;
        g.fillStyle = POW_COLOR[p.h];
        g.shadowColor = POW_COLOR[p.h];
        g.shadowBlur = 12;
        g.beginPath(); g.arc(ox, oy, 8, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
      }
      if (!p.iv) nameTag(g, p.x, p.y - p.r - 30, info.name, info.color, 16);
      hearts(g, p.x, p.y - p.r - 52, p.l, Math.max(p.l, 1), 14);
    }
    fx.draw(g);
  },

  hud(g, f, { players }, W) {
    hudText(g, `${f.left}`, W / 2, 48, 48, f.left <= 10 ? '#ff4d6d' : '#fff');
    let y = 40;
    for (const p of f.p) {
      const info = players.get(p.id);
      if (!info) continue;
      hudText(g, `${info.name}  ${':heart:'.repeat(Math.max(0, p.l))}  ${p.k} KO`, 24, y, 22, p.l > 0 ? info.color : '#666', 'left');
      y += 32;
    }
  },

  event(e, _f, { players, fx }) {
    const col = players.get(e.id)?.color ?? '#fff';
    switch (e.k) {
      case 'bump':
        fx.burst(e.x, e.y, '#fff', 10, 300, 5);
        fx.kick(Math.min(14, e.s / 60));
        sfx.bump();
        break;
      case 'fall':
        fx.burst(e.x, e.y, col, 40, 420, 8);
        fx.text(e.x, e.y - 40, e.out ? 'OUT!' : '−1 :heart:', col, e.out ? 52 : 38);
        fx.kick(10);
        sfx.fall();
        break;
      case 'dash': sfx.dash(); break;
      case 'power': sfx.power(); fx.kick(3); break;
      case 'pickup': sfx.coin(); break;
      case 'dodge': sfx.dash(); break;
      case 'spawn': sfx.join(); break;
    }
  },
};
