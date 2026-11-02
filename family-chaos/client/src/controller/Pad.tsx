import { useEffect, useRef } from 'react';
import type { ControllerButton, ControllerLayout } from '../../../shared/catalog';
import { BTN } from '../../../shared/protocol';
import { useT } from '../i18n';
import type { Conn } from '../net';

// Monotonic across Pad mounts: the server drops inputs whose seq is not newer than the last one.
let seqCounter = Date.now() % 100000;

/**
 * Phone controller. Sends {x, y, b} on change (max ~30/s) plus a keep-alive.
 * Multi-touch: every control tracks its own pointer id, so stick + buttons work together.
 * Keyboard (desktop testing): WASD/arrows = stick, Space/J = A, K = B, L = C, I = D.
 */
export function Pad({ layout, conn }: { layout: ControllerLayout; conn: Conn }) {
  const state = useRef({ x: 0, y: 0, b: 0 });
  const lastSent = useRef(0);
  const pending = useRef(0);

  const flush = () => {
    pending.current = 0;
    lastSent.current = performance.now();
    const s = state.current;
    conn.send({ t: 'input', s: ++seqCounter, x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 100) / 100, b: s.b });
  };
  const changed = () => {
    const since = performance.now() - lastSent.current;
    if (since >= 33) flush();
    else if (!pending.current) pending.current = window.setTimeout(flush, 33 - since);
  };

  useEffect(() => {
    const keep = setInterval(flush, 300);
    const keys = new Set<string>();
    const map: Record<string, number> = { Space: BTN.A, KeyJ: BTN.A, Enter: BTN.A, KeyK: BTN.B, KeyL: BTN.C, KeyI: BTN.D };
    const apply = () => {
      const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const y = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      let b = 0;
      for (const k of keys) b |= map[k] ?? 0;
      const len = Math.hypot(x, y) || 1;
      state.current = { x: x / len, y: y / len, b };
      changed();
    };
    const down = (e: KeyboardEvent) => { if (e.repeat) return; keys.add(e.code); apply(); };
    const up = (e: KeyboardEvent) => { keys.delete(e.code); apply(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      clearInterval(keep);
      clearTimeout(pending.current);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      state.current = { x: 0, y: 0, b: 0 };
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn]);

  const setStick = (x: number, y: number) => { state.current = { ...state.current, x, y }; changed(); };
  const setBtn = (bit: number, on: boolean) => {
    const b = on ? state.current.b | bit : state.current.b & ~bit;
    if (b === state.current.b) return;
    state.current = { ...state.current, b };
    if (on) navigator.vibrate?.(12);
    changed();
  };

  return (
    <div className={`pad pad--${layout.kind}`} onContextMenu={(e) => e.preventDefault()}>
      {layout.kind === 'stick' && (
        <>
          <Stick onChange={setStick} />
          <div className={`pad__buttons pad__buttons--${layout.buttons.length}`}>
            {layout.buttons.map((b) => <PadButton key={b.key} b={b} onChange={setBtn} />)}
          </div>
        </>
      )}
      {layout.kind === 'tap' && <PadButton b={layout.button} onChange={setBtn} huge />}
      {layout.kind === 'choices' && (
        <div className="pad__choices">
          {(['A', 'B', 'C', 'D'] as const).slice(0, layout.count).map((k, i) => (
            <PadButton key={k} b={{ key: k, label: { he: '', en: '' }, color: ['#ff4d6d', '#3ec1ff', '#ffd23f', '#5dfc8d'][i] }} onChange={setBtn} />
          ))}
        </div>
      )}
    </div>
  );
}

function PadButton({ b, onChange, huge = false }: { b: ControllerButton; onChange: (bit: number, on: boolean) => void; huge?: boolean }) {
  const { l } = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const bit = BTN[b.key];
  const set = (on: boolean) => {
    ref.current?.classList.toggle('is-down', on);
    onChange(bit, on);
  };
  return (
    <button
      ref={ref}
      className={`pad-btn ${b.big ? 'pad-btn--big' : ''} ${huge ? 'pad-btn--huge' : ''}`}
      style={{ ['--bc' as string]: b.color }}
      data-btn={b.key}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); set(true); }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
    >
      {l(b.label)}
    </button>
  );
}

function Stick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const zone = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const R = 64;
  useEffect(() => {
    const z = zone.current!.getBoundingClientRect();
    place(z.left + z.width / 2, z.top + z.height * 0.55);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const place = (cx: number, cy: number) => {
    const z = zone.current!.getBoundingClientRect();
    base.current!.style.transform = `translate(${cx - z.left - R}px, ${cy - z.top - R}px)`;
  };
  const reset = () => {
    active.current = null;
    knob.current!.style.transform = 'translate(0px, 0px)';
    base.current!.classList.remove('is-active');
    onChange(0, 0);
  };

  return (
    <div
      className="stick-zone"
      ref={zone}
      onPointerDown={(e) => {
        if (active.current !== null) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        origin.current = { x: e.clientX, y: e.clientY };
        place(e.clientX, e.clientY);
        base.current!.classList.add('is-active');
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== active.current) return;
        let dx = e.clientX - origin.current.x, dy = e.clientY - origin.current.y;
        const d = Math.hypot(dx, dy);
        if (d > R) {
          // drag the base along so the stick never "sticks" at the edge
          origin.current.x += (dx / d) * (d - R);
          origin.current.y += (dy / d) * (d - R);
          place(origin.current.x, origin.current.y);
          dx = (dx / d) * R; dy = (dy / d) * R;
        }
        knob.current!.style.transform = `translate(${dx}px, ${dy}px)`;
        let nx = dx / R, ny = dy / R;
        if (Math.hypot(nx, ny) < 0.12) { nx = 0; ny = 0; }
        onChange(nx, ny);
      }}
      onPointerUp={(e) => { if (e.pointerId === active.current) reset(); }}
      onPointerCancel={(e) => { if (e.pointerId === active.current) reset(); }}
    >
      <div className="stick-base" ref={base}><div className="stick-knob" ref={knob} /></div>
    </div>
  );
}
