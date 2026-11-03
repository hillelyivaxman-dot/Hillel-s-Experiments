import { sawYAt, TRAP_KINDS, TRAPS } from '../../../shared/traps';
import { sfx } from '../sound';
import { drawCritter, nameTag } from './critter';
import { hudText, type Renderer } from './types';

const G = TRAPS.GROUND;
let cam = 0, lastT = Infinity;

function saw(g: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  g.save(); g.translate(x, y); g.rotate(t * 9); g.fillStyle = '#cfd6e6'; g.strokeStyle = '#1d2540'; g.lineWidth = 3;
  g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, b = ((i + 0.5) / 16) * Math.PI * 2; g.lineTo(Math.cos(a) * (r + 7), Math.sin(a) * (r + 7)); g.lineTo(Math.cos(b) * (r - 2), Math.sin(b) * (r - 2)); }
  g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(0, 0, r * 0.35, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
}

function trap(g: CanvasRenderingContext2D, kind: number, x: number, t: number, runT: number, color: string) {
  const k = TRAP_KINDS[kind];
  if (k === 'spikes') {
    g.fillStyle = '#e9edf7'; g.strokeStyle = '#1d2540'; g.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { const sx = x - TRAPS.SPIKE_W / 2 + (i * TRAPS.SPIKE_W) / 3; g.beginPath(); g.moveTo(sx, G); g.lineTo(sx + TRAPS.SPIKE_W / 6, G - 32); g.lineTo(sx + TRAPS.SPIKE_W / 3, G); g.closePath(); g.fill(); g.stroke(); }
  } else if (k === 'saw') {
    g.strokeStyle = 'rgba(29,37,64,.6)'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, G - 170); g.lineTo(x, G); g.stroke();
    saw(g, x, sawYAt(x, runT), TRAPS.SAW_R, t);
  } else { // pit: dark gap with warning stripes
    g.fillStyle = '#12091f'; g.fillRect(x - TRAPS.PIT_W / 2, G - 4, TRAPS.PIT_W, 300);
    g.fillStyle = '#ffd23f'; for (let i = 0; i < 4; i++) g.fillRect(x - TRAPS.PIT_W / 2 + i * (TRAPS.PIT_W / 4), G - 6, TRAPS.PIT_W / 8, 8);
  }
  g.fillStyle = color; g.beginPath(); g.arc(x, G + 30, 7, 0, Math.PI * 2); g.fill(); // owner colour dot
}

function course(g: CanvasRenderingContext2D, f: any, players: Map<string, any>, t: number, x0: number, x1: number, zoom = 1) {
  g.fillStyle = '#4a2f6b'; g.fillRect(x0, G, x1 - x0, 400);
  g.fillStyle = '#7bd35a'; g.fillRect(x0, G - 6, x1 - x0, 16);
  // cut the pits out of the ground
  for (const [x, kind] of f.tr) if (kind === 2) { g.fillStyle = '#12091f'; g.fillRect(x - TRAPS.PIT_W / 2, G - 8, TRAPS.PIT_W, 420); }
  // start & finish
  g.fillStyle = 'rgba(93,252,141,.18)'; g.fillRect(0, G - 160, TRAPS.START_SAFE, 160);
  const fx = TRAPS.FINISH;
  g.fillStyle = '#1d2540'; g.fillRect(fx - 8, G - 220, 16, 220); g.fillRect(fx + 112, G - 220, 16, 220);
  for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111'; g.fillRect(fx - 8 + i * 11.7, G - 220 + j * 22, 11.7, 22); }
  for (const [x, kind, owner] of f.tr) {
    g.save(); g.translate(x, G); g.scale(zoom, zoom); g.translate(-x, -G); // blueprint view: traps are drawn bigger so they read from the sofa
    trap(g, kind, x, t, f.rt, players.get(owner)?.color ?? '#fff');
    g.restore();
  }
}

export const trapBuildersRenderer: Renderer = {
  world: { x: 0, y: -90, w: 1400, h: 850 },
  background(g, W, H) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#1b0f45'); gr.addColorStop(1, '#431a63');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  },

  draw(g, f, { players, t, fx }) {
    if (f.ph === 'build' || f.ph === 'score') {
      // blueprint view: the whole course squeezed into the screen
      const s = 1300 / TRAPS.LENGTH;
      g.save(); g.translate(50, 150 - G * s * 0.0); g.scale(s, s); g.translate(0, 80);
      course(g, f, players, t, -100, TRAPS.LENGTH, 2.6);
      for (const p of f.p) {
        const info = players.get(p.id); if (!info) continue;
        if (f.ph === 'build') {
          g.strokeStyle = info.color; g.lineWidth = 8; g.setLineDash([18, 14]); g.beginPath(); g.moveTo(p.cx, G - 360); g.lineTo(p.cx, G); g.stroke(); g.setLineDash([]);
          g.save(); g.translate(p.cx, G - 400); g.scale(1 / s * 0.9, 1 / s * 0.9);
          drawCritter(g, 0, 0, 22, info.color, info.avatar, { t });
          g.fillStyle = 'rgba(10,5,30,.8)'; g.beginPath(); g.roundRect(-52, 30, 104, 26, 13); g.fill(); hudText(g, `${['▲', '✺', '▬'][p.ty]} ×${p.l}`, 0, 43, 18, info.color);
          g.restore();
        }
      }
      g.restore();
      return;
    }
    // race view: scrolling camera
    const racing = f.p.filter((p: any) => !p.c);
    const lead = Math.max(...(racing.length ? racing : f.p).map((p: any) => p.x));
    const target = Math.max(-120, Math.min(TRAPS.LENGTH - 1400 + 60, lead - 1400 * 0.5));
    if (f.t < lastT - 0.5) cam = target;
    lastT = f.t;
    cam += (target - cam) * 0.12;
    g.save(); g.translate(-cam, 0);
    course(g, f, players, t, cam - 60, cam + 1460);
    const sorted = [...f.p].sort((a: any, b: any) => a.y - b.y);
    let slot = 0;
    for (const p of sorted) {
      const info = players.get(p.id); if (!info || p.x < cam - 60 || p.x > cam + 1460) continue;
      if (p.i && Math.floor(t * 14) % 2) continue;
      if (p.d) for (let k = 1; k <= 3; k++) drawCritter(g, p.x - p.f * k * 22, p.y - 26, 22, info.color, info.avatar, { alpha: 0.16, t });
      drawCritter(g, p.x, p.y - 26, 24, info.color, info.avatar, { look: p.f > 0 ? 0 : Math.PI, t: p.g ? t : 0, squash: p.g ? 0 : -0.1 });
      nameTag(g, p.x, p.y - 74 - (slot++ % 3) * 20, info.name, info.color, 15);
    }
    fx.draw(g);
    g.restore();
  },

  hud(g, f, { players, lang }, W, H) {
    const T = (he: string, en: string) => (lang === 'he' ? he : en);
    hudText(g, `${T('סבב', 'ROUND')} ${f.round}/${f.rounds}`, 24, 40, 28, '#fff', 'left');
    if (f.ph === 'build') {
      hudText(g, `${T('בונים מלכודות!', 'BUILD YOUR TRAPS!')}  ${f.tm}`, W / 2, 48, 46, '#ffd23f');
      hudText(g, T('ג׳ויסטיק: להזיז · B: סוג מלכודת · A: להניח', 'Stick: move · B: trap type · A: place'), W / 2, H - 28, 22, '#fff');
    } else if (f.ph === 'run') {
      hudText(g, f.end >= 0 ? `🏁 ${f.end}` : `${f.tm}`, W / 2, 44, 44, '#fff');
      [...f.p].sort((a: any, b: any) => b.x - a.x).forEach((p: any, i: number) => { const info = players.get(p.id); if (info) hudText(g, `${i + 1}. ${info.name}${p.c ? ' 🏁' : ''}`, 24, 84 + i * 28, 20, info.color, 'left'); });
    } else if (f.ph === 'score' || f.ph === 'done') {
      g.fillStyle = 'rgba(10,5,30,.8)'; g.beginPath(); g.roundRect(W / 2 - 330, H / 2 - 40, 660, 80 + f.p.length * 38, 24); g.fill();
      hudText(g, T('ניקוד', 'SCORES'), W / 2, H / 2 - 4, 34, '#ffd23f');
      [...f.p].sort((a: any, b: any) => b.tot - a.tot).forEach((p: any, i: number) => {
        const info = players.get(p.id); if (!info) return;
        hudText(g, `${i + 1}. ${info.name}`, W / 2 - 290, H / 2 + 44 + i * 38, 26, info.color, 'left');
        hudText(g, `+${p.rp}`, W / 2 + 150, H / 2 + 44 + i * 38, 24, '#5dfc8d', 'right');
        hudText(g, `${p.tot}`, W / 2 + 290, H / 2 + 44 + i * 38, 28, '#fff', 'right');
      });
    }
  },

  event(e, f, { players, fx }) {
    const p = e.id ? f.p.find((q: any) => q.id === e.id) : null;
    const col = players.get(e.id)?.color ?? '#fff';
    switch (e.k) {
      case 'place': sfx.power(); break;
      case 'kind': sfx.click(); break;
      case 'nope': sfx.bad(); break;
      case 'build': case 'run': sfx.go(); break;
      case 'hit': if (p && f.ph === 'run') { fx.burst(p.x, p.y - 20, col, 26, 380, 7, 500); fx.text(p.x, p.y - 80, 'OUCH!', col, 34); } fx.kick(6); sfx.bad(); break;
      case 'score': { const q = f.p.find((z: any) => z.id === e.id); if (q && f.ph === 'run') fx.text(q.x, q.y - 120, '+1', '#5dfc8d', 36); sfx.coin(); break; }
      case 'finish': if (p) { fx.burst(p.x, p.y - 30, col, 50, 420, 8, 300); fx.text(p.x, p.y - 100, `#${e.place}`, '#ffd23f', 56); } sfx.win(); break;
      case 'dash': sfx.dash(); break;
      case 'roundEnd': sfx.win(); break;
    }
  },
};
