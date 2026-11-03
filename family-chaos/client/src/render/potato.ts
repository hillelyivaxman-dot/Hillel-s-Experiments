import { sfx } from '../sound';
import { drawCritter, nameTag } from './critter';
import { hudText, type Renderer } from './types';

function bomb(g: CanvasRenderingContext2D, x: number, y: number, heat: number, t: number) {
  const pulse = 1 + Math.sin(t * (6 + heat * 30)) * (0.06 + heat * 0.1);
  g.save();
  g.translate(x, y);
  g.scale(pulse, pulse);
  g.fillStyle = heat > 0.7 ? `rgb(${120 + 135 * Math.abs(Math.sin(t * 20))},20,30)` : '#1a1a2e';
  g.strokeStyle = '#000';
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.beginPath(); g.arc(-7, -7, 5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#c8a26b';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(8, -16); g.quadraticCurveTo(18, -30, 10, -36); g.stroke();
  g.fillStyle = Math.floor(t * 20) % 2 ? '#ffd23f' : '#ff4d6d';
  g.beginPath(); g.arc(10, -38, 6 + Math.random() * 3, 0, Math.PI * 2); g.fill();
  g.restore();
}

export const potatoRenderer: Renderer = {
  world: { x: -760, y: -440, w: 1520, h: 880 },
  background: (g, W, H) => {
    g.fillStyle = '#2b1a0e';
    g.fillRect(0, 0, W, H);
  },

  draw(g, f, { players, t, fx }) {
    // floor
    g.fillStyle = '#c98a4b';
    g.fillRect(-700, -380, 1400, 760);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let x = -700; x < 700; x += 70) g.fillRect(x, -380, 3, 760);
    // heat tint
    if (f.ph === 'play' && f.heat > 0.5) {
      g.fillStyle = `rgba(255,40,40,${(f.heat - 0.5) * 0.35 * (0.6 + 0.4 * Math.sin(t * 12))})`;
      g.fillRect(-700, -380, 1400, 760);
    }
    g.strokeStyle = '#6b3d1a';
    g.lineWidth = 18;
    g.strokeRect(-709, -389, 1418, 778);

    const sorted = [...f.p].sort((a: any, b: any) => a.y - b.y);
    for (const p of sorted) {
      const info = players.get(p.id);
      if (!info) continue;
      if (p.o) {
        g.globalAlpha = 0.35;
        g.fillStyle = '#222';
        g.beginPath(); g.ellipse(p.x, p.y + 10, 28, 12, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
        continue;
      }
      const hot = f.h === p.id;
      drawCritter(g, p.x, p.y, 30, info.color, info.avatar, { t, squash: p.s ? 0.4 : 0, look: hot ? -Math.PI / 2 : Math.PI / 2 });
      nameTag(g, p.x, p.y + 48, info.name, info.color, 15);
      if (hot && !(f.fl && f.fl.k < 1)) bomb(g, p.x, p.y - 58, f.heat, t);
    }
    if (f.fl && f.fl.k < 1) { // bomb flying in an arc from thrower to target
      const a = f.p.find((q: any) => q.id === f.fl.f), b = f.p.find((q: any) => q.id === f.fl.t);
      if (a && b) {
        const k = f.fl.k;
        const x = a.x + (b.x - a.x) * k, y = a.y - 58 + (b.y - a.y) * k - Math.sin(k * Math.PI) * 140;
        bomb(g, x, y, f.heat, t);
      }
    }
    fx.draw(g);
  },

  hud(g, f, { players, lang }, W) {
    const h = players.get(f.h);
    if (f.ph === 'play' && h) hudText(g, `💣 ${h.name}`, W / 2, 48, 44, h.color);
    if (f.ph === 'boom' && f.b) {
      const v = players.get(f.b.id);
      if (v) hudText(g, `💥 ${v.name} ${lang === 'he' ? 'עף!' : 'is out!'}`, W / 2, 48, 44, v.color);
    }
    hudText(g, `${lang === 'he' ? 'סבב' : 'Round'} ${f.round}`, 24, 40, 26, '#fff', 'left');
  },

  event(e, f, { players, fx }) {
    switch (e.k) {
      case 'pass': {
        const to = f.p.find((p: any) => p.id === e.to);
        if (to) fx.burst(to.x, to.y - 50, '#ffd23f', 14, 240, 5);
        sfx.pass();
        break;
      }
      case 'boom':
        fx.burst(e.x, e.y, '#ff8c42', 70, 650, 10);
        fx.burst(e.x, e.y, '#ffd23f', 40, 420, 8);
        fx.burst(e.x, e.y, players.get(e.id)?.color ?? '#fff', 30, 300, 6);
        fx.kick(22);
        fx.blink('#fff', 0.8);
        sfx.boom();
        break;
      case 'round': sfx.tick(); break;
      case 'sprint': sfx.dash(); break;
      case 'throw': sfx.pass(); break;
      case 'miss': sfx.bad(); break;
    }
  },
};
