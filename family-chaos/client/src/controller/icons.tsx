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
  hand: 'M7 12V6.5a1.5 1.5 0 013 0V11M10 10V5a1.5 1.5 0 013 0v6M13 11V6a1.5 1.5 0 013 0v7M16 12.5V9.5a1.5 1.5 0 013 0V15c0 4-3 6-6.5 6S6 18.5 6 15v-2',
  chop: 'M4 20L15 9M11 4l9 9-3.5 3.5-9-9z',
  dice: 'M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01',
  kick: 'M5 17l4-9 5 2-2 6zM14 10l4-3M16 19a2 2 0 100-4 2 2 0 000 4z',
  shove: 'M4 12h11M10 6l6 6-6 6M19 5v14',
  fire: 'M12 3v5M12 16v5M3 12h5M16 12h5M12 12h.01M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2',
  shield: 'M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z',
  blink: 'M3 12h5M12 12h9M17 7l4 5-4 5',
  bank: 'M5 10h14v10H5zM8 10V6h8v4',
  dig: 'M4 20l9-9M13 4l7 7-3 3-7-7zM4 20l3-1',
  mine: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 3v3M12 18v3M3 12h3M18 12h3',
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
