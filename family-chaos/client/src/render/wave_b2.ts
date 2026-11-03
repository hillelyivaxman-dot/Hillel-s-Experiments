import { ARENA } from '../../../shared/minigames';
import { sfx } from '../sound';
import { astronaut, bar, circle, gradBg, hearts, ring, scoreboard, star, who } from './kit';
import { hudText, type Renderer } from './types';

const world = { x: -20, y: -20, w: ARENA.W + 40, h: ARENA.H + 40 };
const W = ARENA.W, H = ARENA.H;
const HILL_SPOTS: [number, number][] = [[600, 350], [250, 190], [950, 190], [250, 520], [950, 520]];
const floor = (g: CanvasRenderingContext2D, c1: string, c2: string, line: string) => {
  g.fillStyle = c1; g.fillRect(0, 0, W, H);
  g.fillStyle = c2; for (let x = 0; x < W; x += 100) for (let y = 0; y < H; y += 100) if ((x + y) / 100 % 2 === 0) g.fillRect(x, y, 100, 100);
  g.strokeStyle = line; g.lineWidth = 10; g.strokeRect(0, 0, W, H);
};

// ---------------- Mage Hill ----------------
export const wizardRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#1a0f3d', '#07031a'); },
  draw(g, f, { players, t, fx }) {
    floor(g, '#2b1a55', '#34216a', '#a78bfa');
    const [hx, hy] = HILL_SPOTS[f.hill];
    const hold = f.hold ? players.get(f.hold) : null, col = hold?.color ?? '#ffffff';
    const pulse = 1 + Math.sin(t * 4) * 0.03;
    const gr = g.createRadialGradient(hx, hy, 10, hx, hy, f.hr * pulse);
    gr.addColorStop(0, hold ? col + '66' : 'rgba(255,255,255,.22)'); gr.addColorStop(1, hold ? col + '11' : 'rgba(255,255,255,.04)');
    g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, f.hr * pulse, 0, 7); g.fill();
    ring(g, hx, hy, f.hr * pulse, col, 6);
    g.setLineDash([16, 18]); g.lineDashOffset = -t * 30; ring(g, hx, hy, f.hr * 0.72, 'rgba(255,255,255,.55)', 3); g.setLineDash([]);
    for (let k = 0; k < 6; k++) { const a = t * 0.7 + k * 1.047; star(g, hx + Math.cos(a) * f.hr * 0.5, hy + Math.sin(a) * f.hr * 0.5, 7, '#ffe45e'); }
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      if (!p.al) { g.globalAlpha = 0.4; who(g, info, p.x, p.y, 22, t, { hurt: true, tag: false }); g.globalAlpha = 1; continue; }
      who(g, info, p.x, p.y, 25, t, { look: p.a });
      g.save(); g.translate(p.x, p.y - 28); g.fillStyle = info.color; g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, 6); g.lineTo(2, -36); g.lineTo(18, 6); g.closePath(); g.fill(); g.stroke(); star(g, 2, -34, 6); g.restore();
      if (p.sh) { ring(g, p.x, p.y, 42, 'rgba(120,220,255,.95)', 6); g.fillStyle = 'rgba(120,220,255,.2)'; g.beginPath(); g.arc(p.x, p.y, 42, 0, 7); g.fill(); }
      hearts(g, p.x, p.y - 84, p.hp, p.mh, 13);
    }
    for (const [x, y] of f.s) { const gl = g.createRadialGradient(x, y, 2, x, y, 26); gl.addColorStop(0, 'rgba(255,230,150,.95)'); gl.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); circle(g, x, y, 10, '#ff8c42', '#ffd23f', 3); }
    fx.draw(g);
  },
  hud(g, f, { players, lang }, Wd) {
    hudText(g, `${f.left}s`, Wd / 2, 44, 46, '#ffd23f');
    hudText(g, `${lang === 'he' ? 'הגבעה זזה בעוד' : 'Hill moves in'} ${f.nh}s`, Wd / 2, 88, 22, '#fff');
    scoreboard(g, [...f.p].sort((a: any, b: any) => b.s - a.s).map((p: any) => ({ id: p.id, v: p.s })), players, Wd, hudText);
  },
  event(e, _f, { fx }) {
    if (e.k === 'explode') { fx.burst(e.x, e.y, '#ff8c42', 30, 380, 8); fx.kick(7); sfx.boom(); }
    else if (e.k === 'boom') { fx.burst(e.x, e.y, '#b26bff', 40, 420, 8); fx.kick(10); sfx.fall(); }
    else if (e.k === 'cast') sfx.dash(); else if (e.k === 'shield' || e.k === 'block') sfx.power(); else if (e.k === 'blink') sfx.pass(); else if (e.k === 'hill') { fx.blink('#ffffff', 0.25); sfx.go(); }
  },
};

// ---------------- Zombie Survival ----------------
function zombie(g: CanvasRenderingContext2D, z: any, t: number, tx: number, ty: number) {
  const face = Math.atan2(ty - z.y, tx - z.x), sway = Math.sin(t * (z.k === 1 ? 14 : 6) + z.id) * (z.k === 1 ? 0.18 : 0.1);
  const skin = z.h ? '#ffffff' : ['#86b36a', '#a3c653', '#5f8d63'][z.k], dark = ['#4d6b3c', '#6b8a2e', '#3a5c40'][z.k], r = z.r;
  g.save(); g.translate(z.x, z.y);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, r * 0.85, r * 0.95, r * 0.35, 0, 0, 7); g.fill();
  g.rotate(sway); if (z.k === 1) g.rotate(Math.cos(face) > 0 ? 0.18 : -0.18); // runners lean into it
  // arms stretched toward the target
  g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.fillStyle = skin;
  for (const side of [-1, 1]) { g.save(); g.rotate(face - sway + side * 0.28); g.beginPath(); g.roundRect(r * 0.3, -r * 0.14, r * 1.05, r * 0.3, r * 0.15); g.fill(); g.stroke(); g.restore(); }
  // torn shirt body
  g.fillStyle = z.k === 2 ? '#6b4a8c' : '#4b6fb0'; g.beginPath(); g.roundRect(-r * 0.75, -r * 0.1, r * 1.5, r * 1.05, r * 0.3); g.fill(); g.stroke();
  g.fillStyle = skin; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-r * 0.75 + k * r * 0.42, r * 0.95); g.lineTo(-r * 0.54 + k * r * 0.42, r * 0.6); g.lineTo(-r * 0.33 + k * r * 0.42, r * 0.95); g.fill(); }
  // head
  g.fillStyle = skin; g.beginPath(); g.ellipse(0, -r * 0.55, r * 0.85, r * 0.8, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = dark; g.beginPath(); g.ellipse(r * 0.3, -r * 0.8, r * 0.25, r * 0.16, 0.5, 0, 7); g.fill(); // patch
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-r * 0.3, -r * 0.6, r * 0.24, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(r * 0.32, -r * 0.55, r * 0.17, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#120a2a'; g.beginPath(); g.arc(-r * 0.3 + Math.cos(face) * 3, -r * 0.6 + Math.sin(face) * 3, r * 0.1, 0, 7); g.fill(); g.beginPath(); g.arc(r * 0.32 + Math.cos(face) * 2, -r * 0.55 + Math.sin(face) * 2, r * 0.07, 0, 7); g.fill();
  g.strokeStyle = '#120a2a'; g.lineWidth = 3; g.beginPath();
  if (z.b) g.ellipse(0, -r * 0.2, r * 0.3, r * 0.2, 0, 0, 7); else { g.moveTo(-r * 0.4, -r * 0.2); for (let k = 0; k < 5; k++) g.lineTo(-r * 0.4 + (k + 1) * r * 0.16, -r * 0.2 + (k % 2 ? -3 : 3)); }
  g.stroke();
  if (z.k === 2) { g.fillStyle = '#c2410c'; g.beginPath(); g.moveTo(-r * 0.5, -r * 1.25); g.lineTo(-r * 0.25, -r * 1.55); g.lineTo(0, -r * 1.25); g.fill(); g.beginPath(); g.moveTo(0, -r * 1.25); g.lineTo(r * 0.25, -r * 1.55); g.lineTo(r * 0.5, -r * 1.25); g.fill(); } // brute: tufts of hair
  g.restore();
}
export const survivalRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#1f1730', '#0a0612'); },
  draw(g, f, { players, t, fx }) {
    floor(g, '#3a3a52', '#42425c', '#7c3aed');
    // gravestones at the spawn edges (decor)
    g.fillStyle = 'rgba(255,255,255,.1)'; for (let k = 0; k < 8; k++) { const x = 90 + k * 150, y = k % 2 ? 22 : H - 26; g.beginPath(); g.roundRect(x, y - 14, 26, 30, [12, 12, 2, 2]); g.fill(); }
    for (const [x, y] of f.hp) { const bob = Math.sin(t * 5 + x) * 3; g.save(); g.translate(x, y + bob); g.fillStyle = 'rgba(255,77,109,.3)'; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.restore(); hearts(g, x, y + bob, 1, 1, 24); }
    const alive = f.p.filter((p: any) => p.al !== 0);
    for (const z of [...f.e].sort((a: any, b: any) => a.y - b.y)) {
      let tx = W / 2, ty = H / 2, bd = Infinity;
      for (const p of alive) { const d = Math.hypot(p.x - z.x, p.y - z.y); if (d < bd) { bd = d; tx = p.x; ty = p.y; } }
      zombie(g, z, t, tx, ty);
    }
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      if (p.al === 0) { g.globalAlpha = 0.5; who(g, info, p.x, p.y, 22, t, { hurt: true }); g.globalAlpha = 1; bar(g, p.x - 24, p.y + 34, 48, 8, p.rv, '#5dfc8d'); hudText(g, '+', p.x, p.y - 44, 30, '#5dfc8d'); continue; }
      if (p.iv) g.globalAlpha = 0.55 + 0.45 * Math.sin(t * 40);
      who(g, info, p.x, p.y, 24, t, { look: p.a });
      g.globalAlpha = 1;
      g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x + Math.cos(p.a) * 28, p.y + Math.sin(p.a) * 28); g.lineTo(p.x + Math.cos(p.a) * 56, p.y + Math.sin(p.a) * 56); g.stroke();
      hearts(g, p.x, p.y - 62, p.hp, f.mh, 12);
    }
    fx.draw(g);
  },
  hud(g, f, { lang }, Wd) {
    hudText(g, `${lang === 'he' ? 'גל' : 'WAVE'} ${f.wave}/${f.waves}`, Wd / 2, 44, 46, '#ffd23f');
    hudText(g, f.nw ? `${lang === 'he' ? 'מתכוננים' : 'Get ready'}… ${f.nw}` : `${lang === 'he' ? 'זומבים' : 'Zombies'}: ${f.left}`, Wd / 2, 88, 24, '#fff');
  },
  event(e, _f, { fx }) {
    if (e.k === 'pop') { fx.burst(e.x, e.y, e.z === 2 ? '#7c9a6b' : '#9ad07a', 16, 300, 7); fx.burst(e.x, e.y, '#d1d5db', 8, 180, 10); sfx.pass(); }
    else if (e.k === 'slash') { sfx.dash(); } else if (e.k === 'hurt') { fx.kick(6); sfx.bump(); } else if (e.k === 'down') sfx.bad();
    else if (e.k === 'wave') { fx.text(W / 2, 330, `WAVE ${e.n}`, '#ffd23f', 96); sfx.go(); } else if (e.k === 'revive' || e.k === 'heal') sfx.win();
  },
};

// ---------------- Freeze Tag ----------------
export const tagRenderer: Renderer = {
  world,
  background(g, w, h) { gradBg(g, w, h, '#0a2a44', '#041018'); },
  draw(g, f, { players, t, fx }) {
    floor(g, '#1e5a7a', '#236883', '#7dd3fc');
    for (const p of f.p) {
      const info = players.get(p.id); if (!info) continue;
      if (p.fr) { // the freezer: icy aura + crystal crown
        const gr = g.createRadialGradient(p.x, p.y, 10, p.x, p.y, 64); gr.addColorStop(0, 'rgba(160,230,255,.55)'); gr.addColorStop(1, 'rgba(160,230,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, 64, 0, 7); g.fill();
        who(g, info, p.x, p.y, 27, t);
        g.fillStyle = '#bae6fd'; g.strokeStyle = '#0c4a6e'; g.lineWidth = 3; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(p.x + k * 12 - 6, p.y - 32); g.lineTo(p.x + k * 12, p.y - 52 - (k === 0 ? 8 : 0)); g.lineTo(p.x + k * 12 + 6, p.y - 32); g.closePath(); g.fill(); g.stroke(); }
      } else {
        who(g, info, p.x, p.y, 25, t, { alpha: p.ic ? 0.75 : 1 });
        if (p.ic) { // ice block + thaw progress
          g.fillStyle = 'rgba(170,230,255,.55)'; g.strokeStyle = '#e0f7ff'; g.lineWidth = 4; g.beginPath(); g.roundRect(p.x - 34, p.y - 36, 68, 72, 12); g.fill(); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(p.x - 20, p.y - 24); g.lineTo(p.x - 8, p.y - 30); g.moveTo(p.x + 10, p.y + 22); g.lineTo(p.x + 24, p.y + 12); g.stroke();
          if (p.th > 0) { g.strokeStyle = '#5dfc8d'; g.lineWidth = 7; g.beginPath(); g.arc(p.x, p.y, 48, -Math.PI / 2, -Math.PI / 2 + p.th * Math.PI * 2); g.stroke(); }
        } else bar(g, p.x - 24, p.y + 36, 48, 7, p.st / 100, '#3ec1ff');
      }
    }
    fx.draw(g);
  },
  hud(g, f, { players, lang }, Wd) {
    hudText(g, `${f.left}s`, Wd / 2, 44, 50, '#ffd23f');
    const free = f.p.filter((p: any) => !p.fr && !p.ic).length;
    hudText(g, `${lang === 'he' ? 'חופשיים' : 'Free'}: ${free}`, Wd / 2, 90, 26, '#fff');
    scoreboard(g, [...f.p].sort((a: any, b: any) => b.s - a.s).map((p: any) => ({ id: p.id, v: p.s })), players, Wd, hudText);
  },
  event(e, _f, { fx }) {
    if (e.k === 'freeze') { fx.burst(e.x, e.y, '#bae6fd', 20, 320, 6); fx.kick(6); sfx.bump(); }
    else if (e.k === 'thaw') { fx.burst(e.x, e.y, '#5dfc8d', 24, 320, 6); sfx.win(); } else if (e.k === 'allfrozen') { fx.blink('#bae6fd', 0.8); sfx.boom(); }
  },
};

// small re-export so rescue can reuse the astronaut drawing
export { astronaut };
