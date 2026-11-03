import { KITCHEN, RECIPES, STATIONS, type StationDef } from '../../../shared/kitchen';
import { sfx } from '../sound';
import { drawCritter, nameTag } from './critter';
import { hudText, type Renderer } from './types';

function item(g: CanvasRenderingContext2D, code: string, x: number, y: number, s = 1) {
  const [k, st] = code.split('.');
  g.save(); g.translate(x, y); g.scale(s, s); g.lineWidth = 3; g.strokeStyle = '#1d2540'; g.lineJoin = 'round';
  switch (k) {
    case 'bun':
      g.fillStyle = '#e8b36a'; g.beginPath(); g.ellipse(0, 3, 21, 14, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#f6cf8c'; g.beginPath(); g.ellipse(0, -2, 17, 8, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = '#fff3d6'; for (const dx of [-8, 0, 8]) { g.beginPath(); g.ellipse(dx, -6, 2.4, 1.4, 0.3, 0, Math.PI * 2); g.fill(); } break;
    case 'patty':
      g.fillStyle = st === 'r' ? '#e07a8a' : st === 'k' ? '#7a4426' : '#17151a'; g.beginPath(); g.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      if (st === 'k') { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(dx - 3, -6); g.lineTo(dx + 3, 6); g.stroke(); } }
      break;
    case 'tomato':
      if (st === 'r') { g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(0, 2, 17, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#3cb85a'; g.beginPath(); g.moveTo(-8, -12); g.lineTo(0, -6); g.lineTo(8, -12); g.lineTo(0, -16); g.closePath(); g.fill(); }
      else for (const dx of [-9, 9]) { g.fillStyle = '#ff6b6b'; g.beginPath(); g.arc(dx, 2, 11, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#ffd1d1'; g.beginPath(); g.arc(dx, 2, 5, 0, Math.PI * 2); g.fill(); }
      break;
    case 'lettuce':
      g.fillStyle = st === 'r' ? '#4ecb62' : '#9be37a';
      if (st === 'r') { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.lineTo(Math.cos(a) * (i % 2 ? 14 : 19), Math.sin(a) * (i % 2 ? 14 : 19)); } g.closePath(); g.fill(); g.stroke(); }
      else for (const [dx, dy] of [[-9, 0], [8, -3], [2, 8]]) { g.beginPath(); g.ellipse(dx, dy, 9, 5, 0.6, 0, Math.PI * 2); g.fill(); g.stroke(); }
      break;
  }
  g.restore();
}

function plate(g: CanvasRenderingContext2D, items: string[], x: number, y: number, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#fff'; g.strokeStyle = '#1d2540'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = '#cbd5e1'; g.beginPath(); g.ellipse(0, 0, 21, 13, 0, 0, Math.PI * 2); g.stroke();
  items.forEach((c, i) => item(g, c, (i - (items.length - 1) / 2) * 15, -4 - i * 3, 0.62));
  g.restore();
}

function draw(g: CanvasRenderingContext2D, code: string, x: number, y: number, s = 1) {
  if (code.startsWith('plate:')) plate(g, code.slice(6).split(',').filter(Boolean), x, y, s); else if (code) item(g, code, x, y, s);
}

function station(g: CanvasRenderingContext2D, d: StationDef, x: number, y: number, t: number, cooking: boolean) {
  const w = d.w, h = d.h;
  const col = d.kind === 'crate' ? '#c98a4b' : d.kind === 'board' ? '#e0b070' : d.kind === 'stove' ? '#3a3f55' : d.kind === 'serve' ? '#3bbf77' : d.kind === 'trash' ? '#5b6b88' : d.kind === 'plates' ? '#e8eef7' : '#aeb9cc';
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.roundRect(x + 4, y + 10, w, h, 14); g.fill();
  g.fillStyle = col; g.strokeStyle = '#1d2540'; g.lineWidth = 4; g.beginPath(); g.roundRect(x, y, w, h, 14); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.roundRect(x + 6, y + 6, w - 12, 12, 6); g.fill();
  const cx = x + w / 2, cy = y + h / 2 + 4;
  if (d.kind === 'crate') { item(g, `${d.crate}.r`, cx, cy, 1.15); }
  else if (d.kind === 'board') { g.strokeStyle = '#7a4a1a'; g.lineWidth = 3; g.strokeRect(x + 12, y + 18, w - 24, h - 28); g.fillStyle = '#9aa4b5'; g.fillRect(x + w - 34, y + h - 26, 20, 6); }
  else if (d.kind === 'stove') { for (const dx of [-26, 26]) { g.strokeStyle = cooking ? '#ff7a2f' : '#8892a8'; g.lineWidth = 5; g.beginPath(); g.arc(cx + dx, cy, 17, 0, Math.PI * 2); g.stroke(); } if (cooking) { g.fillStyle = `rgba(255,${120 + Math.sin(t * 20) * 40},40,.8)`; g.beginPath(); g.arc(cx, cy - 4, 6, 0, Math.PI * 2); g.fill(); } }
  else if (d.kind === 'plates') { for (let i = 0; i < 3; i++) { g.fillStyle = '#fff'; g.strokeStyle = '#1d2540'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy + 8 - i * 7, 30, 15, 0, 0, Math.PI * 2); g.fill(); g.stroke(); } }
  else if (d.kind === 'serve') { hudText(g, '✓', cx, cy - 18, 44, '#fff'); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(cx, cy + 34, 12, Math.PI, 0); g.fill(); g.stroke(); }
  else if (d.kind === 'trash') { g.fillStyle = '#2b3550'; g.fillRect(cx - 22, cy - 18, 44, 40); g.strokeStyle = '#1d2540'; g.strokeRect(cx - 22, cy - 18, 44, 40); g.fillStyle = '#2b3550'; g.fillRect(cx - 28, cy - 24, 56, 8); }
}

const bar = (g: CanvasRenderingContext2D, x: number, y: number, w: number, k: number, c: string) => {
  g.fillStyle = 'rgba(10,5,30,.7)'; g.beginPath(); g.roundRect(x - w / 2, y, w, 10, 5); g.fill();
  g.fillStyle = c; g.beginPath(); g.roundRect(x - w / 2, y, Math.max(8, w * Math.min(1, k)), 10, 5); g.fill();
};

export const kitchenRenderer: Renderer = {
  world: { x: 0, y: -90, w: KITCHEN.W, h: KITCHEN.H + 90 }, // headroom above the kitchen for score, clock and order tickets
  background(g, W, H) { g.fillStyle = '#26314f'; g.fillRect(0, 0, W, H); },

  draw(g, f, { players, t, lang, fx }) {
    g.fillStyle = '#26314f'; g.fillRect(-20, -100, KITCHEN.W + 40, 100);
    for (let x = 0; x < KITCHEN.W; x += 80) for (let y = 0; y < KITCHEN.H; y += 80) { g.fillStyle = (x / 80 + y / 80) % 2 ? '#e7ecf5' : '#d7deec'; g.fillRect(x, y, 80, 80); }
    g.strokeStyle = '#1d2540'; g.lineWidth = 10; g.strokeRect(0, 0, KITCHEN.W, KITCHEN.H);
    const content = new Map<string, [string, string, number]>(f.c.map((c: any) => [c[0], c]));
    for (const d of STATIONS) {
      const [x, y] = d.pos[f.lo];
      const c = content.get(d.id);
      station(g, d, x, y, t, d.kind === 'stove' && !!c && c[1] === 'patty.r');
      if (c) {
        draw(g, c[1], x + d.w / 2, y + d.h / 2 - (d.kind === 'stove' ? 0 : 2), d.kind === 'counter' ? 1 : 1.1);
        const code = c[1];
        if (d.kind === 'board' && code.endsWith('.r')) bar(g, x + d.w / 2, y + d.h - 16, 80, c[2], '#3ec1ff');
        if (d.kind === 'stove' && code === 'patty.r') bar(g, x + d.w / 2, y - 16, 90, c[2], c[2] > 0.7 ? '#ff7a2f' : '#ffd23f');
        if (d.kind === 'stove' && code === 'patty.k') { const k = (c[2] - 1) / (KITCHEN.BURN_TIME / KITCHEN.COOK_TIME); bar(g, x + d.w / 2, y - 16, 90, k, '#ff4d6d'); if (k > 0.55) hudText(g, '!', x + d.w / 2, y - 34, 30, '#ff4d6d'); }
      }
    }
    const sorted = [...f.p].sort((a: any, b: any) => a.y - b.y);
    for (const p of sorted) {
      const info = players.get(p.id);
      if (!info) continue;
      drawCritter(g, p.x, p.y, 25, info.color, info.avatar, { look: p.a, t, squash: p.w ? 0.3 + Math.sin(t * 25) * 0.15 : 0 });
      if (p.h) { g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(p.x, p.y - 58, 26, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#1d2540'; g.lineWidth = 3; g.stroke(); draw(g, p.h, p.x, p.y - 56, 0.8); }
      nameTag(g, p.x, p.y + 44, info.name, info.color, 14);
    }
    fx.draw(g);
    void lang;
  },

  hud(g, f, { lang }, W, H) {
    hudText(g, `${f.sc}`, 70, 44, 54, '#ffd23f', 'left');
    hudText(g, `${Math.floor(f.left / 60)}:${String(f.left % 60).padStart(2, '0')}`, W / 2, 44, 44, f.left <= 20 ? '#ff4d6d' : '#fff');
    // order tickets
    f.o.forEach((o: any, i: number) => {
      const r = RECIPES.find((x) => x.id === o.r)!, x = W - 36 - (i + 1) * 150, y = 10;
      const k = o.t / 80;
      g.fillStyle = '#fffdf5'; g.strokeStyle = k < 0.25 ? '#ff4d6d' : '#1d2540'; g.lineWidth = 4; g.beginPath(); g.roundRect(x, y, 140, 82, 10); g.fill(); g.stroke();
      r.items.forEach((c, j) => item(g, c, x + 24 + j * 36, y + 30, 0.7));
      hudText(g, r.name[lang === 'he' ? 'he' : 'en'], x + 70, y + 66, 17, '#1d2540');
      bar(g, x + 70, y + 76, 120, k, k < 0.25 ? '#ff4d6d' : k < 0.5 ? '#ffd23f' : '#5dfc8d');
    });
    if (f.t > f.tot / 2 && f.t < f.tot / 2 + 3) hudText(g, lang === 'he' ? 'המטבח התחלף!' : 'KITCHEN SHUFFLE!', W / 2, H / 2, 90, '#ffd23f');
  },

  event(e, f, { players, fx }) {
    const me = (id: string) => f.p.find((p: any) => p.id === id);
    switch (e.k) {
      case 'take': sfx.pass(); break;
      case 'put': sfx.click(); break;
      case 'chopped': sfx.coin(); break;
      case 'cooked': sfx.power(); break;
      case 'almost': sfx.tick(); break;
      case 'burnt': sfx.boom(); fx.kick(8); break;
      case 'trash': sfx.bad(); break;
      case 'serve': { const p = me(e.id); if (p) { fx.burst(p.x, p.y - 30, '#ffd23f', 30, 400, 7); fx.text(p.x, p.y - 90, `+${e.pts}`, '#ffd23f', 44); } sfx.win(); break; }
      case 'wrong': sfx.bad(); fx.kick(4); break;
      case 'order': sfx.join(); break;
      case 'late': sfx.bad(); fx.kick(6); break;
      case 'shuffle': sfx.go(); fx.kick(14); fx.blink('#fff', 0.5); break;
    }
    void players;
  },
};
