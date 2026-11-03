import type { Lang, PlayerInfo } from '../../../shared/protocol';
import type { FX } from './fx';
import { drawIcon, splitTokens } from './icons';

export interface RenderInfo {
  players: Map<string, PlayerInfo>;
  t: number; // seconds since stage mounted
  lang: Lang;
  fx: FX;
}

/** Client side of a game: draws server snapshots. No game rules live here. */
export interface Renderer {
  world: { x: number; y: number; w: number; h: number };
  background: (g: CanvasRenderingContext2D, W: number, H: number, t: number) => void;
  draw(g: CanvasRenderingContext2D, f: any, info: RenderInfo): void; // world coordinates
  hud?(g: CanvasRenderingContext2D, f: any, info: RenderInfo, W: number, H: number): void; // screen pixels
  event?(e: any, f: any, info: RenderInfo): void;
}

export function hudText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center') {
  g.font = `900 ${size}px Rubik, system-ui, sans-serif`;
  g.textBaseline = 'middle';
  g.lineWidth = Math.max(4, size / 7);
  g.strokeStyle = 'rgba(10,5,30,0.9)';
  g.lineJoin = 'round';
  const segs = text.includes(':') ? splitTokens(text) : [{ text }];
  if (segs.length === 1 && segs[0].text !== undefined) { // plain text (the common case)
    g.textAlign = align; g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y); return;
  }
  const iw = size * 1.05, widths = segs.map((s) => (s.icon ? iw : g.measureText(s.text ?? '').width));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' || align === 'end' ? x - total : x;
  g.textAlign = 'left';
  segs.forEach((s, i) => {
    if (s.icon) drawIcon(g, s.icon, cx + iw / 2, y, size * 0.95);
    else { g.strokeText(s.text!, cx, y); g.fillStyle = color; g.fillText(s.text!, cx, y); }
    cx += widths[i];
  });
}

export function starfield(g: CanvasRenderingContext2D, W: number, H: number, t: number, top = '#1b0f45', bottom = '#07031a') {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 70; i++) {
    const x = ((i * 9301 + 49297) % 233280) / 233280 * W;
    const y = ((i * 7919 + 1237) % 104729) / 104729 * H;
    const s = 1 + ((i * 13) % 3);
    g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + i));
    g.fillRect(x, y, s, s);
  }
  g.globalAlpha = 1;
}
