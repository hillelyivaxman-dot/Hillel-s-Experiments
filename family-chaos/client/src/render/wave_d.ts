import { sfx } from '../sound';
import { bar, circle, emoji, gradBg, scoreboard, who } from './kit';
import { hudText, type Renderer } from './types';

const SHAPE = ['▲', '●', '■', '★'];
const COL = ['#ff4d6d', '#3ec1ff', '#ffd23f', '#5dfc8d'];

export const spaceRaceRenderer: Renderer = {
  world: { x: 0, y: 0, w: 1100, h: 700 },
  background(g, w, h, t) { gradBg(g, w, h, '#0a0a2e', '#020212'); g.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { g.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 0.7 + i)); g.fillRect((i * 131) % w, (i * 71 + t * 40 * (1 + (i % 3))) % h, 2, 2 + (i % 3)); } g.globalAlpha = 1; },
  draw(g, f, { players, t, fx }) {
    const sy = (y: number) => 560 - (y - f.cam); // world y (progress) -> screen y
    // finish line
    const fy = sy(f.len); if (fy > -40 && fy < 760) { for (let i = 0; i < 22; i++) { g.fillStyle = i % 2 ? '#fff' : '#111'; g.fillRect(i * 50, fy - 14, 50, 28); } hudText(g, 'FINISH', 550, fy - 40, 40, '#ffd23f'); }
    for (const [x, y, r] of f.r) { const yy = sy(y); if (yy < -80 || yy > 780) continue; g.fillStyle = '#6b5b73'; g.strokeStyle = '#120a2a'; g.lineWidth = 4; g.beginPath(); g.arc(x, yy, r, 0, 7); g.fill(); g.stroke(); circle(g, x - r * 0.3, yy - r * 0.25, r * 0.22, 'rgba(0,0,0,.25)', '', 0); }
    for (const [x, y] of f.o) { const yy = sy(y); if (yy > -40 && yy < 740) { circle(g, x, yy, 16 + Math.sin(t * 6) * 2, '#5dfc8d', '#fff', 3); } }
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      const yy = sy(p.y);
      if (yy > 740) { hudText(g, `▼ ${info.name}`, p.x, 690, 18, info.color); continue; }
      if (yy < -30) continue;
      if (p.b) { g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(p.x - 12, yy + 26); g.lineTo(p.x, yy + 70 + Math.random() * 20); g.lineTo(p.x + 12, yy + 26); g.fill(); }
      g.globalAlpha = p.h ? 0.5 + 0.5 * Math.sin(t * 30) : 1;
      g.fillStyle = info.color; g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(p.x, yy - 34); g.lineTo(p.x + 26, yy + 28); g.lineTo(p.x, yy + 16); g.lineTo(p.x - 26, yy + 28); g.closePath(); g.fill(); g.stroke();
      who(g, info, p.x, yy - 2, 12, t, { tag: false }); g.globalAlpha = 1;
      hudText(g, info.name, p.x, yy - 50, 15, info.color);
    }
    fx.draw(g);
  },
  hud(g, f, { players }, Wd) {
    const o = [...f.p].sort((a: any, b: any) => b.y - a.y);
    o.slice(0, 6).forEach((p: any, i: number) => { const info = players.get(p.id); if (info) hudText(g, `${i + 1}. ${info.name} ${p.f ? '🏁' : Math.round((p.y / f.len) * 100) + '%'}`, Wd - 24, 40 + i * 28, 21, info.color, 'right'); });
  },
  event(e, _f, { fx }) { if (e.k === 'crash') { fx.burst(e.x, 560, '#ff8c42', 16, 300, 6); fx.kick(6); sfx.bump(); } else if (e.k === 'orb') sfx.coin(); else if (e.k === 'finish') { sfx.win(); fx.text(550, 300, `#${e.place}`, '#ffd23f', 90); } },
};

export const balloonRenderer: Renderer = {
  world: { x: 0, y: 0, w: 1200, h: 700 },
  background(g, w, h) { gradBg(g, w, h, '#5b1d6e', '#f472b6'); },
  draw(g, f, { players, t, fx }) {
    const n = f.p.length, cols = Math.min(4, n), rows = Math.ceil(n / cols);
    f.p.forEach((p: any, i: number) => {
      const info = players.get(p.id); if (!info) return;
      const cw = 1200 / cols, ch = 640 / rows, cx = (i % cols) * cw + cw / 2, oy = Math.floor(i / cols) * ch + 60;
      const baseY = oy + ch - 70, r = (36 + p.n * 7) * Math.min(1, ch / 330);
      if (p.pp) { fx.burst(cx, baseY - r, info.color, 1, 1, 1); g.strokeStyle = '#fff'; g.lineWidth = 6; for (let k = 0; k < 10; k++) { g.beginPath(); g.moveTo(cx, baseY - r); g.lineTo(cx + Math.cos(k * 0.63) * (r + 40), baseY - r + Math.sin(k * 0.63) * (r + 40)); g.stroke(); } emoji(g, '💥', cx, baseY - r, r * 1.2); }
      else {
        const wob = Math.sin(t * (6 + p.n * 0.8)) * (p.n * 0.25);
        g.save(); g.translate(cx + wob, baseY - r); g.fillStyle = info.color; g.strokeStyle = '#120a2a'; g.lineWidth = 4; g.beginPath(); g.ellipse(0, 0, r * 0.88, r, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-r * 0.3, -r * 0.35, r * 0.18, r * 0.3, 0.5, 0, 7); g.fill(); g.restore();
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + wob, baseY); g.lineTo(cx, baseY + 30); g.stroke();
      }
      who(g, info, cx, baseY + 50, 22, t);
      hudText(g, `🎈 ${p.b}`, cx, oy + 10, 34, '#fff');
    });
    fx.draw(g);
  },
  hud(g, f, _i, Wd) { hudText(g, `⏱ ${f.left}`, Wd / 2, 36, 44, '#ffd23f'); },
  event(e, f, { fx }) {
    if (e.k === 'pop') { fx.kick(8); sfx.boom(); } else if (e.k === 'pump') sfx.tick(); else if (e.k === 'bank') { sfx.coin(); void f; void fx; }
  },
};

export const puzzleRenderer: Renderer = {
  world: { x: 0, y: 0, w: 1200, h: 700 },
  background(g, w, h) { gradBg(g, w, h, '#2a0f55', '#12062a'); },
  draw(g, f, { players, t, fx }) {
    const showing = f.ph === 'show' || f.ph === 'ok' || f.ph === 'bad';
    for (let c = 0; c < 4; c++) {
      const x = 180 + c * 280, y = 300;
      const lit = f.ph === 'show' && f.seq[Math.floor((f.pt - 0.6) / 0.7)] === c && ((f.pt - 0.6) % 0.7) < 0.5;
      g.globalAlpha = lit ? 1 : 0.4; g.fillStyle = COL[c]; g.strokeStyle = '#fff'; g.lineWidth = lit ? 8 : 3; g.beginPath(); g.roundRect(x - 100, y - 100, 200, 200, 30); g.fill(); g.stroke(); g.globalAlpha = 1;
      hudText(g, SHAPE[c], x, y, 110, '#fff');
      const o = players.get(f.p[f.own[c]]?.id); if (o) { who(g, o, x, y + 170, 24, t); }
    }
    // progress dots
    for (let i = 0; i < f.len; i++) { const x = 600 + (i - (f.len - 1) / 2) * 44; circle(g, x, 90, 14, i < f.pos ? '#5dfc8d' : 'rgba(255,255,255,.25)'); if (showing && f.ph !== 'show') hudText(g, SHAPE[f.seq[i]], x, 140, 26, COL[f.seq[i]]); }
    fx.draw(g);
  },
  hud(g, f, { lang }, Wd) {
    hudText(g, `${lang === 'he' ? 'שלב' : 'Level'} ${f.level}/${f.levels}   ${'❤️'.repeat(Math.max(0, f.lives))}`, Wd / 2, 36, 38, '#ffd23f');
    const msg = f.ph === 'show' ? (lang === 'he' ? 'זכרו את הרצף!' : 'Remember the sequence!') : f.ph === 'enter' ? (lang === 'he' ? 'עכשיו הזינו יחד!' : 'Now enter it together!') : f.ph === 'ok' ? '✔' : f.ph === 'bad' ? '✖' : '';
    hudText(g, msg, Wd / 2, 640, 44, f.ph === 'bad' ? '#ff4d6d' : '#fff');
  },
  event(e, _f, { fx }) { if (e.k === 'right') sfx.coin(); else if (e.k === 'wrong') { fx.kick(8); sfx.bad(); } else if (e.k === 'level') sfx.win(); },
};

const MX = (x: number) => 60 + x * 0.9, MY = (y: number) => 60 + y * 0.8;
let strokeStore: number[][] = [];
let strokeVer = -1;
export const drawRenderer: Renderer = {
  world: { x: 0, y: 0, w: 1200, h: 700 },
  background(g, w, h) { gradBg(g, w, h, '#3b2a14', '#1a1209'); },
  draw(g, f, { players, lang, t }) {
    if (f.st) { strokeStore = f.st; strokeVer = f.v; } else if (f.v !== strokeVer && f.ph === 'draw' && f.v < strokeVer) strokeStore = [];
    g.fillStyle = '#fffdf5'; g.beginPath(); g.roundRect(60, 60, 1080, 560, 18); g.fill(); g.strokeStyle = '#120a2a'; g.lineWidth = 6; g.stroke();
    g.save(); g.beginPath(); g.rect(60, 60, 1080, 560); g.clip(); g.strokeStyle = '#1b1b2f'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of strokeStore) { if (s.length < 2) continue; g.beginPath(); g.moveTo(MX(s[0]), MY(s[1])); for (let i = 2; i < s.length; i += 2) g.lineTo(MX(s[i]), MY(s[i + 1])); if (s.length === 2) g.lineTo(MX(s[0]) + 0.1, MY(s[1])); g.stroke(); }
    g.restore();
    const dr = players.get(f.dr);
    if (f.ph === 'draw') { circle(g, MX(f.cur.x), MY(f.cur.y), f.pen ? 8 : 12, f.pen ? (dr?.color ?? '#f00') : 'rgba(0,0,0,0)', dr?.color ?? '#f00', 3); }
    // answer options (guessers tilt the stick: up / right / down / left)
    const label = (w: { he: string; en: string }) => (lang === 'he' ? w.he : w.en);
    const spots = [[600, 36], [1040, 340], [600, 660], [160, 340]];
    f.opts.forEach((o: any, i: number) => { const ok = f.word && o.en === f.word.en; hudText(g, `${['↑', '→', '↓', '←'][i]} ${label(o)}`, spots[i][0], spots[i][1], 30, ok ? '#5dfc8d' : '#fff'); });
    if (f.word) hudText(g, label(f.word), 600, 340, 90, '#5dfc8d');
    if (dr) who(g, dr, 100, 100, 24, t, { tag: false });
  },
  hud(g, f, { players, lang }, Wd) {
    const dr = players.get(f.dr);
    if (dr) hudText(g, `✏️ ${dr.name} · ${lang === 'he' ? 'סבב' : 'Round'} ${f.round}/${f.rounds}`, Wd / 2, 690, 26, dr.color);
    scoreboard(g, [...f.p].sort((a: any, b: any) => b.s - a.s).map((p: any) => ({ id: p.id, v: `${p.s}${p.g ? ' ✓' : ''}` })), players, Wd, hudText, false);
  },
  event(e, _f, { fx }) { if (e.k === 'correct') { sfx.coin(); fx.text(600, 340, '✔', '#5dfc8d', 90); } else if (e.k === 'nope') sfx.bad(); else if (e.k === 'clear') sfx.click(); },
};

export const triviaRenderer: Renderer = {
  world: { x: 0, y: 0, w: 1200, h: 700 },
  background(g, w, h) { gradBg(g, w, h, '#2b1056', '#0c0424'); },
  draw(g, f, { players, lang, t }) {
    const lab = (x: { he: string; en: string }) => (lang === 'he' ? x.he : x.en);
    hudText(g, `${f.qi}/${f.qn}`, 90, 50, 36, '#ffd23f');
    g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.roundRect(80, 90, 1040, 150, 24); g.fill();
    hudText(g, lab(f.q), 600, 165, lab(f.q).length > 40 ? 38 : 50, '#fff');
    f.a.forEach((a: any, i: number) => {
      const x = 80 + (i % 2) * 530, y = 270 + Math.floor(i / 2) * 120;
      const dim = f.c >= 0 && f.c !== i;
      g.globalAlpha = dim ? 0.3 : 1; g.fillStyle = COL[i]; g.strokeStyle = f.c === i ? '#fff' : '#120a2a'; g.lineWidth = f.c === i ? 8 : 4; g.beginPath(); g.roundRect(x, y, 510, 100, 22); g.fill(); g.stroke(); g.globalAlpha = dim ? 0.3 : 1;
      hudText(g, SHAPE[i], x + 50, y + 50, 56, '#120a2a'); hudText(g, lab(a), x + 290, y + 50, lab(a).length > 22 ? 28 : 38, '#120a2a'); g.globalAlpha = 1;
    });
    bar(g, 80, 530, 1040, 14, f.ph === 'ask' ? 1 - f.pt / f.lim : 0, '#5dfc8d');
    f.p.forEach((p: any, i: number) => { const info = players.get(p.id); if (!info) return; const x = 80 + (i % 6) * 175, y = 585 + Math.floor(i / 6) * 70; who(g, info, x + 20, y, 16, t, { tag: false, alpha: 1 }); hudText(g, `${p.s}${p.an && f.ph === 'ask' ? ' ✔' : ''}${f.ph === 'reveal' ? (p.ok ? ' ✔' : ' ✖') : ''}`, x + 50, y, 24, p.ok && f.ph === 'reveal' ? '#5dfc8d' : info.color, 'left'); });
  },
  event(e, _f, { fx }) { if (e.k === 'reveal') { sfx.power(); fx.kick(2); } else if (e.k === 'answered') sfx.click(); },
};
