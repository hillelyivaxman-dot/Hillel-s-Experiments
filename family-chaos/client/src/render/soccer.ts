import { SOCCER } from '../../../shared/soccer';
import { sfx } from '../sound';
import { drawCritter, nameTag } from './critter';
import { hudText, type Renderer } from './types';

const TEAM = ['#ff4d6d', '#3ec1ff'];
const { HW, HH, GOAL_HALF, GOAL_DEPTH } = SOCCER;

function pitch(g: CanvasRenderingContext2D) {
  // mowing stripes
  for (let i = 0; i < 12; i++) {
    g.fillStyle = i % 2 ? '#2e9e52' : '#35b05b';
    g.fillRect(-HW + (i * 2 * HW) / 12, -HH, (2 * HW) / 12, 2 * HH);
  }
  g.strokeStyle = 'rgba(255,255,255,.9)';
  g.lineWidth = 5;
  g.strokeRect(-HW, -HH, 2 * HW, 2 * HH);
  g.beginPath(); g.moveTo(0, -HH); g.lineTo(0, HH); g.stroke();
  g.beginPath(); g.arc(0, 0, 95, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    g.strokeRect(s < 0 ? -HW : HW - 170, -200, 170, 400);
    g.strokeRect(s < 0 ? -HW : HW - 70, -GOAL_HALF - 20, 70, 2 * GOAL_HALF + 40);
  }
}

function goalNet(g: CanvasRenderingContext2D, side: -1 | 1, color: string, t: number) {
  const x0 = side * HW, x1 = side * (HW + GOAL_DEPTH);
  g.fillStyle = 'rgba(10,5,30,.55)';
  g.fillRect(Math.min(x0, x1), -GOAL_HALF, GOAL_DEPTH, 2 * GOAL_HALF);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
  for (let y = -GOAL_HALF; y <= GOAL_HALF; y += 16) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  for (let k = 0; k <= GOAL_DEPTH; k += 14) { g.beginPath(); g.moveTo(x0 + side * k, -GOAL_HALF); g.lineTo(x0 + side * k, GOAL_HALF); g.stroke(); }
  g.strokeStyle = color; g.lineWidth = 8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, -GOAL_HALF); g.lineTo(x1, -GOAL_HALF); g.lineTo(x1, GOAL_HALF); g.lineTo(x0, GOAL_HALF); g.stroke();
  g.fillStyle = '#fff';
  for (const sy of [-1, 1]) { g.beginPath(); g.arc(x0, sy * GOAL_HALF, 10 + Math.sin(t * 4) * 0, 0, Math.PI * 2); g.fill(); }
}

export const soccerRenderer: Renderer = {
  world: { x: -HW - GOAL_DEPTH - 40, y: -HH - 40, w: 2 * (HW + GOAL_DEPTH + 40), h: 2 * HH + 80 },
  background(g, W, H) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0f3d2a'); gr.addColorStop(1, '#072015');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  },

  draw(g, f, { players, t, fx }) {
    pitch(g);
    goalNet(g, -1, TEAM[0], t);
    goalNet(g, 1, TEAM[1], t);
    const ball = f.b[0];
    // ball shadow + ball
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(ball.x + 4, ball.y + 12, 16, 7, 0, 0, Math.PI * 2); g.fill();
    const spin = (ball.x + ball.y) / 18;
    g.save(); g.translate(ball.x, ball.y - 4); g.rotate(spin);
    g.fillStyle = '#fff'; g.strokeStyle = '#1d2540'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#1d2540';
    g.beginPath(); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); } g.closePath(); g.fill();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.arc(Math.cos(a) * 15, Math.sin(a) * 15, 3.5, 0, Math.PI * 2); g.fill(); }
    g.restore();

    const sorted = [...f.p].sort((a: any, b: any) => a.y - b.y);
    for (const p of sorted) {
      const info = players.get(p.id);
      if (!info) continue;
      g.strokeStyle = TEAM[p.tm]; g.lineWidth = 6;
      g.beginPath(); g.ellipse(p.x, p.y + 24, 32, 13, 0, 0, Math.PI * 2); g.stroke();
      if (p.s) { g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(p.x - Math.cos(p.a) * 22 * k, p.y + 20, 8 - k * 1.5, 0, Math.PI * 2); g.fill(); } }
      drawCritter(g, p.x, p.y, 27, info.color, info.avatar, { look: p.a, t, squash: p.k ? 0.5 : 0 });
      if (p.k) { // kick swoosh
        g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.lineCap = 'round';
        g.beginPath(); g.arc(p.x, p.y, 44, p.a - 0.7, p.a + 0.7); g.stroke();
      }
      nameTag(g, p.x, p.y - 46, info.name, TEAM[p.tm], 15);
    }
    fx.draw(g);
  },

  hud(g, f, { players, lang }, W, H) {
    const cx = W / 2;
    g.fillStyle = 'rgba(10,5,30,.72)';
    g.beginPath(); g.roundRect(cx - 190, 12, 380, 74, 22); g.fill();
    hudText(g, `${f.sc[0]}`, cx - 120, 50, 54, TEAM[0]);
    hudText(g, `${f.sc[1]}`, cx + 120, 50, 54, TEAM[1]);
    const m = Math.floor(f.left / 60), s = String(f.left % 60).padStart(2, '0');
    hudText(g, f.ot ? (lang === 'he' ? 'גול הזהב!' : 'GOLDEN GOAL') : `${m}:${s}`, cx, 50, f.ot ? 30 : 38, f.ot ? '#ffd23f' : f.left <= 10 ? '#ff4d6d' : '#fff');
    if (f.cel) {
      const who = f.ls ? players.get(f.ls)?.name : '';
      hudText(g, lang === 'he' ? 'גוווול!' : 'GOAL!', cx, H / 2 - 20, 120, '#ffd23f');
      if (who) hudText(g, who, cx, H / 2 + 60, 44, '#fff');
    }
  },

  event(e, f, { players, fx }) {
    switch (e.k) {
      case 'pass': fx.burst(e.x, e.y, '#5dfc8d', 10, 220, 5); sfx.pass(); break;
      case 'kick': fx.burst(e.x, e.y, '#fff', 8, 260, 5); sfx.bump(); break;
      case 'touch': sfx.click(); break;
      case 'post': fx.burst(e.x, e.y, '#fff', 10, 300, 5); fx.kick(5); sfx.bump(); break;
      case 'swing': sfx.dash(); break;
      case 'goal': {
        const c = ['#ff4d6d', '#3ec1ff'][e.team];
        fx.burst(e.x, 0, c, 70, 600, 9, 200); fx.burst(e.x, 0, '#ffd23f', 50, 450, 7, 200);
        fx.kick(16); fx.blink('#fff', 0.5); sfx.win();
        fx.text(0, -40, 'GOAL!', c, 120);
        void f; void players;
        break;
      }
      case 'overtime': sfx.go(); break;
    }
  },
};
