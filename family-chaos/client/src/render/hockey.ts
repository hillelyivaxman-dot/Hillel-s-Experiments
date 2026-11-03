import { HOCKEY } from '../../../shared/hockey';
import { sfx } from '../sound';
import { drawCritter, nameTag } from './critter';
import { hudText, type Renderer } from './types';

const TEAM = ['#ff4d6d', '#3ec1ff'];
const { HW, HH, GOAL_HALF, PUCK_R, MALLET_R } = HOCKEY;
const trail: { x: number; y: number }[] = [];

export const hockeyRenderer: Renderer = {
  world: { x: -HW - 90, y: -HH - 70, w: 2 * (HW + 90), h: 2 * (HH + 70) },
  background(g, W, H, t) {
    const gr = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, '#1b2a6b'); gr.addColorStop(1, '#070b24');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < 24; i++) g.fillRect(((i * 97 + t * 14) % W), (i * 61) % H, 2, 2);
  },

  draw(g, f, { players, t, fx }) {
    // table body + ice
    g.fillStyle = '#0c1233';
    g.beginPath(); g.roundRect(-HW - 30, -HH - 30, 2 * HW + 60, 2 * HH + 60, 46); g.fill();
    const ice = g.createLinearGradient(0, -HH, 0, HH);
    ice.addColorStop(0, '#e8f6ff'); ice.addColorStop(1, '#bfe3f7');
    g.fillStyle = ice;
    g.beginPath(); g.roundRect(-HW, -HH, 2 * HW, 2 * HH, 28); g.fill();
    // air-hole dots
    g.fillStyle = 'rgba(80,130,190,.18)';
    for (let x = -HW + 20; x < HW; x += 26) for (let y = -HH + 20; y < HH; y += 26) { g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill(); }
    // markings
    g.strokeStyle = 'rgba(70,110,200,.55)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(0, -HH); g.lineTo(0, HH); g.stroke();
    g.beginPath(); g.arc(0, 0, 90, 0, Math.PI * 2); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * HW, 0, GOAL_HALF + 14, s < 0 ? -Math.PI / 2 : Math.PI / 2, s < 0 ? Math.PI / 2 : -Math.PI / 2); g.stroke(); }
    // goal slots (glow in the team colour, brighter right after a goal)
    for (const s of [-1, 1] as const) {
      const c = TEAM[s < 0 ? 0 : 1];
      g.shadowColor = c; g.shadowBlur = 24; g.fillStyle = c;
      g.fillRect(s < 0 ? -HW - 16 : HW - 2, -GOAL_HALF, 18, 2 * GOAL_HALF);
      g.shadowBlur = 0;
    }
    // rails
    g.strokeStyle = '#1d2a66'; g.lineWidth = 10;
    g.beginPath(); g.roundRect(-HW, -HH, 2 * HW, 2 * HH, 28); g.stroke();

    // puck trail + puck
    const pk = f.b[0];
    trail.push({ x: pk.x, y: pk.y }); if (trail.length > 10) trail.shift();
    trail.forEach((q, i) => { g.fillStyle = `rgba(30,40,90,${(i / trail.length) * 0.22})`; g.beginPath(); g.arc(q.x, q.y, PUCK_R * (0.5 + i / trail.length / 2), 0, Math.PI * 2); g.fill(); });
    g.shadowColor = f.pz ? '#ffd23f' : '#1d2a66'; g.shadowBlur = 18;
    g.fillStyle = '#12172e'; g.beginPath(); g.arc(pk.x, pk.y, PUCK_R, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#ffd23f'; g.lineWidth = 4; g.beginPath(); g.arc(pk.x, pk.y, PUCK_R - 6, 0, Math.PI * 2); g.stroke();

    // mallets
    for (const m of f.p) {
      const info = players.get(m.id);
      if (!info) continue;
      const c = TEAM[m.tm];
      if (m.bo) { g.fillStyle = 'rgba(255,210,63,.35)'; g.beginPath(); g.arc(m.x, m.y, MALLET_R + 14 + Math.sin(t * 40) * 3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(m.x + 5, m.y + 9, MALLET_R, MALLET_R * 0.9, 0, 0, Math.PI * 2); g.fill();
      const gr = g.createRadialGradient(m.x - 12, m.y - 14, 4, m.x, m.y, MALLET_R);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, c); gr.addColorStop(1, '#1a1f45');
      g.fillStyle = gr; g.strokeStyle = '#12172e'; g.lineWidth = 4;
      g.beginPath(); g.arc(m.x, m.y, MALLET_R, 0, Math.PI * 2); g.fill(); g.stroke();
      drawCritter(g, m.x, m.y - 2, 24, info.color, info.avatar, { t, look: m.tm ? Math.PI : 0 });
      nameTag(g, m.x, m.y - MALLET_R - 18, info.name, c, 14);
    }
    fx.draw(g);
  },

  hud(g, f, { players, lang }, W, H) {
    const cx = W / 2;
    g.fillStyle = 'rgba(8,10,34,.75)';
    g.beginPath(); g.roundRect(cx - 200, 10, 400, 76, 22); g.fill();
    hudText(g, `${f.sc[0]}`, cx - 130, 48, 54, TEAM[0]);
    hudText(g, `${f.sc[1]}`, cx + 130, 48, 54, TEAM[1]);
    const m = Math.floor(f.left / 60), s = String(f.left % 60).padStart(2, '0');
    hudText(g, f.sd ? (lang === 'he' ? 'מוות פתאומי' : 'SUDDEN DEATH') : `${m}:${s}`, cx, 40, f.sd ? 26 : 36, f.sd ? '#ffd23f' : '#fff');
    hudText(g, `${lang === 'he' ? 'ראשון ל' : 'First to'} ${f.to}`, cx, 70, 16, '#b7a9dc');
    if (f.pz) {
      const who = f.ls ? players.get(f.ls)?.name : '';
      hudText(g, lang === 'he' ? 'גוווול!' : 'GOAL!', cx, H / 2, 110, '#ffd23f');
      if (who) hudText(g, who, cx, H / 2 + 70, 40, '#fff');
    }
  },

  event(e, _f, { fx }) {
    switch (e.k) {
      case 'hit': fx.burst(e.x, e.y, '#fff', 7, 260, 4); fx.kick(Math.min(7, e.s / 200)); sfx.bump(); break;
      case 'wall': fx.burst(e.x, e.y, '#9bd0ff', 4, 160, 3); sfx.click(); break;
      case 'smash': sfx.dash(); break;
      case 'nudge': fx.burst(e.x, e.y, '#ffd23f', 12, 200, 5); sfx.pass(); break;
      case 'goal': fx.burst(e.x, 0, ['#ff4d6d', '#3ec1ff'][e.team], 70, 650, 9, 150); fx.kick(14); fx.blink('#fff', 0.5); sfx.win(); break;
      case 'overtime': sfx.go(); break;
    }
  },
};
