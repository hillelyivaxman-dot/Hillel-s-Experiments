import { BOARD, makeBoard, tileCell, type TileKind } from '../../../shared/board';
import { sfx } from '../sound';
import { drawCritter } from './critter';
import { hudText, type Renderer } from './types';

const PITCH = 130, TILE = 118, OX = 45, OY = 40;
const COLOR: Record<TileKind, string> = { start: '#5dfc8d', coin3: '#ffd23f', coin5: '#ff9f1c', trap: '#ff4d6d', chance: '#b26bff', power: '#3ec1ff', duel: '#f472b6' };
const center = (i: number) => { const { c, r } = tileCell(i); return { x: OX + c * PITCH + PITCH / 2, y: OY + r * PITCH + PITCH / 2 }; };

const shown = new Map<string, { x: number; y: number }>(); // smoothed token positions (so tokens glide tile to tile)
const T = (lang: string, he: string, en: string) => (lang === 'he' ? he : en);

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = '#1d2540'; g.lineWidth = 3; g.stroke();
}

function icon(g: CanvasRenderingContext2D, k: TileKind, x: number, y: number) {
  g.save(); g.translate(x, y); g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1d2540'; g.fillStyle = '#1d2540';
  switch (k) {
    case 'start': g.beginPath(); g.moveTo(-22, 14); g.lineTo(0, -20); g.lineTo(22, 14); g.closePath(); g.stroke(); g.fillRect(-9, 4, 18, 14); break;
    case 'coin3': case 'coin5':
      g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.stroke();
      g.font = '900 26px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k === 'coin3' ? '+3' : '+5', 0, 2); break;
    case 'trap': for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 18 - 9, 16); g.lineTo(i * 18, -16); g.lineTo(i * 18 + 9, 16); g.closePath(); g.stroke(); } break;
    case 'chance': g.font = '900 52px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 4); break;
    case 'power': g.beginPath(); g.moveTo(6, -24); g.lineTo(-12, 4); g.lineTo(0, 4); g.lineTo(-6, 24); g.lineTo(14, -6); g.lineTo(2, -6); g.closePath(); g.stroke(); break;
    case 'duel': g.beginPath(); g.moveTo(-20, -20); g.lineTo(20, 20); g.moveTo(20, -20); g.lineTo(-20, 20); g.stroke(); break;
  }
  g.restore();
}

function die(g: CanvasRenderingContext2D, x: number, y: number, v: number, rot: number) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = '#fff'; g.strokeStyle = '#1d2540'; g.lineWidth = 5;
  g.beginPath(); g.roundRect(-44, -44, 88, 88, 16); g.fill(); g.stroke();
  g.fillStyle = '#1d2540';
  const pips: Record<number, number[][]> = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  for (const [px, py] of pips[v] ?? []) { g.beginPath(); g.arc(px * 22, py * 22, 7, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

function message(lang: string, m: any, name: (id: string) => string): string {
  if (!m) return '';
  const n = name(m.id ?? m.a ?? '');
  switch (m.k) {
    case 'coin': return T(lang, `${n} מקבל/ת ${m.n} מטבעות`, `${n} gets ${m.n} coins`);
    case 'trap': return T(lang, `${n} נתפס/ה במלכודת: −3`, `${n} hit a trap: −3`);
    case 'power': return T(lang, `${n} קיבל/ה כוח מיוחד!`, `${n} got a power card!`);
    case 'star': return T(lang, `${n} קנה/תה כוכב! ⭐`, `${n} bought a star! ⭐`);
    case 'passStart': return T(lang, `${n} עבר/ה בבית: +2`, `${n} passed Home: +2`);
    case 'duel': return T(lang, `דו־קרב! ${name(m.a)} נגד ${name(m.b)}`, `DUEL! ${name(m.a)} vs ${name(m.b)}`);
    case 'duelResult': return m.w ? T(lang, `${name(m.w)} גונב/ת 3 מטבעות`, `${name(m.w)} steals 3 coins`) : T(lang, 'תיקו!', 'A draw!');
    case 'miniResult': return T(lang, 'תוצאות משחקון הסבב', 'Round minigame results');
    case 'chance': {
      const c = m.c;
      const t = c === 'plus6' ? ['+6 מטבעות', '+6 coins'] : c === 'minus4' ? ['−4 מטבעות', '−4 coins'] : c === 'plus2' ? ['+2 מטבעות', '+2 coins']
        : c === 'swap' ? [`החלפת מקום עם ${name(m.o)}`, `swaps places with ${name(m.o)}`] : c === 'steal' ? [`גונב/ת מ־${name(m.o)}`, `steals from ${name(m.o)}`] : ['קדימה 3 משבצות', 'jumps ahead 3'];
      return `❓ ${n}: ${T(lang, t[0], t[1])}`;
    }
    default: return '';
  }
}

export const boardRenderer: Renderer = {
  world: { x: 0, y: 0, w: OX * 2 + BOARD.COLS * PITCH, h: OY * 2 + BOARD.ROWS * PITCH },
  background(g, W, H) {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#2a1666'); gr.addColorStop(1, '#0c2a5c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  },

  draw(g, f, { players, t, lang, fx }) {
    const tiles = makeBoard(f.sd);
    const name = (id: string) => players.get(id)?.name ?? '';
    // board panel
    g.fillStyle = 'rgba(10,5,40,.55)';
    g.beginPath(); g.roundRect(OX + PITCH - 8, OY + PITCH - 8, (BOARD.COLS - 2) * PITCH + 16, (BOARD.ROWS - 2) * PITCH + 16, 28); g.fill();
    tiles.forEach((k, i) => {
      const { x, y } = center(i);
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.roundRect(x - TILE / 2 + 4, y - TILE / 2 + 8, TILE, TILE, 22); g.fill();
      const gr = g.createLinearGradient(x, y - TILE / 2, x, y + TILE / 2);
      gr.addColorStop(0, COLOR[k]); gr.addColorStop(1, 'rgba(0,0,0,.35)');
      g.fillStyle = COLOR[k]; g.strokeStyle = '#1d2540'; g.lineWidth = 5;
      g.beginPath(); g.roundRect(x - TILE / 2, y - TILE / 2, TILE, TILE, 22); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.roundRect(x - TILE / 2 + 8, y - TILE / 2 + 7, TILE - 16, 14, 7); g.fill();
      icon(g, k, x, y + 4);
      if (i === f.star) { star(g, x, y - 46 + Math.sin(t * 4) * 5, 30, '#ffe45e'); g.shadowColor = '#ffe45e'; g.shadowBlur = 24; star(g, x, y - 46 + Math.sin(t * 4) * 5, 30, '#ffe45e'); g.shadowBlur = 0; }
    });

    // tokens (glide towards their tile; several on one tile stand side by side)
    const byTile = new Map<number, string[]>();
    f.p.forEach((p: any) => byTile.set(p.pos, [...(byTile.get(p.pos) ?? []), p.id]));
    for (const p of f.p) {
      const info = players.get(p.id);
      if (!info) continue;
      const group = byTile.get(p.pos)!, k = group.indexOf(p.id);
      const c = center(p.pos);
      const tx = c.x + (k - (group.length - 1) / 2) * 30, ty = c.y - 6 + (k % 2) * 8;
      const s = shown.get(p.id) ?? { x: tx, y: ty };
      s.x += (tx - s.x) * 0.22; s.y += (ty - s.y) * 0.22;
      shown.set(p.id, s);
      const hop = f.ph === 'move' && f.turn === p.id ? -Math.abs(Math.sin(t * 12)) * 12 : 0;
      drawCritter(g, s.x, s.y + hop - 10, 21, info.color, info.avatar, { t });
      if (f.turn === p.id && f.ph !== 'mini' && f.ph !== 'done') { g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(s.x - 9, s.y - 54 + hop); g.lineTo(s.x + 9, s.y - 54 + hop); g.lineTo(s.x, s.y - 42 + hop); g.closePath(); g.fill(); }
    }

    // centre panel
    const cx = OX + (BOARD.COLS * PITCH) / 2, top = OY + PITCH + 10;
    hudText(g, `${T(lang, 'סבב', 'ROUND')} ${f.round}/${f.rounds}`, cx, top + 28, 40, '#fff');
    // standings
    const rows = [...f.p].sort((a: any, b: any) => b.s - a.s || b.c - a.c);
    rows.forEach((p: any, i: number) => {
      const info = players.get(p.id); if (!info) return;
      const y = top + 82 + i * 40, x = OX + PITCH + 40;
      g.fillStyle = f.turn === p.id ? 'rgba(255,210,63,.22)' : 'rgba(255,255,255,.07)';
      g.beginPath(); g.roundRect(x - 14, y - 18, 330, 36, 14); g.fill();
      hudText(g, `${i + 1}. ${info.name}`, x, y, 22, info.color, 'left');
      hudText(g, `${p.s}★  ${p.c}c${p.w ? (p.w === 'double' ? '  ×2' : '  ✋') : ''}`, x + 312, y, 22, '#fff', 'right');
    });
    // dice + message / minigame
    const dx = cx + 150;
    if (f.dice?.length && (f.ph === 'move' || f.ph === 'land')) {
      f.dice.forEach((v: number, i: number) => die(g, dx + (i - (f.dice.length - 1) / 2) * 110, top + 170, f.ph === 'move' && f.turn && t % 0.2 < 0.1 ? 1 + ((Math.floor(t * 20) + i * 3) % 6) : v, f.ph === 'move' ? Math.sin(t * 20 + i) * 0.15 : 0));
    } else if (f.ph === 'roll') {
      hudText(g, T(lang, `${name(f.turn)} מטיל/ה קוביה`, `${name(f.turn)} rolls`), dx, top + 160, 34, players.get(f.turn)?.color ?? '#fff');
    } else if (f.ph === 'buy') {
      hudText(g, T(lang, `${name(f.turn)}: לקנות כוכב? (10 מטבעות)`, `${name(f.turn)}: buy a star? (10 coins)`), dx, top + 160, 32, '#ffe45e');
    }
    if (f.ph === 'mini' || f.ph === 'duel') {
      const who = f.ph === 'duel' ? f.p.filter((p: any) => f.du?.includes(p.id)) : f.p;
      hudText(g, `${T(lang, f.ph === 'duel' ? 'דו־קרב לחיצות!' : 'משחקון: לחצו מהר!', f.ph === 'duel' ? 'TAP DUEL!' : 'TAP RACE!')}  ${f.tm}`, cx, top + 270, 36, '#ffd23f');
      const max = Math.max(5, ...who.map((p: any) => p.tp));
      who.forEach((p: any, i: number) => {
        const info = players.get(p.id); if (!info) return;
        const y = top + 310 + i * 34, x0 = OX + PITCH + 40;
        g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(x0, y - 11, 760, 22, 11); g.fill();
        g.fillStyle = info.color; g.beginPath(); g.roundRect(x0, y - 11, Math.max(22, (p.tp / max) * 760), 22, 11); g.fill();
        hudText(g, `${info.name} ${p.tp}`, x0 + 8, y, 17, '#1d2540', 'left');
      });
    } else if (f.ph === 'result' && f.res) {
      f.res.forEach((r: any, i: number) => hudText(g, `${i + 1}. ${name(r.id)} — ${r.taps} ${T(lang, 'לחיצות', 'taps')}${r.prize ? `  +${r.prize}` : ''}`, cx, top + 290 + i * 34, 24, players.get(r.id)?.color ?? '#fff'));
    }
    if (f.msg) hudText(g, message(lang, f.msg, name), cx, top + 232, 28, '#fff');
    fx.draw(g);
  },

  event(e, f, { players, fx }) {
    const pos = (id: string) => { const s = shown.get(id); return s ?? { x: 700, y: 400 }; };
    switch (e.k) {
      case 'roll': sfx.go(); break;
      case 'step': sfx.click(); break;
      case 'turn': sfx.join(); break;
      case 'coin': { const p = pos(e.id); fx.burst(p.x, p.y - 20, '#ffd23f', 14, 240, 6); fx.text(p.x, p.y - 50, `+${e.n}`, '#ffd23f', 34); sfx.coin(); break; }
      case 'lose': { const p = pos(e.id); fx.burst(p.x, p.y - 20, '#ff4d6d', 12, 220, 6); fx.text(p.x, p.y - 50, `${e.n}`, '#ff4d6d', 34); sfx.bad(); break; }
      case 'star': { const p = pos(e.id); fx.burst(p.x, p.y - 20, '#ffe45e', 50, 500, 8); fx.kick(8); sfx.win(); break; }
      case 'starOffer': sfx.power(); break;
      case 'usePower': sfx.power(); break;
      case 'mini': sfx.go(); break;
      case 'land': if (e.tile === 'trap') fx.kick(5); break;
    }
    void f; void players;
  },
};
