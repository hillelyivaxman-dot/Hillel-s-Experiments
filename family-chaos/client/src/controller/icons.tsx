// Original, consistent controller glyphs (single-colour, 24x24 grid, round joins).
const P: Record<string, string> = {
  dash: 'M4 6l7 6-7 6M12 6l7 6-7 6',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
  dodge: 'M5 17c0-6 4-10 10-10M11 3l4 4-4 4M19 13v6M16 16h6',
  gas: 'M12 20V5M6 11l6-6 6 6',
  brake: 'M7 5v14M17 5v14',
  turbo: 'M13 2L5 14h6l-2 8 9-13h-6z',
  item: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  throw: 'M4 18c3-9 9-13 16-12M16 3l4 3-3 4',
  jump: 'M12 19V7M7 12l5-5 5 5M6 21h12',
  shove: 'M4 12h11M10 6l6 6-6 6M19 5v14',
  tap: 'M12 2v4M4.9 4.9l2.8 2.8M2 12h4M19.1 4.9l-2.8 2.8M22 12h-4M12 22a6 6 0 100-12 6 6 0 000 12z',
};

export function PadIcon({ id }: { id?: string }) {
  if (!id || !P[id]) return null;
  return (
    <svg className="pad-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={P[id]} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
