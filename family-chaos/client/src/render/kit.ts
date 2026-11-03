// Small drawing helpers shared by the newer game renderers.
import type { PlayerInfo } from '../../../shared/protocol';
import { drawCritter, nameTag } from './critter';
import { emojiIcon } from './icons';

export function gradBg(g: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
export function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, v: number, color: string, back = 'rgba(0,0,0,.45)') {
  g.fillStyle = back; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  g.fillStyle = color; g.beginPath(); g.roundRect(x, y, Math.max(h, w * Math.max(0, Math.min(1, v))), h, h / 2); g.fill();
}
export function who(g: CanvasRenderingContext2D, info: PlayerInfo | undefined, x: number, y: number, r: number, t: number, o: { look?: number; hurt?: boolean; alpha?: number; squash?: number; tag?: boolean } = {}) {
  if (!info) return;
  drawCritter(g, x, y, r, info.color, info.avatar, { t, look: o.look, hurt: o.hurt, alpha: o.alpha, squash: o.squash, outline: '#120a2a' });
  if (o.tag !== false) nameTag(g, x, y - r - 20, info.name, info.color, 15);
}
export function ring(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, lw = 4) {
  g.strokeStyle = color; g.lineWidth = lw; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
}
export function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke = '#120a2a', lw = 3) {
  g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
export function emoji(g: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number) { emojiIcon(g, ch, x, y, size); }
/** Scoreboard in the corner, sorted by `key`. */
export function scoreboard(g: CanvasRenderingContext2D, rows: { id: string; v: number | string }[], players: Map<string, PlayerInfo>, W: number, hudText: (g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color?: string, align?: CanvasTextAlign) => void, right = true) {
  rows.slice(0, 8).forEach((r, i) => { const info = players.get(r.id); if (info) hudText(g, `${info.name} ${r.v}`, right ? W - 24 : 24, 40 + i * 28, 21, info.color, right ? 'right' : 'left'); });
}

// ---- drawn icons (no emoji): small vector helpers shared by all renderers ----
export function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number, full = true, color = '#ff4d6d') {
  g.save(); g.translate(x, y); g.scale(s / 20, s / 20);
  g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-14, -2, -9, -12, 0, -5); g.bezierCurveTo(9, -12, 14, -2, 0, 8); g.closePath();
  g.lineWidth = 2.5; g.strokeStyle = '#120a2a';
  if (full) { g.fillStyle = color; g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-5, -4, 2.6, 1.6, -0.6, 0, 7); g.fill(); } else { g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(); }
  g.stroke(); g.restore();
}
export function hearts(g: CanvasRenderingContext2D, x: number, y: number, hp: number, max: number, size = 15) {
  for (let i = 0; i < max; i++) heart(g, x + (i - (max - 1) / 2) * (size + 2), y, size, i < hp);
}
export function astronaut(g: CanvasRenderingContext2D, x: number, y: number, s: number, t = 0, tint = '#f1f5f9') {
  g.save(); g.translate(x, y + Math.sin(t * 2) * 2); g.scale(s / 20, s / 20); g.rotate(Math.sin(t * 1.3) * 0.2);
  g.fillStyle = tint; g.strokeStyle = '#120a2a'; g.lineWidth = 2.5;
  g.beginPath(); g.roundRect(-9, -2, 18, 17, 6); g.fill(); g.stroke(); // body
  g.beginPath(); g.arc(0, -9, 10, 0, 7); g.fill(); g.stroke(); // helmet
  g.fillStyle = '#38bdf8'; g.beginPath(); g.roundRect(-6.5, -13, 13, 9, 4); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-2.5, -11, 2, 1.2, -0.5, 0, 7); g.fill();
  g.fillStyle = '#f97316'; g.fillRect(-4, 4, 8, 5); // chest panel
  g.restore();
}
/** Little 5-point star. */
export function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill = '#ffd23f') {
  g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath();
  g.fillStyle = fill; g.fill(); g.strokeStyle = '#120a2a'; g.lineWidth = 2; g.stroke();
}
