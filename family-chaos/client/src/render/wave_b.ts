import { ARENA, TANK_WALLS } from '../../../shared/minigames';
import { sfx } from '../sound';
import { bar, circle, emoji, gradBg, ring, scoreboard, who } from './kit';
import { hudText, type Renderer } from './types';

const world = { x: -20, y: -20, w: ARENA.W + 40, h: ARENA.H + 40 };
const hearts = (g: CanvasRenderingContext2D, x: number, y: number, hp: number, max: number) => { for (let i = 0; i < max; i++) { g.globalAlpha = i < hp ? 1 : 0.2; emoji(g, '❤️', x + (i - (max - 1) / 2) * 17, y, 15); } g.globalAlpha = 1; };
const floor = (g: CanvasRenderingContext2D, c1: string, c2: string, line: string) => {
  g.fillStyle = c1; g.fillRect(0, 0, ARENA.W, ARENA.H);
  g.fillStyle = c2; for (let x = 0; x < ARENA.W; x += 100) for (let y = 0; y < ARENA.H; y += 100) if ((x + y) / 100 % 2 === 0) g.fillRect(x, y, 100, 100);
  g.strokeStyle = line; g.lineWidth = 10; g.strokeRect(0, 0, ARENA.W, ARENA.H);
};

export const tankRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#2a2216', '#12100a'); },
  draw(g, f, { players, t, fx }) {
    floor(g, '#4f6b3a', '#587843', '#2b1d10');
    for (const w of TANK_WALLS) { g.fillStyle = '#7b6a55'; g.strokeStyle = '#2b1d10'; g.lineWidth = 5; g.beginPath(); g.roundRect(w.x, w.y, w.w, w.h, 8); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(w.x + 4, w.y + 4, w.w - 8, 6); }
    for (const [x, y, armed] of f.m) { circle(g, x, y, 13, armed ? '#3a3a44' : '#7a7a86'); circle(g, x, y, 4, armed && Math.floor(t * 4) % 2 ? '#ff4d6d' : '#550'); }
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      if (!p.al) { emoji(g, '💀', p.x, p.y, 30); continue; }
      g.save(); g.translate(p.x, p.y); g.rotate(p.a);
      g.fillStyle = '#1a1a1a'; g.fillRect(-26, -24, 52, 10); g.fillRect(-26, 14, 52, 10);
      g.fillStyle = info.color; g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.beginPath(); g.roundRect(-24, -17, 48, 34, 8); g.fill(); g.stroke();
      g.fillStyle = '#d9d9e8'; g.fillRect(8, -5, 34, 10); g.strokeRect(8, -5, 34, 10);
      g.rotate(-p.a); who(g, info, 0, 0, 13, t, { tag: false }); g.restore();
      hearts(g, p.x, p.y - 44, p.hp, 3);
      hudText(g, info.name, p.x, p.y - 60, 15, info.color);
    }
    for (const [x, y] of f.s) circle(g, x, y, 6, '#ffd23f');
    fx.draw(g);
  },
  hud(g, f, { players }, W) { scoreboard(g, f.p.map((p: any) => ({ id: p.id, v: p.al ? '❤'.repeat(p.hp) : '💀' })), players, W, hudText); },
  event(e, _f, { fx }) {
    if (e.k === 'boom') { fx.burst(e.x, e.y, '#ff8c42', 40, 420, 8); fx.kick(12); sfx.boom(); }
    else if (e.k === 'hit') { fx.burst(e.x, e.y, '#fff', 14, 300, 5); sfx.bump(); }
    else if (e.k === 'fire') sfx.dash(); else if (e.k === 'ricochet') { fx.burst(e.x, e.y, '#ffd23f', 6, 200, 3); sfx.tick(); } else if (e.k === 'mine') sfx.click();
  },
};

export const wizardRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#1a0f3d', '#07031a'); },
  draw(g, f, { players, t, fx }) {
    floor(g, '#2b1a55', '#34216a', '#a78bfa');
    for (let i = 0; i < 3; i++) ring(g, ARENA.W / 2, ARENA.H / 2, 120 + i * 90 + Math.sin(t + i) * 4, 'rgba(167,139,250,.18)', 3);
    for (const [x, y] of f.o) { circle(g, x, y, 14 + Math.sin(t * 5) * 2, '#5dfc8d'); emoji(g, '✨', x, y - 22, 20); }
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      if (!p.al) { emoji(g, '💀', p.x, p.y, 30); continue; }
      who(g, info, p.x, p.y, 25, t, { look: p.a });
      g.save(); g.translate(p.x, p.y - 28); g.fillStyle = info.color; g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, 6); g.lineTo(0, -34); g.lineTo(18, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
      if (p.sh) { ring(g, p.x, p.y, 40, 'rgba(120,220,255,.9)', 6); g.fillStyle = 'rgba(120,220,255,.2)'; g.beginPath(); g.arc(p.x, p.y, 40, 0, 7); g.fill(); }
      hearts(g, p.x, p.y - 82, p.hp, p.mh);
    }
    for (const [x, y] of f.s) { circle(g, x, y, 14, '#ff8c42', '#ffd23f', 4); circle(g, x, y, 6, '#fff7c2', '', 0); }
    fx.draw(g);
  },
  hud(g, f, { players }, W) { scoreboard(g, f.p.map((p: any) => ({ id: p.id, v: p.al ? '❤'.repeat(p.hp) : '💀' })), players, W, hudText); },
  event(e, _f, { fx }) {
    if (e.k === 'explode') { fx.burst(e.x, e.y, '#ff8c42', 30, 380, 8); fx.kick(7); sfx.boom(); }
    else if (e.k === 'boom') { fx.burst(e.x, e.y, '#b26bff', 40, 420, 8); fx.kick(12); sfx.fall(); }
    else if (e.k === 'cast') sfx.dash(); else if (e.k === 'shield' || e.k === 'block') sfx.power(); else if (e.k === 'blink') sfx.pass(); else if (e.k === 'heal') sfx.coin();
  },
};

function foeDraw(g: CanvasRenderingContext2D, e: any, t: number) {
  g.save(); g.translate(e.x, e.y + Math.sin(t * 8 + e.id) * 2);
  g.fillStyle = e.h ? '#fff' : e.t ? '#7c2d5a' : '#2f8f4e'; g.strokeStyle = '#120a2a'; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, e.r, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#fff'; circle(g, -e.r * 0.35, -e.r * 0.2, e.r * 0.22, '#fff', '#120a2a', 2); circle(g, e.r * 0.35, -e.r * 0.2, e.r * 0.22, '#fff', '#120a2a', 2);
  circle(g, -e.r * 0.3, -e.r * 0.2, e.r * 0.09, '#120a2a', '', 0); circle(g, e.r * 0.4, -e.r * 0.2, e.r * 0.09, '#120a2a', '', 0);
  g.strokeStyle = '#120a2a'; g.beginPath(); g.moveTo(-e.r * 0.4, e.r * 0.3); g.lineTo(e.r * 0.4, e.r * 0.3); g.stroke();
  g.restore();
}
function coopPlayers(g: CanvasRenderingContext2D, f: any, players: Map<string, any>, t: number) {
  for (const p of f.p) {
    const info = players.get(p.id); if (!info) continue;
    if (!p.al) { g.globalAlpha = 0.5; who(g, info, p.x, p.y, 22, t, { hurt: true }); g.globalAlpha = 1; emoji(g, '💫', p.x, p.y - 40, 22); bar(g, p.x - 24, p.y + 32, 48, 8, p.rv, '#5dfc8d'); continue; }
    who(g, info, p.x, p.y, 24, t, { look: p.a });
    g.strokeStyle = '#ffd23f'; g.lineWidth = 5; g.beginPath(); g.moveTo(p.x + Math.cos(p.a) * 26, p.y + Math.sin(p.a) * 26); g.lineTo(p.x + Math.cos(p.a) * 52, p.y + Math.sin(p.a) * 52); g.stroke();
    hearts(g, p.x, p.y - 62, p.hp, 3);
  }
}
export const survivalRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#241033', '#0b0414'); },
  draw(g, f, { players, t, fx }) {
    floor(g, '#3b2a4e', '#43305a', '#7c3aed');
    for (const e of f.e) foeDraw(g, e, t);
    coopPlayers(g, f, players, t);
    fx.draw(g);
  },
  hud(g, f, { lang }, W) { hudText(g, `${lang === 'he' ? 'גל' : 'WAVE'} ${f.wave}/${f.waves}`, W / 2, 44, 46, '#ffd23f'); },
  event(e, _f, { fx, players }) {
    if (e.k === 'pop') { fx.burst(e.x, e.y, e.t ? '#d946ef' : '#5dfc8d', 14, 300, 6); sfx.pass(); }
    else if (e.k === 'slash') sfx.dash(); else if (e.k === 'hurt') { fx.kick(6); sfx.bump(); } else if (e.k === 'down') sfx.bad();
    else if (e.k === 'wave') { fx.text(ARENA.W / 2, 300, `WAVE ${e.n}`, '#ffd23f', 90); sfx.go(); } else if (e.k === 'revive') { sfx.win(); void players; }
  },
};
export const defenseRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#102a2a', '#04100f'); },
  draw(g, f, { players, t, fx }) {
    floor(g, '#2c5a4a', '#336653', '#34d399');
    const c = f.core;
    if (c) { circle(g, c.x, c.y, 46 + Math.sin(t * 3) * 2, '#38bdf8', '#e0f2fe', 6); emoji(g, '💎', c.x, c.y, 44); bar(g, c.x - 50, c.y + 62, 100, 12, c.hp / 20, c.hp > 8 ? '#5dfc8d' : '#ff4d6d'); }
    for (const [x, y] of f.tu) { circle(g, x, y, 16, '#94a3b8'); circle(g, x, y, 6, '#ffd23f'); }
    for (const e of f.e) foeDraw(g, e, t);
    coopPlayers(g, f, players, t);
    for (const [x, y] of f.s) circle(g, x, y, 6, '#fff7c2', '#ffd23f', 2);
    fx.draw(g);
  },
  hud(g, f, { lang }, W) { hudText(g, `${lang === 'he' ? 'גל' : 'WAVE'} ${f.wave}/${f.waves}  💎 ${f.core?.hp ?? 0}`, W / 2, 44, 42, '#ffd23f'); },
  event(e, _f, { fx }) {
    if (e.k === 'pop') { fx.burst(e.x, e.y, '#fff', 12, 280, 5); sfx.pass(); } else if (e.k === 'corehit') { fx.kick(10); fx.blink('#ff4d6d', 0.3); sfx.bad(); }
    else if (e.k === 'fire') sfx.click(); else if (e.k === 'turret') sfx.power(); else if (e.k === 'wave') { fx.text(ARENA.W / 2, 220, `WAVE ${e.n}`, '#ffd23f', 90); sfx.go(); } else if (e.k === 'hurt') sfx.bump();
  },
};

export const tagRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#0e3b2e', '#04140f'); },
  draw(g, f, { players, t, fx }) {
    floor(g, '#256d52', '#2a785a', '#5dfc8d');
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      const it = p.id === f.it;
      if (it) { ring(g, p.x, p.y, 44 + Math.sin(t * 8) * 3, '#ff4d6d', 6); emoji(g, '🔥', p.x, p.y - 56, 30); }
      who(g, info, p.x, p.y, 26, t, { squash: it ? 0.15 : 0 });
      bar(g, p.x - 24, p.y + 36, 48, 7, p.st / 100, '#3ec1ff');
    }
    fx.draw(g);
  },
  hud(g, f, { players, lang }, W) {
    hudText(g, `${f.left}s`, W / 2, 44, 50, '#ffd23f');
    const it = players.get(f.it); if (it) hudText(g, `${lang === 'he' ? 'תופס/ת' : 'IT'}: ${it.name}`, W / 2, 92, 30, it.color);
    scoreboard(g, [...f.p].sort((a: any, b: any) => a.s - b.s).map((p: any) => ({ id: p.id, v: `${p.s}s` })), players, W, hudText);
  },
  event(e, _f, { fx }) { if (e.k === 'tag') { fx.kick(8); sfx.bump(); sfx.bad(); void fx; } },
};
