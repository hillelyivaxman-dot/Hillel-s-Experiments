import { BD, KINDS, ROLES } from '../../../shared/basedefense';
import { sfx } from '../sound';
import { drawCritter, nameTag } from './critter';
import { bar } from './kit';
import { hudText, type Renderer } from './types';

const SHOTS: { x: number; y: number; tx: number; ty: number; c: number; life: number }[] = [];
const RINGS: { x: number; y: number; r: number; color: string; life: number }[] = [];
const roleColor = (r: number) => ROLES[r]?.color ?? '#fff';

export const baseDefenseRenderer: Renderer = {
  world: { x: 0, y: 0, w: BD.W, h: BD.H },
  background(g, W, H, t) {
    const gr = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, '#2c5a3a'); gr.addColorStop(1, '#10261c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.04)'; g.lineWidth = 2;
    for (let x = 0; x < W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    void t;
  },

  draw(g, f, { players, t, fx }) {
    // spawn edges glow
    g.fillStyle = 'rgba(255,60,60,.10)';
    g.fillRect(0, 0, 18, BD.H); g.fillRect(BD.W - 18, 0, 18, BD.H); g.fillRect(0, 0, BD.W, 18); g.fillRect(0, BD.H - 18, BD.W, 18);
    // safe ring + core tower
    g.strokeStyle = 'rgba(93,252,141,.25)'; g.lineWidth = 4; g.setLineDash([14, 12]);
    g.beginPath(); g.arc(BD.CORE_X, BD.CORE_Y, BD.CORE_R + 110, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    const hurt = f.core < f.cm * 0.35;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(BD.CORE_X, BD.CORE_Y + 58, 70, 22, 0, 0, 7); g.fill();
    g.fillStyle = '#3a4668'; g.strokeStyle = '#120a2a'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(BD.CORE_X - 52, BD.CORE_Y - 50, 104, 100, 10); g.fill(); g.stroke();
    g.fillStyle = '#4b5a86'; g.fillRect(BD.CORE_X - 46, BD.CORE_Y - 44, 92, 14);
    const pulse = 0.75 + 0.25 * Math.sin(t * (hurt ? 9 : 3));
    g.fillStyle = hurt ? `rgba(255,77,109,${pulse})` : `rgba(93,252,141,${pulse})`;
    g.beginPath(); g.arc(BD.CORE_X, BD.CORE_Y, 26, 0, 7); g.fill(); g.stroke();
    bar(g, BD.CORE_X - 60, BD.CORE_Y + 66, 120, 14, f.core / f.cm, hurt ? '#ff4d6d' : '#5dfc8d');
    // turrets
    for (const tr of f.tr) {
      g.fillStyle = '#5b6b94'; g.strokeStyle = '#120a2a'; g.lineWidth = 4;
      g.beginPath(); g.arc(tr.x, tr.y, 20, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#3ec1ff'; g.beginPath(); g.arc(tr.x, tr.y, 9, 0, 7); g.fill();
    }
    // enemies
    for (const e of f.e) {
      const K = KINDS[e.k];
      const wob = Math.sin(t * 9 + e.id) * 2;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(e.x, e.y + K.r * 0.8, K.r, K.r * 0.35, 0, 0, 7); g.fill();
      g.fillStyle = K.color; g.strokeStyle = '#120a2a'; g.lineWidth = 3.5;
      g.beginPath(); g.arc(e.x, e.y + wob, K.r, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(e.x - K.r * 0.35, e.y - K.r * 0.15 + wob, K.r * 0.26, 0, 7); g.arc(e.x + K.r * 0.35, e.y - K.r * 0.15 + wob, K.r * 0.26, 0, 7); g.fill();
      g.fillStyle = '#120a2a'; g.beginPath(); g.arc(e.x - K.r * 0.3, e.y - K.r * 0.1 + wob, K.r * 0.1, 0, 7); g.arc(e.x + K.r * 0.3, e.y - K.r * 0.1 + wob, K.r * 0.1, 0, 7); g.fill();
      if (e.h < 100 && K.r > 18) bar(g, e.x - K.r, e.y - K.r - 12, K.r * 2, 6, e.h / 100, '#ff4d6d');
    }
    // defenders
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      const rc = roleColor(p.r);
      g.strokeStyle = rc; g.lineWidth = 4; g.beginPath(); g.arc(p.x, p.y + 16, 24, 0, 7); g.stroke();
      if (p.d) { // downed
        drawCritter(g, p.x, p.y, 22, info.color, info.avatar, { t: 0, hurt: true, alpha: 0.45 });
        hudText(g, ':heart:', p.x, p.y - 38, 26);
        continue;
      }
      drawCritter(g, p.x, p.y, 23, info.color, info.avatar, { t, look: Math.cos(p.f) >= 0 ? 0 : Math.PI, squash: p.s ? 0.12 : 0 });
      nameTag(g, p.x, p.y - 52, `${info.name}`, info.color, 14);
      bar(g, p.x - 22, p.y + 32, 44, 6, p.hp / 100, p.hp < 35 ? '#ff4d6d' : '#5dfc8d');
      if (p.a) { g.fillStyle = rc; g.beginPath(); g.arc(p.x + 26, p.y - 26, 7, 0, 7); g.fill(); g.strokeStyle = '#120a2a'; g.lineWidth = 2.5; g.stroke(); }
    }
    // tracers + rings
    const dt = 1 / 30;
    for (const s of SHOTS) {
      g.strokeStyle = s.c === 4 ? '#3ec1ff' : roleColor(s.c); g.globalAlpha = Math.max(0, s.life / 0.12); g.lineWidth = s.c === 0 ? 5 : 3;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.tx, s.ty); g.stroke(); s.life -= dt;
    }
    g.globalAlpha = 1;
    for (const r of RINGS) { g.strokeStyle = r.color; g.globalAlpha = Math.max(0, r.life / 0.5); g.lineWidth = 8; g.beginPath(); g.arc(r.x, r.y, r.r * (1 - r.life / 0.6), 0, 7); g.stroke(); r.life -= dt; }
    g.globalAlpha = 1;
    for (let i = SHOTS.length - 1; i >= 0; i--) if (SHOTS[i].life <= 0) SHOTS.splice(i, 1);
    for (let i = RINGS.length - 1; i >= 0; i--) if (RINGS[i].life <= 0) RINGS.splice(i, 1);
    fx.draw(g);
  },

  hud(g, f, { players, lang }, W) {
    const he = lang === 'he';
    hudText(g, `${he ? 'גל' : 'WAVE'} ${Math.max(1, f.w)}/${f.wl}`, W / 2, 40, 40, '#ffd23f');
    if (f.br > 0 && f.w < f.wl) hudText(g, he ? `הגל הבא בעוד ${f.br}` : `Next wave in ${f.br}`, W / 2, 84, 26, '#fff');
    else hudText(g, he ? `${f.left} אויבים` : `${f.left} enemies`, W / 2, 84, 26, '#fff');
    hudText(g, `:star: ${f.sc}`, W - 24, 40, 30, '#ffd23f', 'right');
    hudText(g, f.uc ? (he ? `שדרוג ${f.uc}` : `UPGRADE ${f.uc}`) : (he ? 'שדרוג מקסימלי' : 'MAX UPGRADE'), W - 24, 78, 22, f.sc >= f.uc && f.uc ? '#5dfc8d' : '#b9a8e8', 'right');
    [...f.p].sort((a: any, b: any) => b.k - a.k).slice(0, 8).forEach((p: any, i: number) => {
      const info = players.get(p.id); if (!info) return;
      hudText(g, `${info.name} · ${he ? ROLES[p.r].name.he : ROLES[p.r].name.en} · ${p.k}`, 24, 40 + i * 28, 20, info.color, 'left');
    });
  },

  event(e, _f, { fx }) {
    switch (e.k) {
      case 'shot': SHOTS.push({ x: e.x, y: e.y, tx: e.tx, ty: e.ty, c: e.c, life: 0.12 }); if (SHOTS.length > 80) SHOTS.shift(); break;
      case 'kill': fx.burst(e.x, e.y, KINDS[e.kd]?.color ?? '#fff', 8, 200, 5); if (e.kd === 2) { fx.kick(6); sfx.bump(); } break;
      case 'burst': RINGS.push({ x: e.x, y: e.y, r: e.r, color: '#ffd23f', life: 0.5 }); fx.kick(6); sfx.dash(); break;
      case 'shock': RINGS.push({ x: e.x, y: e.y, r: 230, color: '#ff4d6d', life: 0.5 }); fx.kick(8); sfx.bump(); break;
      case 'heal': RINGS.push({ x: e.x, y: e.y, r: 190, color: '#5dfc8d', life: 0.5 }); sfx.coin(); break;
      case 'build': fx.burst(e.x, e.y, '#3ec1ff', 16, 220, 5); sfx.click(); break;
      case 'upgrade': fx.text(BD.CORE_X, BD.CORE_Y - 120, `UPGRADE ${e.n}!`, '#b26bff', 44); sfx.win(); break;
      case 'wave': fx.text(BD.CORE_X, 200, `WAVE ${e.n}`, '#ffd23f', 64); sfx.go(); break;
      case 'down': sfx.bad(); break;
      case 'victory': sfx.win(); break;
      case 'defeat': fx.kick(20); sfx.fall(); break;
    }
  },
};
