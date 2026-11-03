import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ControllerButton, ControllerLayout } from '../../../shared/catalog';
import { BTN } from '../../../shared/protocol';
import { useT } from '../i18n';
import type { Conn } from '../net';
import { PadIcon } from './icons';
import { ArrowSteer, TiltSteer, Wheel } from './steering';
import { computeLayout, stickVector, type Circle } from './layout';
import type { PadSettings } from './settings';

// Monotonic across Pad mounts: the server drops inputs whose seq is not newer than the last one.
let seqCounter = Date.now() % 100000;
const STICK_SEND_MS = 16; // stick updates are coalesced to ~60/s; button changes are sent immediately

/**
 * Phone controller.
 * - Layout is computed from the real measured pad area (not vh), so nothing can be pushed off-screen.
 * - Every control tracks its own pointer ids; pointer up/cancel are watched on window, so a finger that
 *   slides off a control still releases it. Stick and button touches are independent (multi-touch).
 * - When the page is hidden (screen lock, app switch) or loses focus, all inputs are released at once.
 * - Keyboard for desktop testing: WASD/arrows = stick, Space/J = A, K = B, L = C, I = D.
 */
export function Pad({ layout, conn, settings }: { layout: ControllerLayout; conn: Conn; settings: PadSettings }) {
  const root = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const state = useRef({ x: 0, y: 0, b: 0 });
  const lastSent = useRef(0);
  const pending = useRef(0);
  const releasers = useRef(new Set<() => void>());

  const flush = () => {
    clearTimeout(pending.current);
    pending.current = 0;
    lastSent.current = performance.now();
    const s = state.current;
    conn.send({ t: 'input', s: ++seqCounter, x: s.x, y: s.y, b: s.b });
  };
  const stickChanged = () => {
    const since = performance.now() - lastSent.current;
    if (since >= STICK_SEND_MS) flush();
    else if (!pending.current) pending.current = window.setTimeout(flush, STICK_SEND_MS - since);
  };

  // measure the real pad area (handles dynamic browser bars, rotation, split screen, keyboard)
  useLayoutEffect(() => {
    const el = root.current!;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setArea((a) => (Math.abs(a.w - r.width) < 1 && Math.abs(a.h - r.height) < 1 ? a : { w: r.width, h: r.height }));
    };
    // some mobile browsers report the final size a frame or two after 'resize': measure again then
    let raf = 0;
    const later = () => { measure(); cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { measure(); raf = requestAnimationFrame(measure); }); };
    measure();
    const ro = new ResizeObserver(later);
    ro.observe(el);
    window.addEventListener('resize', later);
    window.addEventListener('orientationchange', later);
    window.visualViewport?.addEventListener('resize', later);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', later);
      window.removeEventListener('orientationchange', later);
      window.visualViewport?.removeEventListener('resize', later);
    };
  }, []);

  useEffect(() => {
    const keep = setInterval(flush, 250);
    const keys = new Set<string>();
    const map: Record<string, number> = { Space: BTN.A, KeyJ: BTN.A, Enter: BTN.A, KeyK: BTN.B, KeyL: BTN.C, KeyI: BTN.D };
    const apply = () => {
      const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const y = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      let b = 0;
      for (const k of keys) b |= map[k] ?? 0;
      const len = Math.hypot(x, y) || 1;
      const prevB = state.current.b;
      state.current = { x: Math.round((x / len) * 100) / 100, y: Math.round((y / len) * 100) / 100, b };
      if (b !== prevB) flush(); else stickChanged();
    };
    const down = (e: KeyboardEvent) => { if (e.repeat) return; keys.add(e.code); apply(); };
    const up = (e: KeyboardEvent) => { keys.delete(e.code); apply(); };
    // screen lock / app switch / tab hidden: no "pointerup" will ever come, so release everything now
    const releaseAll = () => {
      keys.clear();
      for (const r of [...releasers.current]) r();
      state.current = { x: 0, y: 0, b: 0 };
      flush();
    };
    const onVis = () => { if (document.visibilityState !== 'visible') releaseAll(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', releaseAll);
    window.addEventListener('pagehide', releaseAll);
    document.addEventListener('visibilitychange', onVis);
    // belt and braces against page scroll / rubber-banding while a finger is on the pad (old iOS)
    const noScroll = (e: TouchEvent) => { if (root.current?.contains(e.target as Node)) e.preventDefault(); };
    document.addEventListener('touchmove', noScroll, { passive: false });
    return () => {
      clearInterval(keep);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', releaseAll);
      window.removeEventListener('pagehide', releaseAll);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('touchmove', noScroll);
      releaseAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn]);

  const setStick = (x: number, y: number) => {
    if (x === state.current.x && y === state.current.y) return;
    state.current = { ...state.current, x, y };
    stickChanged();
  };
  const setBtn = (bit: number, on: boolean) => {
    const b = on ? state.current.b | bit : state.current.b & ~bit;
    if (b === state.current.b) return;
    state.current = { ...state.current, b };
    if (on) navigator.vibrate?.(10);
    flush(); // button edges go out immediately (lowest latency)
  };

  // racing: steering comes from the wheel / arrows / tilt and is sent as x; y stays 0
  const setSteer = (x: number) => {
    if (x === state.current.x && state.current.y === 0) return;
    state.current = { ...state.current, x, y: 0 };
    stickChanged();
  };

  const L = useMemo(() => {
    if ((layout.kind !== 'stick' && layout.kind !== 'wheel') || !area.w) return null;
    return computeLayout({ w: area.w, h: area.h, buttons: layout.buttons.length, style: layout.style, size: settings.size, mirrored: settings.mirrored, stick: true });
  }, [layout, area.w, area.h, settings.size, settings.mirrored]);

  return (
    <div className={`pad pad--${layout.kind}`} ref={root} onContextMenu={(e) => e.preventDefault()} data-w={Math.round(area.w)} data-h={Math.round(area.h)}>
      {layout.kind === 'stick' && L && (
        <>
          <Stick region={L.stickRegion!} rest={L.stickRest} radius={L.stickRadius} onChange={setStick} releasers={releasers.current} />
          {layout.buttons.map((b, i) => <PadButton key={b.key} b={b} c={L.buttons[i]} primary={i === 0} onChange={setBtn} releasers={releasers.current} />)}
        </>
      )}
      {layout.kind === 'wheel' && L && (
        <>
          {settings.steer === 'wheel' && <Wheel region={L.stickRegion!} onSteer={setSteer} releasers={releasers.current} />}
          {settings.steer === 'arrows' && <ArrowSteer region={L.stickRegion!} onSteer={setSteer} releasers={releasers.current} />}
          {settings.steer === 'tilt' && <TiltSteer region={L.stickRegion!} onSteer={setSteer} invert={settings.tiltInvert} releasers={releasers.current} />}
          {layout.buttons.map((b, i) => <PadButton key={b.key} b={b} c={L.buttons[i]} primary={i === 0} onChange={setBtn} releasers={releasers.current} />)}
        </>
      )}
      {layout.kind === 'tap' && area.w > 0 && (
        <PadButton b={layout.button} c={{ x: area.w / 2, y: area.h / 2, r: Math.min(area.w, area.h) * 0.4 }} primary huge onChange={setBtn} releasers={releasers.current} />
      )}
      {layout.kind === 'choices' && (
        <div className="pad__choices">
          {(['A', 'B', 'C', 'D'] as const).slice(0, layout.count).map((k, i) => (
            <PadButton key={k} b={{ key: k, label: { he: '', en: '' }, color: ['#ff4d6d', '#3ec1ff', '#ffd23f', '#5dfc8d'][i] }} onChange={setBtn} releasers={releasers.current} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Tracks pointers on one element; releases on up/cancel anywhere (window) and on releaseAll. */
function usePointerHold(onChange: (down: boolean) => void, releasers: Set<() => void>) {
  const ids = useRef(new Set<number>());
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const end = (e: PointerEvent) => {
      if (!ids.current.delete(e.pointerId)) return;
      if (ids.current.size === 0) cb.current(false);
    };
    const reset = () => { if (ids.current.size) { ids.current.clear(); cb.current(false); } };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    releasers.add(reset);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      releasers.delete(reset);
      reset();
    };
  }, [releasers]);
  return (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* window listeners still release it */ }
    if (ids.current.size === 0) cb.current(true);
    ids.current.add(e.pointerId);
  };
}

function PadButton({ b, c, primary = false, huge = false, onChange, releasers }: {
  b: ControllerButton; c?: Circle; primary?: boolean; huge?: boolean;
  onChange: (bit: number, on: boolean) => void; releasers: Set<() => void>;
}) {
  const { l } = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const bit = BTN[b.key];
  const down = usePointerHold((on) => {
    ref.current?.classList.toggle('is-down', on);
    onChange(bit, on);
  }, releasers);
  const style: Record<string, string | number> = { ['--bc']: b.color };
  if (c) Object.assign(style, { left: c.x - c.r, top: c.y - c.r, width: c.r * 2, height: c.r * 2, ['--d']: `${c.r * 2}px` });
  return (
    <button
      ref={ref}
      className={`pad-btn ${primary ? 'pad-btn--primary' : ''} ${huge ? 'pad-btn--huge' : ''} ${c ? 'pad-btn--placed' : ''}`}
      style={style}
      data-btn={b.key}
      aria-label={l(b.label)}
      onPointerDown={down}
    >
      <PadIcon id={b.icon} />
      <span className="pad-btn__label">{l(b.label)}</span>
    </button>
  );
}

function Stick({ region, rest, radius, onChange, releasers }: {
  region: { x: number; y: number; w: number; h: number }; rest: { x: number; y: number }; radius: number;
  onChange: (x: number, y: number) => void; releasers: Set<() => void>;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 }); // client coords of the base centre
  const cb = useRef(onChange);
  cb.current = onChange;

  // idle position (relative to the zone)
  const restX = rest.x - region.x, restY = rest.y - region.y;
  useLayoutEffect(() => {
    if (active.current === null && base.current) base.current.style.transform = `translate(${restX - radius}px, ${restY - radius}px)`;
  }, [restX, restY, radius]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerId !== active.current) return;
      let dx = e.clientX - origin.current.x, dy = e.clientY - origin.current.y;
      const d = Math.hypot(dx, dy);
      const max = radius * 1.1;
      if (d > max) {
        // the base follows the thumb so a long hold in one direction never "falls off" the stick
        origin.current.x += (dx / d) * (d - max);
        origin.current.y += (dy / d) * (d - max);
        placeBase();
        dx = (dx / d) * max; dy = (dy / d) * max;
      }
      const kd = Math.min(Math.hypot(dx, dy), radius);
      const ka = Math.atan2(dy, dx);
      knob.current!.style.transform = `translate(${Math.cos(ka) * kd}px, ${Math.sin(ka) * kd}px)`;
      const v = stickVector(dx, dy, radius);
      base.current!.style.setProperty('--mag', String(Math.hypot(v.x, v.y)));
      base.current!.style.setProperty('--ang', `${ka}rad`);
      cb.current(v.x, v.y);
    };
    const end = (e: PointerEvent) => { if (e.pointerId === active.current) release(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    releasers.add(release);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      releasers.delete(release);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, releasers]);

  function placeBase() {
    const z = zone.current!.getBoundingClientRect();
    base.current!.style.transform = `translate(${origin.current.x - z.left - radius}px, ${origin.current.y - z.top - radius}px)`;
  }
  function release() {
    if (active.current === null) return;
    active.current = null;
    knob.current!.style.transform = 'translate(0px, 0px)';
    base.current!.classList.remove('is-active');
    base.current!.style.setProperty('--mag', '0');
    base.current!.style.transform = `translate(${restX - radius}px, ${restY - radius}px)`;
    zone.current?.removeAttribute('data-active');
    cb.current(0, 0);
  }

  return (
    <div
      className="stick-zone"
      ref={zone}
      style={{ left: region.x, top: region.y, width: region.w, height: region.h }}
      onPointerDown={(e) => {
        if (active.current !== null) return; // a second finger in the stick area is ignored
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* window listeners still track it */ }
        active.current = e.pointerId;
        const z = zone.current!.getBoundingClientRect();
        // keep the whole base on screen even when the thumb lands near an edge
        origin.current = {
          x: Math.max(z.left + radius + 4, Math.min(z.right - radius - 4, e.clientX)),
          y: Math.max(z.top + radius + 4, Math.min(z.bottom - radius - 4, e.clientY)),
        };
        placeBase();
        base.current!.classList.add('is-active');
        zone.current!.setAttribute('data-active', '1');
        // a touch away from the clamped centre already counts as a deflection
        const dx = e.clientX - origin.current.x, dy = e.clientY - origin.current.y;
        if (dx || dy) {
          const v = stickVector(dx, dy, radius);
          knob.current!.style.transform = `translate(${dx}px, ${dy}px)`;
          cb.current(v.x, v.y);
        }
      }}
    >
      <div className="stick-base" ref={base} style={{ width: radius * 2, height: radius * 2 }}>
        <div className="stick-base__arrow" />
        <div className="stick-knob" ref={knob} style={{ width: radius * 1.05, height: radius * 1.05 }} />
      </div>
    </div>
  );
}
