// Canvas drawing of the shared icon set (shared/icons.ts) + text with inline `:icon:` tokens.
import { EMOJI_TO_TOKEN, ICONS, ICON_TOKEN } from '../../../shared/icons';

const paths = new Map<string, Path2D>();
const path = (d: string) => { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); } return p; };

/** Draws icon `name` centred at (x, y), `size` px wide. Returns false when the name is unknown. */
export function drawIcon(g: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, rot = 0): boolean {
  const layers = ICONS[name];
  if (!layers) return false;
  g.save();
  g.translate(x, y); if (rot) g.rotate(rot);
  const k = size / 24; g.scale(k, k); g.translate(-12, -12);
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const l of layers) {
    const p = path(l.d);
    if (l.o !== undefined) g.globalAlpha = l.o;
    if (l.f) { g.fillStyle = l.f; g.fill(p); }
    if (l.s) { g.strokeStyle = l.s; g.lineWidth = l.w ?? 1.3; g.stroke(p); }
  }
  g.restore();
  return true;
}

/** Old call sites passed an emoji character; we map it to the matching drawn icon. */
export function emojiIcon(g: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number): void {
  const name = EMOJI_TO_TOKEN[ch.replace(/️/g, '')];
  if (name) drawIcon(g, name, x, y, size * 1.15);
}

export interface Seg { text?: string; icon?: string }
export function splitTokens(text: string): Seg[] {
  const out: Seg[] = []; let last = 0;
  for (const m of text.matchAll(ICON_TOKEN)) {
    if (!ICONS[m[1]]) continue;
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ icon: m[1] }); last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
