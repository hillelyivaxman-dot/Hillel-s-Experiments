import { BOWL, PINS } from '../../../shared/minigames';
import { sfx } from '../sound';
import { bar, circle, gradBg, scoreboard, who } from './kit';
import { hudText, type Renderer } from './types';

export const basketballRenderer: Renderer = {
  world: { x: 0, y: 0, w: 1200, h: 700 },
  background(g, w, h) { gradBg(g, w, h, '#1b1450', '#4a1d6e'); },
  draw(g, f, { players, t, fx }) {
    // gym floor + crowd
    g.fillStyle = '#c98a4b'; g.fillRect(0, 590, 1200, 110);
    g.fillStyle = 'rgba(255,255,255,.25)'; for (let x = 0; x < 1200; x += 100) g.fillRect(x, 590, 3, 110);
    g.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(30 + i * 30, 150 + Math.sin(t * 3 + i) * 6, 14, 0, 7); g.fill(); }
    // hoop
    g.fillStyle = '#fff'; g.strokeStyle = '#120a2a'; g.lineWidth = 5; g.beginPath(); g.roundRect(1070, 150, 22, 190, 6); g.fill(); g.stroke();
    g.strokeStyle = '#ff6b3c'; g.lineWidth = 9; g.beginPath(); g.moveTo(1070, 300); g.lineTo(985, 300); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(988 + i * 14, 303); g.lineTo(996 + i * 11, 360); g.stroke(); }
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      who(g, info, p.x, 540, 36, t);
      if (p.ch >= 0) { // power meter
        const x = p.x - 60, y = 430;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(x, y, 120, 18, 9); g.fill();
        g.fillStyle = '#5dfc8d'; g.fillRect(x + (p.tg - p.w) * 120, y + 2, p.w * 240, 14);
        g.fillStyle = '#fff'; g.fillRect(x + p.ch * 120 - 3, y - 4, 6, 26);
      }
      if (p.sh >= 0) { // ball flight (arc to the hoop; misses bounce off the rim)
        const k = p.sh, sx = p.x + 20, sy = 500, ex = p.ok ? 1010 : 1040 + 40, ey = p.ok ? 310 : 280;
        const bx = sx + (ex - sx) * k, by = sy + (ey - sy) * k - Math.sin(k * Math.PI) * 260;
        circle(g, bx, by, 18, '#ff8c42'); g.strokeStyle = '#7a2e0b'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx - 18, by); g.lineTo(bx + 18, by); g.stroke();
      }
      hudText(g, String(p.s), p.x, 610, 24, info.color);
    }
    fx.draw(g);
  },
  hud(g, f, { players }, W) {
    hudText(g, `${f.left}s`, W / 2, 44, 52, '#ffd23f');
    scoreboard(g, [...f.p].sort((a: any, b: any) => b.s - a.s).map((p: any) => ({ id: p.id, v: p.s })), players, W, hudText);
  },
  event(e, f, { fx, players }) {
    const p = f.p.find((q: any) => q.id === e.id); const col = players.get(e.id)?.color ?? '#fff';
    if (e.k === 'swish' && p) { fx.text(1010, 250, `+${e.pts}`, '#5dfc8d', 60); fx.burst(1010, 310, col, 24, 300, 6); sfx.coin(); }
    if (e.k === 'miss') sfx.bump();
    if (e.k === 'shoot') sfx.pass();
  },
};

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
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; g.setLineDash([10, 12]); g.beginPath(); g.moveTo(cx + f.aim * 110, bot - 20); g.lineTo(cx + f.aim * 110, top + 120); g.stroke(); g.setLineDash([]);
      circle(g, cx + f.aim * 110, bot - 20, BOWL.BALL_R, cur?.color ?? '#3ec1ff');
    } else if (f.ph === 'roll' || f.ph === 'pause') {
      const k = f.ph === 'pause' ? 1 : f.by;
      const bx = cx + (x0 + (x1 - x0) * k) * 1.1, by = bot - 20 - (bot - 20 - (top + 120)) * k;
      if (k < 1) circle(g, bx, by, BOWL.BALL_R * (1 - k * 0.25), cur?.color ?? '#3ec1ff');
    }
    if (f.ph === 'power') { bar(g, 1020, 140, 36, 420, f.pw, f.pw > 0.65 && f.pw < 0.92 ? '#5dfc8d' : '#ffd23f'); hudText(g, 'POWER', 1038, 120, 22); }
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
