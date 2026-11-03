import { Fragment } from 'react';
import { ICONS, ICON_TOKEN } from '../../../shared/icons';

/** Inline SVG from the shared icon set (the same art the canvas renderers draw). */
export function Icon({ name, size = '1.15em', title }: { name: string; size?: string | number; title?: string }) {
  const layers = ICONS[name];
  if (!layers) return null;
  return (
    <svg className="ico" viewBox="0 0 24 24" width={size} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ verticalAlign: '-0.2em', flex: 'none' }}>
      {layers.map((l, i) => <path key={i} d={l.d} fill={l.f ?? 'none'} stroke={l.s ?? 'none'} strokeWidth={l.w ?? 1.3} strokeLinejoin="round" strokeLinecap="round" opacity={l.o} />)}
    </svg>
  );
}

/** Text with `:icon:` tokens (server results, phone HUD lines) rendered with inline icons. */
export function Rich({ text }: { text: string }) {
  if (!text.includes(':')) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let last = 0, k = 0;
  for (const m of text.matchAll(ICON_TOKEN)) {
    if (!ICONS[m[1]]) continue;
    if (m.index! > last) out.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    out.push(<Icon key={k++} name={m[1]} />);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return <>{out}</>;
}
