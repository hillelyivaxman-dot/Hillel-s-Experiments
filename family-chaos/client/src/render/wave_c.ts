import { ARENA } from '../../../shared/minigames';
import { MAZE_GEOM } from '../../../shared/mazegeom';
import { sfx } from '../sound';
import { circle, emoji, gradBg, ring, scoreboard, who } from './kit';
import { hudText, type Renderer } from './types';

const world = { x: -20, y: -20, w: ARENA.W + 40, h: ARENA.H + 40 };
const W = ARENA.W, H = ARENA.H;

const mazeCache = new Map<string, Path2D>();
export const mazeRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#14123a', '#07061c'); },
  draw(g, f, { players, t, fx }) {
    const { COLS, ROWS, CELL, OX, OY, WALL } = MAZE_GEOM;
    g.fillStyle = '#231d52'; g.fillRect(OX, OY, COLS * CELL, ROWS * CELL);
    let path = mazeCache.get(f.mz);
    if (!path) {
      path = new Path2D(); const open = (f.mz as string).split(',').map(Number);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const m = open[y * COLS + x], px = OX + x * CELL, py = OY + y * CELL;
        if (!(m & 1)) path.rect(px - WALL / 2, py - WALL / 2, CELL + WALL, WALL);
        if (!(m & 8)) path.rect(px - WALL / 2, py - WALL / 2, WALL, CELL + WALL);
        if (y === ROWS - 1) path.rect(px - WALL / 2, py + CELL - WALL / 2, CELL + WALL, WALL);
        if (x === COLS - 1) path.rect(px + CELL - WALL / 2, py - WALL / 2, WALL, CELL + WALL);
      }
      if (mazeCache.size > 6) mazeCache.clear();
      mazeCache.set(f.mz, path);
    }
    g.fillStyle = '#8b7bff'; g.fill(path);
    ring(g, f.ex.x, f.ex.y, 26 + Math.sin(t * 5) * 3, '#5dfc8d', 6); emoji(g, '🚪', f.ex.x, f.ex.y, 30);
    for (const p of f.p) { const info = players.get(p.id); if (info && !p.d) who(g, info, p.x, p.y, 16, t, { tag: false }); }
    fx.draw(g);
  },
  hud(g, f, { players, lang }, Wd) {
    hudText(g, `${lang === 'he' ? 'סבב' : 'Round'} ${f.round}/${f.rounds}`, Wd / 2, 22, 30, '#ffd23f');
    scoreboard(g, [...f.p].sort((a: any, b: any) => b.pts - a.pts).map((p: any) => ({ id: p.id, v: `${p.pts}${p.d ? ' ✓' : ''}` })), players, Wd, hudText, false);
  },
  event(e, _f, { fx }) { if (e.k === 'exit') { fx.text(e.x ?? 1000, 560, `+${e.pts}`, '#5dfc8d', 60); sfx.win(); } else if (e.k === 'dash') sfx.dash(); else if (e.k === 'newmaze') sfx.go(); },
};

export const rescueRenderer: Renderer = {
  world,
  background(g, w, h, t) { gradBg(g, w, h, '#0b1040', '#020312'); g.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t + i)); g.fillRect((i * 97) % w, (i * 57) % h, 2, 2); } g.globalAlpha = 1; },
  draw(g, f, { players, t, fx }) {
    const b = f.base; circle(g, b.x, b.y, b.r, 'rgba(94,234,212,.15)', '#5eead4', 5); emoji(g, '🛰️', b.x, b.y, 60);
    for (const [rx, ry, rr] of f.r) { g.fillStyle = '#6b5b73'; g.strokeStyle = '#120a2a'; g.lineWidth = 4; g.beginPath(); g.arc(rx, ry, rr, 0, 7); g.fill(); g.stroke(); circle(g, rx - rr * 0.3, ry - rr * 0.2, rr * 0.22, 'rgba(0,0,0,.25)', '', 0); }
    for (const [ax, ay, ac, aid] of f.a) { emoji(g, '🧑‍🚀', ax, ay + Math.sin(t * 2 + aid) * 4, ac ? 24 : 34); }
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      if (p.bo) { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(p.x - 28, p.y, 14 + Math.random() * 6, 0, 7); g.fill(); }
      g.globalAlpha = p.st ? 0.5 + 0.5 * Math.sin(t * 30) : 1;
      circle(g, p.x, p.y, 24, 'rgba(180,220,255,.5)', '#e0f2fe', 4); who(g, info, p.x, p.y, 16, t);
      g.globalAlpha = 1;
    }
    fx.draw(g);
  },
  hud(g, f, { lang }, Wd) { hudText(g, `🧑‍🚀 ${f.saved}/${f.target}   ⏱ ${f.left}`, Wd / 2, 44, 46, '#ffd23f'); void lang; },
  event(e, _f, { fx }) {
    if (e.k === 'crash') { fx.burst(e.x, e.y, '#ff8c42', 20, 300, 6); fx.kick(8); sfx.bump(); } else if (e.k === 'save') { fx.text(150, 280, `+${e.n}`, '#5dfc8d', 60); sfx.win(); } else if (e.k === 'grab') sfx.coin(); else if (e.k === 'boost') sfx.boost();
  },
};

export const evacRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#2b1a08', '#0b0603'); },
  draw(g, f, { players, t, fx }) {
    g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, W, H); g.fillStyle = '#7a5733'; for (let x = 0; x < W; x += 100) for (let y = 0; y < H; y += 100) if ((x + y) / 100 % 2 === 0) g.fillRect(x, y, 100, 100);
    g.fillStyle = 'rgba(94,234,212,.25)'; g.beginPath(); g.arc(f.exit.x, f.exit.y, f.exit.r, 0, 7); g.fill(); emoji(g, '🚪', f.exit.x, f.exit.y, 54);
    for (const c of f.c) if (!c.by) { emoji(g, '🧰', c.x, c.y, 38); hudText(g, `${'💰'.repeat(c.v)}`, c.x, c.y - 28, 14); }
    for (const gd of f.g) { circle(g, gd.x, gd.y, 24, gd.st ? '#999' : '#b91c1c'); emoji(g, '💂', gd.x, gd.y, 30); }
    for (const p of f.p) { const info = players.get(p.id); if (!info) continue; g.globalAlpha = p.st ? 0.5 : 1; who(g, info, p.x, p.y, 20, t); g.globalAlpha = 1; if (p.c) emoji(g, '🧰', p.x, p.y - 38, 30); }
    // flood
    g.fillStyle = 'rgba(30,120,200,.6)'; g.fillRect(f.fl, 0, W - f.fl + 20, H);
    g.fillStyle = 'rgba(180,230,255,.6)'; g.beginPath(); g.moveTo(f.fl, 0); for (let y = 0; y <= H; y += 20) g.lineTo(f.fl + Math.sin(t * 4 + y / 30) * 8, y); g.lineTo(W + 20, H); g.lineTo(W + 20, 0); g.closePath(); g.globalAlpha = 0.5; g.fill(); g.globalAlpha = 1;
    fx.draw(g);
  },
  hud(g, f, _i, Wd) { hudText(g, `💰 ${f.got}/${f.total}   ⏱ ${f.left}`, Wd / 2, 44, 46, '#ffd23f'); },
  event(e, _f, { fx }) { if (e.k === 'score') { fx.text(70, 300, `+${e.v}`, '#ffd23f', 60); sfx.coin(); } else if (e.k === 'caught') { fx.kick(8); sfx.bad(); } else if (e.k === 'grab' || e.k === 'drop') sfx.click(); },
};

export const huntRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#3a2a10', '#150f05'); },
  draw(g, f, { players, t, fx }) {
    g.fillStyle = '#c9a15a'; g.fillRect(0, 0, W, H); g.fillStyle = '#d4ad66'; for (let i = 0; i < 70; i++) g.fillRect((i * 173) % W, (i * 89) % H, 14, 6);
    for (const [x, y, hit] of f.h) { g.fillStyle = 'rgba(60,35,10,.7)'; g.beginPath(); g.ellipse(x, y + 8, 22, 12, 0, 0, 7); g.fill(); if (hit) emoji(g, '💎', x, y, 24); }
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      if (p.pa !== null) { g.strokeStyle = '#3ec1ff'; g.lineWidth = 6; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(p.pa) * 130, p.y + Math.sin(p.pa) * 130); g.stroke(); circle(g, p.x + Math.cos(p.pa) * 130, p.y + Math.sin(p.pa) * 130, 10, '#3ec1ff'); }
      g.globalAlpha = p.st ? 0.5 : 1; who(g, info, p.x, p.y + (p.dg ? 8 : 0), 22, t, { squash: p.dg ? 0.3 : 0 }); g.globalAlpha = 1;
      if (p.dg) { emoji(g, '⛏️', p.x + 24, p.y - 10 + Math.sin(t * 25) * 6, 28); }
      if (p.st) emoji(g, '💥', p.x, p.y - 30, 34);
    }
    fx.draw(g);
  },
  hud(g, f, { players }, Wd) { hudText(g, `💰 ${f.left2}   ⏱ ${f.left}`, Wd / 2, 44, 46, '#ffd23f'); scoreboard(g, [...f.p].sort((a: any, b: any) => b.s - a.s).map((p: any) => ({ id: p.id, v: p.s })), players, Wd, hudText); },
  event(e, _f, { fx }) {
    if (e.k === 'found') { fx.text(e.x, e.y - 30, `+${e.v}`, '#ffd23f', 64); fx.burst(e.x, e.y, '#ffd23f', 30, 360, 7); sfx.coin(); sfx.win(); }
    else if (e.k === 'bomb') { fx.burst(e.x, e.y, '#ff8c42', 24, 340, 7); fx.kick(8); sfx.boom(); } else if (e.k === 'dig') sfx.tick(); else if (e.k === 'empty') sfx.click(); else if (e.k === 'ping') sfx.power();
  },
};

export const towerRenderer: Renderer = {
  world: { x: 0, y: 0, w: 1200, h: 700 },
  background(g, w, h) { gradBg(g, w, h, '#0f3b46', '#082027'); },
  draw(g, f, { players, t, fx }) {
    const n = f.p.length, cols = Math.min(4, n), rows = Math.ceil(n / cols);
    f.p.forEach((p: any, i: number) => {
      const info = players.get(p.id); if (!info) return;
      const cw = 1200 / cols, ch = 700 / rows, cx = (i % cols) * cw + cw / 2, oy = Math.floor(i / cols) * ch;
      const scale = Math.min(1, cw / 560, ch / 420) * (p.h > 9 ? Math.max(0.5, 9 / p.h) : 1);
      const baseY = oy + ch - 40;
      g.save(); g.beginPath(); g.rect(cx - cw / 2 + 4, oy + 4, cw - 8, ch - 8); g.clip();
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(cx - cw / 2 + 4, oy + 4, cw - 8, ch - 8);
      g.fillStyle = '#143d46'; g.fillRect(cx - cw / 2, baseY, cw, 40);
      g.translate(cx, baseY); g.scale(scale, scale);
      const sway = p.ov ? 0 : Math.sin(t * 2 + i) * Math.min(14, p.h * 1.2);
      p.b.forEach(([bx, bw]: [number, number], k: number) => {
        const lean = (sway * k) / Math.max(1, p.b.length);
        const col = `hsl(${(k * 33 + i * 70) % 360} 75% 58%)`;
        g.save(); if (p.ov && k > 0) { g.translate(bx, -k * 34); g.rotate(Math.min(1.4, p.fl * 1.5) * (k % 2 ? 1 : -1)); g.translate(-bx, k * 34 + Math.min(300, p.fl * p.fl * 200) * 1); }
        g.fillStyle = col; g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.beginPath(); g.roundRect(bx - bw / 2 + lean, -(k + 1) * 34, bw, 34, 6); g.fill(); g.stroke(); g.restore();
      });
      if (p.sw !== null) { // swinging block + rope
        const k = p.b.length;
        g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(p.sw, -k * 34 - 200); g.lineTo(p.sw, -k * 34 - 64); g.stroke();
        g.fillStyle = info.color; g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.beginPath(); g.roundRect(p.sw - p.w / 2, -(k + 1) * 34 - 60, p.w, 34, 6); g.fill(); g.stroke();
      }
      g.restore();
      hudText(g, `${info.name}  ${p.h}🧱${p.ov ? ' 💥' : ''}`, cx, oy + 26, 22, info.color);
    });
    fx.draw(g);
  },
  hud(g, f, _i, Wd) { hudText(g, `⏱ ${f.left}`, Wd / 2, 44, 44, '#ffd23f'); },
  event(e, _f, { fx }) { if (e.k === 'perfect') { fx.text(600, 340, 'PERFECT!', '#ffd23f', 64); sfx.win(); } else if (e.k === 'place') sfx.bump(); else if (e.k === 'collapse') { fx.kick(10); sfx.fall(); } },
};
