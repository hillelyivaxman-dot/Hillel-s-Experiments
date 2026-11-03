// Small drawing helpers shared by the newer game renderers.
import type { PlayerInfo } from '../../../shared/protocol';
import { drawCritter, nameTag } from './critter';

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
export function emoji(g: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number) {
  g.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y);
}
/** Scoreboard in the corner, sorted by `key`. */
export function scoreboard(g: CanvasRenderingContext2D, rows: { id: string; v: number | string }[], players: Map<string, PlayerInfo>, W: number, hudText: (g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color?: string, align?: CanvasTextAlign) => void, right = true) {
  rows.slice(0, 8).forEach((r, i) => { const info = players.get(r.id); if (info) hudText(g, `${info.name} ${r.v}`, right ? W - 24 : 24, 40 + i * 28, 21, info.color, right ? 'right' : 'left'); });
}
