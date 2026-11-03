import { BBALL, preview } from '../../../shared/basketball';
import { BOWL, PINS } from '../../../shared/minigames';
import { sfx } from '../sound';
import { bar, circle, gradBg, who } from './kit';
import { hudText, type Renderer } from './types';

export const basketballRenderer: Renderer = {
  world: { x: 0, y: 0, w: 1200, h: 700 },
  background(g, w, h) { gradBg(g, w, h, '#1b1450', '#3a1a66'); },
  draw(g, f, { players, t, fx }) {
    const n = f.p.length, cols = Math.min(4, Math.max(1, n)), rows = Math.ceil(n / cols);
    const cw = 1200 / cols, ch = 640 / rows, sc = Math.min((cw - 16) / BBALL.LW, (ch - 16) / BBALL.LH);
    f.p.forEach((p: any, i: number) => {
      const info = players.get(p.id); if (!info) return;
      const ox = (i % cols) * cw + (cw - BBALL.LW * sc) / 2, oy = 52 + Math.floor(i / cols) * ch + (ch - BBALL.LH * sc) / 2;
      g.save(); g.translate(ox, oy); g.scale(sc, sc);
      g.save(); g.beginPath(); g.roundRect(0, 0, BBALL.LW, BBALL.LH, 22); g.clip();
      const sky = g.createLinearGradient(0, 0, 0, BBALL.LH); sky.addColorStop(0, '#2c2170'); sky.addColorStop(1, '#6a2a8a'); g.fillStyle = sky; g.fillRect(0, 0, BBALL.LW, BBALL.LH);
      g.fillStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(14 + k * 30, 60 + Math.sin(t * 2 + k + i) * 4 + (k % 3) * 12, 11, 0, 7); g.fill(); } // crowd
      g.fillStyle = '#d29a58'; g.fillRect(0, BBALL.FLOOR, BBALL.LW, BBALL.LH - BBALL.FLOOR); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, BBALL.FLOOR, BBALL.LW, 3);
      // hoop: pole, backboard, rim, net
      const hx = p.hx, hy = p.hy, bx = hx + BBALL.RIM_HALF + 12;
      g.fillStyle = '#4b5563'; g.fillRect(bx + 18, hy - 20, 8, BBALL.FLOOR - hy + 20);
      g.fillStyle = '#f8fafc'; g.strokeStyle = '#111827'; g.lineWidth = 3; g.beginPath(); g.roundRect(bx, hy - BBALL.BOARD_H + 18, BBALL.BOARD_W, BBALL.BOARD_H, 4); g.fill(); g.stroke();
      g.strokeStyle = '#ef4444'; g.lineWidth = 3; g.strokeRect(bx + 1, hy - 24, BBALL.BOARD_W - 2, 22);
      const sway = p.nt ? Math.sin(t * 30) * 5 : 0;
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2;
      for (let k = 0; k <= 4; k++) { const x0 = hx - BBALL.RIM_HALF + (k * BBALL.RIM_HALF * 2) / 4; g.beginPath(); g.moveTo(x0, hy); g.lineTo(hx - 14 + (k * 28) / 4 + sway, hy + 34 + (p.nt ? 6 : 0)); g.stroke(); }
      for (let k = 1; k <= 3; k++) { const yy = hy + k * 10; g.beginPath(); g.moveTo(hx - 26 + k * 3 + sway * (k / 3), yy); g.lineTo(hx + 26 - k * 3 + sway * (k / 3), yy); g.stroke(); }
      g.strokeStyle = '#ff6b3c'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx - BBALL.RIM_HALF, hy); g.lineTo(hx + BBALL.RIM_HALF, hy); g.stroke();
      // shooter + aim preview
      who(g, info, 36, BBALL.FLOOR - 26, 26, t, { tag: false });
      const m = Math.hypot(p.ax, p.ay);
      if (m > 0.2) {
        const pts = preview(p.ax, p.ay);
        g.fillStyle = 'rgba(255,255,255,.85)';
        pts.forEach(([x, y], k) => { if (y < BBALL.FLOOR) { g.globalAlpha = 1 - k / 28; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } });
        g.globalAlpha = 1;
        bar(g, 14, BBALL.LH - 20, 120, 8, m, m > 0.85 ? '#ff6b3c' : '#5dfc8d');
      }
      if (!f.bl.some((b: any) => b.id === p.id)) { circle(g, BBALL.SX, BBALL.SY, 12, '#ff8c42'); }
      g.restore();
      g.strokeStyle = info.color; g.lineWidth = 4 / sc; g.beginPath(); g.roundRect(0, 0, BBALL.LW, BBALL.LH, 22); g.stroke();
      const ball = f.bl.find((b: any) => b.id === p.id);
      if (ball) { g.save(); g.beginPath(); g.rect(-20, -60, BBALL.LW + 40, BBALL.LH + 60); g.clip(); circle(g, ball.x, ball.y, BBALL.BR, '#ff8c42', '#7a2e0b', 2.5); g.strokeStyle = '#7a2e0b'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ball.x - 12, ball.y); g.lineTo(ball.x + 12, ball.y); g.moveTo(ball.x, ball.y - 12); g.lineTo(ball.x, ball.y + 12); g.stroke(); g.restore(); }
      g.restore();
      hudText(g, `${info.name}  ${p.s}`, ox + (BBALL.LW * sc) / 2, oy - 14, 24, info.color);
      if (p.st >= 3) { g.save(); g.translate(ox + BBALL.LW * sc - 26, oy + 24); flame(g, t, 16); g.restore(); }
    });
    fx.draw(g);
  },
  hud(g, f, { players }, W) {
    hudText(g, `${f.left}s`, W / 2, 30, 46, '#ffd23f');
    void players;
  },
  event(e, f, { fx, players }) {
    const i = f.p.findIndex((q: any) => q.id === e.id); if (i < 0) return;
    const col = players.get(e.id)?.color ?? '#fff';
    const n = f.p.length, cols = Math.min(4, Math.max(1, n)), rows = Math.ceil(n / cols), cw = 1200 / cols, ch = 640 / rows, sc = Math.min((cw - 16) / BBALL.LW, (ch - 16) / BBALL.LH);
    const ox = (i % cols) * cw + (cw - BBALL.LW * sc) / 2, oy = 52 + Math.floor(i / cols) * ch + (ch - BBALL.LH * sc) / 2;
    const P = f.p[i];
    if (e.k === 'basket') { fx.text(ox + P.hx * sc, oy + (P.hy - 40) * sc, e.swish ? `SWISH +${e.pts}` : `+${e.pts}`, e.swish ? '#5dfc8d' : '#ffd23f', 40); fx.burst(ox + P.hx * sc, oy + P.hy * sc, col, 22, 300, 6); sfx.coin(); if (e.streak >= 3) sfx.win(); }
    else if (e.k === 'rim') { fx.burst(ox + P.hx * sc, oy + P.hy * sc, '#ff6b3c', 5, 160, 3); sfx.tick(); }
    else if (e.k === 'board') sfx.click();
    else if (e.k === 'shoot') sfx.pass();
    else if (e.k === 'miss') sfx.bump();
  },
};

/** Little fire icon (drawn, no emoji): shown next to a player who is on a streak. */
export function flame(g: CanvasRenderingContext2D, t: number, r: number) {
  g.save(); g.scale(1 + Math.sin(t * 12) * 0.06, 1 + Math.sin(t * 9) * 0.08);
  g.fillStyle = '#ff6b3c'; g.beginPath(); g.moveTo(0, -r * 1.5); g.bezierCurveTo(r * 1.2, -r * 0.4, r * 1.2, r * 0.9, 0, r); g.bezierCurveTo(-r * 1.2, r * 0.9, -r * 1.2, -r * 0.4, 0, -r * 1.5); g.fill();
  g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(0, -r * 0.4); g.bezierCurveTo(r * 0.7, r * 0.1, r * 0.6, r * 0.8, 0, r * 0.85); g.bezierCurveTo(-r * 0.6, r * 0.8, -r * 0.7, r * 0.1, 0, -r * 0.4); g.fill();
  g.restore();
}

export const bowlingRenderer: Renderer = {
  world: { x: 0, y: 0, w: 1200, h: 700 },
  background(g, w, h) { gradBg(g, w, h, '#16103a', '#2b0f4d'); },
  draw(g, f, { players, t, fx }) {
    // lane (perspective-free, drawn vertically in the middle)
    const cx = 600, top = 80, bot = 640;
    g.fillStyle = '#d9a35c'; g.beginPath(); g.roundRect(cx - 170, top - 20, 340, bot - top + 60, 18); g.fill();
    g.strokeStyle = '#120a2a'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#2a1a3a'; g.fillRect(cx - 200, top - 20, 30, bot - top + 60); g.fillRect(cx + 170, top - 20, 30, bot - top + 60);
    g.strokeStyle = 'rgba(120,60,10,.35)'; g.lineWidth = 2; for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(cx + i * 36, top); g.lineTo(cx + i * 36, bot); g.stroke(); }
    const rolling = f.an && f.ph === 'roll';
    PINS.forEach((pin, i) => {
      const standing = f.pin[i] === '1' || (rolling && f.by < 0.75 && f.an.hits.includes(i)) || (f.ph === 'roll' && false);
      const px = cx + pin.x * 1.1, py = top + 40 + (130 - pin.y) * 0.9;
      if (standing) { circle(g, px, py + 6, 11, 'rgba(0,0,0,.25)', ''); g.fillStyle = '#fff'; g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.beginPath(); g.ellipse(px, py - 4, 11, 17, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#ff4d6d'; g.fillRect(px - 9, py - 12, 18, 4); }
      else if (f.an && f.an.hits.includes(i)) { const k = Math.min(1, (f.by - 0.7) * 4); g.save(); g.globalAlpha = Math.max(0, 1 - (f.ph === 'pause' ? 1 : k) * 0.7); g.translate(px + (pin.x > 0 ? 1 : -1) * 40, py + 10); g.rotate(1.4); g.fillStyle = '#fff'; g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 11, 17, 0, 0, 7); g.fill(); g.stroke(); g.restore(); }
    });
    const cur = players.get(f.turn);
    const x0 = (f.ph === 'aim' || f.ph === 'power' ? f.aim * 100 : f.an ? f.an.x0 : 0), x1 = f.an ? f.an.x1 : x0;
    if (f.ph === 'aim' || f.ph === 'power') { // aim arrow + ball at the foul line
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; g.setLineDash([10, 12]); g.beginPath(); g.moveTo(cx + f.aim * 110, bot - 20); g.quadraticCurveTo(cx + f.aim * 110, (bot + top) / 2, cx + f.aim * 110 + (f.ph === 'power' ? f.hk * 110 : 0), top + 120); g.stroke(); g.setLineDash([]);
      circle(g, cx + f.aim * 110, bot - 20, BOWL.BALL_R, cur?.color ?? '#3ec1ff');
    } else if (f.ph === 'roll' || f.ph === 'pause') {
      const k = f.ph === 'pause' ? 1 : f.by;
      const bx = cx + (x0 + (x1 - x0) * k) * 1.1, by = bot - 20 - (bot - 20 - (top + 120)) * k;
      if (k < 1) circle(g, bx, by, BOWL.BALL_R * (1 - k * 0.25), cur?.color ?? '#3ec1ff');
    }
    if (f.ph === 'power') { bar(g, 1020, 140, 36, 420, f.pw, f.pw > 0.65 ? '#5dfc8d' : '#ffd23f'); hudText(g, 'POWER', 1038, 120, 22); hudText(g, '◀ HOOK ▶', cx, 676, 24, '#ffd23f'); }
    if (cur) who(g, cur, 330, 560, 44, t);
    f.p.forEach((p: any, i: number) => { const info = players.get(p.id); if (info) { hudText(g, `${p.s}`, 70, 120 + i * 62, 40, info.color, 'left'); hudText(g, `${info.name} ${p.f}`, 150, 120 + i * 62, 22, info.color, 'left'); } });
    fx.draw(g);
  },
  hud(g, f, { players, lang }, W) {
    const cur = players.get(f.turn);
    if (cur) hudText(g, `${lang === 'he' ? 'תור של' : 'Turn:'} ${cur.name}  ·  ${lang === 'he' ? 'סבב' : 'Frame'} ${f.fr}/${f.frs}`, W / 2, 44, 36, cur.color);
  },
  event(e, _f, { fx }) {
    if (e.k === 'strike') { fx.text(600, 300, 'STRIKE!', '#ffd23f', 90); fx.burst(600, 200, '#fff', 40, 500, 7); fx.kick(10); sfx.win(); }
    else if (e.k === 'pins') { fx.text(600, 300, `${e.n}`, '#5dfc8d', 70); fx.kick(5); sfx.bump(); }
    else if (e.k === 'gutter') { fx.text(600, 300, 'GUTTER', '#ff4d6d', 60); sfx.bad(); }
    else if (e.k === 'roll') sfx.dash();
  },
};
