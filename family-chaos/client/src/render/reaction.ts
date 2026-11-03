import { sfx } from '../sound';
import { drawCritter, nameTag } from './critter';
import { hudText, type Renderer } from './types';

const BG: Record<string, [string, string]> = {
  wait: ['#7a1131', '#2b0716'],
  fake: ['#6d28d9', '#2e1065'],
  go: ['#16a34a', '#064e3b'],
  show: ['#1e1b4b', '#0b0820'],
  done: ['#1e1b4b', '#0b0820'],
};
let current = 'wait';

export const reactionRenderer: Renderer = {
  world: { x: 0, y: 0, w: 1600, h: 900 },
  background: (g, W, H, t) => {
    const [a, b] = BG[current] ?? BG.wait;
    const grad = g.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H / 2, Math.max(W, H) * 0.75);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 40;
    const r0 = (t * 120) % 160;
    for (let r = r0; r < Math.max(W, H); r += 160) { g.beginPath(); g.arc(W / 2, H * 0.4, r, 0, Math.PI * 2); g.stroke(); }
  },

  draw(g, f, { players, t, lang, fx }) {
    current = f.ph;
    const he = lang === 'he';
    const big = f.ph === 'go' ? (he ? 'עכשיו!' : 'TAP!') : f.ph === 'fake' ? (he ? 'עוד לא!' : 'NOT YET!') :
      f.ph === 'wait' ? (he ? 'חכו…' : 'WAIT…') : '';
    if (big) hudText(g, big, 800, 330, f.ph === 'go' ? 210 + Math.sin(t * 20) * 8 : 150, '#fff');
    if (f.ph === 'show' || f.ph === 'done') {
      const w = f.w ? players.get(f.w) : null;
      hudText(g, w ? `${w.name} ${he ? 'הכי מהיר!' : 'is fastest!'}` : he ? 'אף אחד?!' : 'Nobody?!', 800, 300, 90, w?.color ?? '#fff');
    }
    const n = f.s.length;
    const gap = Math.min(190, 1500 / Math.max(1, n));
    f.s.forEach((s: any, i: number) => {
      const info = players.get(s.id);
      if (!info) return;
      const x = 800 + (i - (n - 1) / 2) * gap;
      const y = 680;
      const jump = s.tp && !s.e ? -Math.abs(Math.sin(t * 8)) * 18 : 0;
      drawCritter(g, x, y + jump, Math.min(52, gap * 0.3), info.color, info.avatar, { t, hurt: !!s.e, look: -Math.PI / 2 });
      nameTag(g, x, y + 80, info.name, info.color, 20);
      hudText(g, `${s.sc}`, x, y - 90, 34, '#ffd23f');
      if (s.e) hudText(g, ':cross:', x, y - 140, 40, '#ff4d6d');
      else if (s.ms >= 0) hudText(g, `${s.ms}ms`, x, y - 140, 30, f.w === s.id ? '#5dfc8d' : '#fff');
      if ((f.ph === 'show' || f.ph === 'done') && f.w === s.id) hudText(g, ':crown:', x, y - 190, 48);
    });
    fx.draw(g);
  },

  hud(g, f, { lang }, W) {
    hudText(g, `${lang === 'he' ? 'סבב' : 'Round'} ${f.round}/${f.rounds}`, W / 2, 44, 34);
  },

  event(e, _f, { fx }) {
    switch (e.k) {
      case 'go': sfx.go(); fx.blink('#5dfc8d', 0.5); break;
      case 'fake': sfx.bad(); break;
      case 'early': sfx.bad(); fx.kick(6); break;
      case 'tap': sfx.click(); break;
      case 'win': sfx.coin(); break;
    }
  },
};
