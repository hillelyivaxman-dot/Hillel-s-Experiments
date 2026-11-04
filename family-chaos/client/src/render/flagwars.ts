import { BASES, FW, MUD, TEAM_COLORS, WALLS } from '../../../shared/flagwars';
import { sfx } from '../sound';
import { drawIcon } from './icons';
import { drawCritter, nameTag } from './critter';
import { hudText, type Renderer } from './types';

const DARK = ['#8f1d3a', '#164e9a'];

function banner(g: CanvasRenderingContext2D, x: number, y: number, team: number, t: number, s = 1, drooping = false) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#3b2f2f'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 30); g.lineTo(0, -62); g.stroke();
  g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, -66, 6, 0, 7); g.fill();
  g.fillStyle = TEAM_COLORS[team]; g.strokeStyle = '#120a2a'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(3, -60);
  for (let k = 0; k <= 8; k++) g.lineTo(3 + k * 6.5, -60 + Math.sin(t * 6 + k * 0.7 + team) * (drooping ? 2 : 4) + k * (drooping ? 2.4 : 0.4));
  for (let k = 8; k >= 0; k--) g.lineTo(3 + k * 6.5, -28 + Math.sin(t * 6 + k * 0.7 + team) * (drooping ? 2 : 4) + k * (drooping ? 2.4 : 0.4));
  g.closePath(); g.fill(); g.stroke();
  // crest: red = flame, blue = wave diamond
  if (team === 0) drawIcon(g, 'flame', 24, -43, 20); else { g.fillStyle = '#e0f2fe'; g.beginPath(); g.moveTo(24, -54); g.lineTo(34, -43); g.lineTo(24, -32); g.lineTo(14, -43); g.closePath(); g.fill(); }
  g.restore();
}

export const flagWarsRenderer: Renderer = {
  world: { x: 0, y: 0, w: FW.W, h: FW.H },
  background(g, w, h) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#173d2a'); gr.addColorStop(1, '#0b2417'); g.fillStyle = gr; g.fillRect(0, 0, w, h); },

  draw(g, f, { players, t, fx }) {
    // grass with mowing stripes, tinted per half
    for (let x = 0; x < FW.W; x += 100) { g.fillStyle = (x / 100) % 2 ? '#3f9b4e' : '#46a656'; g.fillRect(x, 0, 100, FW.H); }
    g.fillStyle = 'rgba(255,60,90,.10)'; g.fillRect(0, 0, FW.MID, FW.H); g.fillStyle = 'rgba(60,160,255,.10)'; g.fillRect(FW.MID, 0, FW.MID, FW.H);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6; g.setLineDash([22, 18]); g.beginPath(); g.moveTo(FW.MID, 0); g.lineTo(FW.MID, FW.H); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(FW.MID, FW.H / 2, 90, 0, 7); g.stroke();
    // mud
    for (const m of MUD) { g.fillStyle = '#6b4a2b'; g.beginPath(); g.ellipse(m.x, m.y, m.r, m.r * 0.72, 0, 0, 7); g.fill(); g.strokeStyle = '#4b321c'; g.lineWidth = 4; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.beginPath(); g.ellipse(m.x + Math.sin(t * 1.5 + m.x) * 8, m.y, m.r * 0.5, m.r * 0.32, 0, 0, 7); g.stroke(); }
    // bases
    BASES.forEach((b, tm) => {
      g.fillStyle = tm ? 'rgba(37,99,235,.35)' : 'rgba(239,68,68,.35)'; g.strokeStyle = TEAM_COLORS[tm]; g.lineWidth = 6;
      g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 24); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.setLineDash([10, 12]); g.beginPath(); g.arc(b.fx, b.fy, 52, 0, 7); g.stroke(); g.setLineDash([]);
    });
    // walls: tall = stone blocks with a lit top face, low = hedges you can jump
    for (const w of WALLS) {
      if (w.low) {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.roundRect(w.x + 4, w.y + 8, w.w, w.h, 10); g.fill();
        g.fillStyle = '#2e7d3a'; g.strokeStyle = '#124a1d'; g.lineWidth = 4; g.beginPath(); g.roundRect(w.x, w.y, w.w, w.h, 10); g.fill(); g.stroke();
        g.fillStyle = '#4caf5a'; for (let k = 0; k < Math.max(w.w, w.h) / 22; k++) { const horiz = w.w > w.h; g.beginPath(); g.arc(horiz ? w.x + 12 + k * 22 : w.x + w.w / 2, horiz ? w.y + w.h / 2 : w.y + 12 + k * 22, 6, 0, 7); g.fill(); }
      } else {
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.roundRect(w.x + 8, w.y + 14, w.w, w.h, 8); g.fill();
        g.fillStyle = '#5b6070'; g.strokeStyle = '#1f2330'; g.lineWidth = 4; g.beginPath(); g.roundRect(w.x, w.y + 10, w.w, w.h, 8); g.fill(); g.stroke(); // front face
        g.fillStyle = '#8b92a5'; g.beginPath(); g.roundRect(w.x, w.y, w.w, w.h, 8); g.fill(); g.stroke(); // lit top
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; for (let k = 1; k < w.h / 40; k++) { g.beginPath(); g.moveTo(w.x + 4, w.y + k * 40); g.lineTo(w.x + w.w - 4, w.y + k * 40); g.stroke(); }
      }
    }
    // base banners (home flags droop when stolen)
    f.fl.forEach(([x, y, st]: [number, number, number], tm: number) => { if (st === 0) banner(g, x, y, tm, t, 1.1); else { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(BASES[tm].fx, BASES[tm].fy + 30, 20, 8, 0, 0, 7); g.fill(); g.strokeStyle = '#3b2f2f'; g.lineWidth = 5; g.beginPath(); g.moveTo(BASES[tm].fx, BASES[tm].fy + 30); g.lineTo(BASES[tm].fx, BASES[tm].fy - 40); g.stroke(); } });
    f.fl.forEach(([x, y, st]: [number, number, number], tm: number) => { if (st === 2) { g.strokeStyle = TEAM_COLORS[tm]; g.lineWidth = 4; g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8); g.beginPath(); g.arc(x, y, 34 + Math.sin(t * 5) * 4, 0, 7); g.stroke(); g.globalAlpha = 1; banner(g, x, y + 6, tm, t, 0.85, true); } });
    // players
    const sorted = [...f.p].sort((a: any, b: any) => a.y - b.y);
    for (const p of sorted) {
      const info = players.get(p.id); if (!info) continue;
      if (p.o) { g.globalAlpha = 0.35; drawCritter(g, p.x, p.y, 22, info.color, info.avatar, { t, hurt: true, outline: '#120a2a' }); g.globalAlpha = 1; continue; }
      const z = p.z;
      g.fillStyle = `rgba(0,0,0,${0.32 - z / 260})`; g.beginPath(); g.ellipse(p.x, p.y + 24, 24 - z / 5, 9 - z / 14, 0, 0, 7); g.fill();
      g.strokeStyle = TEAM_COLORS[p.tm]; g.lineWidth = 5; g.beginPath(); g.ellipse(p.x, p.y + 22, 27, 11, 0, 0, 7); g.stroke();
      if (p.ds) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 5; for (let k = 1; k <= 3; k++) { g.beginPath(); g.moveTo(p.x - p.fx * k * 22, p.y - p.fy * k * 22 - 4); g.lineTo(p.x - p.fx * (k * 22 + 18), p.y - p.fy * (k * 22 + 18) - 4); g.stroke(); } }
      if (p.lg) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(p.x + p.fx * 26, p.y + p.fy * 26, 24, 0, 7); g.fill(); }
      if (p.cr) { // the stolen flag on the carrier's back
        g.save(); g.translate(p.x - p.fx * 20, p.y - z - 6); g.scale(0.55, 0.55); banner(g, 0, 0, 1 - p.tm, t * 1.4, 1); g.restore();
      }
      drawCritter(g, p.x, p.y - z, 24 * (p.sz ?? 1), info.color, info.avatar, { t, look: Math.atan2(p.fy, p.fx), squash: p.lg ? 0.2 : 0, outline: '#120a2a', alpha: p.iv ? 0.16 : 1 });
      // team headband + role badge
      g.strokeStyle = TEAM_COLORS[p.tm]; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(p.x, p.y - z - 8, 21, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      drawIcon(g, ['bolt', 'ice', 'shield'][p.ro], p.x + 22, p.y - z - 24, 16);
      if (!p.iv) nameTag(g, p.x, p.y - z - 50 * (p.sz ?? 1), info.name, info.color, 14);
      if (p.sh) { g.strokeStyle = 'rgba(120,230,255,.9)'; g.lineWidth = 5; g.beginPath(); g.arc(p.x, p.y - z, 36, 0, 7); g.stroke(); g.fillStyle = 'rgba(120,230,255,.15)'; g.fill(); }
      if (p.sl) drawIcon(g, 'ice', p.x - 22, p.y - z - 24, 16);
      if (p.s) for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; drawIcon(g, 'star', p.x + Math.cos(a) * 22, p.y - z - 40 + Math.sin(a) * 5, 11); }
    }
    fx.draw(g);
  },

  hud(g, f, { players, lang }, W) {
    const cx = W / 2;
    for (const [tm, sx] of [[0, cx - 150], [1, cx + 150]] as const) {
      g.fillStyle = DARK[tm]; g.strokeStyle = TEAM_COLORS[tm]; g.lineWidth = 5; g.beginPath(); g.roundRect(sx - 70, 14, 140, 62, 18); g.fill(); g.stroke();
      hudText(g, String(f.sc[tm]), sx, 46, 46, '#fff');
      drawIcon(g, 'flag2', sx + (tm ? 52 : -52), 46, 26);
    }
    g.fillStyle = 'rgba(10,5,30,.8)'; g.beginPath(); g.roundRect(cx - 62, 14, 124, 62, 18); g.fill();
    hudText(g, `${Math.floor(f.left / 60)}:${String(f.left % 60).padStart(2, '0')}`, cx, 40, 34, f.left <= 15 ? '#ff4d6d' : '#ffd23f');
    hudText(g, f.ot ? (lang === 'he' ? 'הארכה — הגול הבא מנצח!' : 'OVERTIME — next flag wins!') : `${lang === 'he' ? 'ראשונים ל' : 'First to'} ${f.win}`, cx, 64, 15, '#fff');
    void players;
  },

  event(e, f, { fx, players }) {
    const info = e.id ? players.get(e.id) : null;
    switch (e.k) {
      case 'steal': fx.text(e.t ? 1450 : 150, 360, lang0(f, 'FLAG TAKEN!'), '#ffd23f', 54); fx.kick(5); sfx.power(); break;
      case 'capture': fx.text(800, 300, `${e.a} – ${e.b}`, '#ffffff', 80); fx.burst(e.tm ? 1450 : 150, 450, TEAM_COLORS[e.tm], 70, 520, 8); fx.kick(10); fx.blink(TEAM_COLORS[e.tm], 0.35); sfx.win(); break;
      case 'tag': fx.burst(e.x, e.y, '#ffffff', 16, 300, 5); sfx.bump(); break;
      case 'tackle': fx.burst(e.x, e.y, '#ff8c42', 14, 320, 6); fx.kick(4); sfx.bump(); break;
      case 'drop': fx.text(e.x, e.y - 40, 'DROPPED', '#ffd23f', 28); sfx.bad(); break;
      case 'flaghome': sfx.coin(); break;
      case 'jump': sfx.pass(); break;
      case 'lunge': sfx.dash(); break;
      case 'power': if (e.role === 1) fx.burst(e.x, e.y, '#9bd8ff', 24, 360, 7); else if (e.role === 2) fx.burst(e.x, e.y, '#7cf2ff', 20, 260, 6); else fx.burst(e.x, e.y, '#ffffff', 10, 240, 5); sfx.power(); break;
      case 'dust': fx.burst(e.x, e.y + 20, '#e5d7a4', 2, 90, 5); break;
      case 'respawn': sfx.click(); break;
      case 'overtime': fx.text(800, 450, 'OVERTIME!', '#ff4d6d', 90); sfx.go(); break;
    }
    void info;
  },
};
const lang0 = (_f: unknown, s: string) => s;
