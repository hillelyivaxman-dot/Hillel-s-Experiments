import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n';

/** Wheel response curve: a little finer around the centre, full at the lock. */
export const expo = (v: number) => Math.sign(v) * Math.pow(Math.min(1, Math.abs(v)), 1.25);

const LOCK = (115 * Math.PI) / 180; // wheel rotation (rad) that gives full steering lock
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function WheelArt({ angle, size, active }: { angle: number; size: number; active?: boolean }) {
  return (
    <div className={`wheel ${active ? 'is-active' : ''}`} style={{ width: size, height: size, transform: `rotate(${angle}rad)` }}>
      <div className="wheel__ring" />
      <i className="wheel__spoke wheel__spoke--l" /><i className="wheel__spoke wheel__spoke--r" /><i className="wheel__spoke wheel__spoke--b" />
      <div className="wheel__hub" />
      <div className="wheel__notch" />
    </div>
  );
}

interface Region { x: number; y: number; w: number; h: number }
const wheelSize = (r: Region) => Math.round(Math.max(120, Math.min(r.w * 0.94, r.h * 0.86, 280)));

/** Virtual steering wheel: put a finger anywhere on it and rotate. Releasing snaps it back to centre. */
export function Wheel({ region, onSteer, releasers }: { region: Region; onSteer: (v: number) => void; releasers: Set<() => void> }) {
  const zone = useRef<HTMLDivElement>(null);
  const [angle, setAngle] = useState(0);
  const st = useRef({ id: null as number | null, last: 0, angle: 0, raf: 0 });
  const size = wheelSize(region);
  const cb = useRef(onSteer);
  cb.current = onSteer;

  const center = () => {
    const r = zone.current!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const release = () => {
    const s = st.current;
    if (s.id === null && s.angle === 0) return;
    s.id = null;
    cb.current(0);
    cancelAnimationFrame(s.raf);
    const from = s.angle, t0 = performance.now(); // spring back to centre (visual only)
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 180);
      s.angle = from * (1 - (1 - Math.pow(1 - k, 3)));
      setAngle(s.angle);
      if (k < 1) s.raf = requestAnimationFrame(step); else { s.angle = 0; setAngle(0); }
    };
    s.raf = requestAnimationFrame(step);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = st.current;
      if (e.pointerId !== s.id) return;
      const c = center();
      const dx = e.clientX - c.x, dy = e.clientY - c.y;
      if (Math.hypot(dx, dy) < size * 0.12) return; // too close to the hub to define an angle
      const a = Math.atan2(dy, dx);
      s.angle = Math.max(-LOCK, Math.min(LOCK, s.angle + wrap(a - s.last)));
      s.last = a;
      setAngle(s.angle);
      cb.current(Math.round(expo(s.angle / LOCK) * 100) / 100);
    };
    const end = (e: PointerEvent) => { if (e.pointerId === st.current.id) release(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    releasers.add(release);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      releasers.delete(release);
      cancelAnimationFrame(st.current.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, releasers]);

  return (
    <div
      className="stick-zone wheel-zone"
      ref={zone}
      data-steer="wheel"
      style={{ left: region.x, top: region.y, width: region.w, height: region.h }}
      onPointerDown={(e) => {
        const s = st.current;
        if (s.id !== null) return;
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* window listeners still track it */ }
        cancelAnimationFrame(s.raf);
        s.id = e.pointerId;
        const c = center();
        s.last = Math.atan2(e.clientY - c.y, e.clientX - c.x); // grab: the wheel turns relative to where you touched
      }}
    >
      <div className="wheel-wrap"><WheelArt angle={angle} size={size} active={st.current.id !== null} /></div>
    </div>
  );
}

/** Two big pads: hold left or right (the server ramps the steering in smoothly). */
export function ArrowSteer({ region, onSteer, releasers }: { region: Region; onSteer: (v: number) => void; releasers: Set<() => void> }) {
  const held = useRef({ l: false, r: false });
  const [, force] = useState(0);
  const apply = () => { onSteer((held.current.r ? 1 : 0) - (held.current.l ? 1 : 0)); force((n) => n + 1); };
  useEffect(() => {
    const reset = () => { held.current = { l: false, r: false }; apply(); };
    releasers.add(reset);
    return () => { releasers.delete(reset); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releasers]);
  const pad = (side: 'l' | 'r') => {
    const ids = new Set<number>();
    const set = (on: boolean) => { held.current[side] = on; apply(); };
    return {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } if (!ids.size) set(true); ids.add(e.pointerId); },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => { ids.delete(e.pointerId); if (!ids.size) set(false); },
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => { ids.delete(e.pointerId); if (!ids.size) set(false); },
      onLostPointerCapture: (e: React.PointerEvent<HTMLElement>) => { ids.delete(e.pointerId); if (!ids.size) set(false); },
    };
  };
  return (
    <div className="arrow-steer" data-steer="arrows" style={{ left: region.x, top: region.y, width: region.w, height: region.h }}>
      <button className={`arrow-btn ${held.current.l ? 'is-down' : ''}`} data-btn="L" aria-label="left" {...pad('l')}>◀</button>
      <button className={`arrow-btn ${held.current.r ? 'is-down' : ''}`} data-btn="R" aria-label="right" {...pad('r')}>▶</button>
    </div>
  );
}

type MotionCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/** Phone tilt = steering, like a real wheel (landscape). Needs a sensor; iPhone asks for permission on a tap. */
export function TiltSteer({ region, onSteer, invert, releasers }: { region: Region; onSteer: (v: number) => void; invert: boolean; releasers: Set<() => void> }) {
  const { t } = useT();
  const needsPermission = typeof (window.DeviceMotionEvent as MotionCtor | undefined)?.requestPermission === 'function';
  const [state, setState] = useState<'idle' | 'asking' | 'live' | 'nosensor' | 'denied'>(needsPermission ? 'idle' : 'asking');
  const [angle, setAngle] = useState(0);
  const zero = useRef<number | null>(null);
  const live = useRef(false);

  useLayoutEffect(() => {
    if (state !== 'asking' && state !== 'live') return;
    const timer = window.setTimeout(() => { if (!live.current) setState('nosensor'); }, 2000);
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null) return;
      // gravity in screen coordinates, whatever the rotation of the phone
      const rot = ((screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) + 360) % 360;
      const [sx, sy] = rot === 90 ? [-g.y, g.x] : rot === 270 ? [g.y, -g.x] : rot === 180 ? [-g.x, -g.y] : [g.x, g.y];
      const roll = Math.atan2(sx, sy); // 0 when the phone is held upright
      if (zero.current === null) zero.current = roll; // calibrate to however the phone is held right now
      let d = roll - zero.current;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const steer = Math.max(-1, Math.min(1, (-d * (invert ? -1 : 1)) / 0.6)); // 35 degrees = full lock
      const dead = Math.abs(steer) < 0.06 ? 0 : steer;
      live.current = true;
      setState('live');
      setAngle(-d * (invert ? -1 : 1) * 1.6);
      onSteer(Math.round(expo(dead) * 100) / 100);
    };
    window.addEventListener('devicemotion', onMotion);
    const reset = () => onSteer(0);
    releasers.add(reset);
    return () => { clearTimeout(timer); window.removeEventListener('devicemotion', onMotion); releasers.delete(reset); onSteer(0); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state === 'asking' || state === 'live', invert]);

  const enable = async () => {
    try {
      const r = await (window.DeviceMotionEvent as MotionCtor).requestPermission!();
      setState(r === 'granted' ? 'asking' : 'denied');
    } catch { setState('denied'); }
  };
  const size = wheelSize(region);
  return (
    <div className="stick-zone wheel-zone tilt-zone" data-steer="tilt" style={{ left: region.x, top: region.y, width: region.w, height: region.h }}>
      <div className="wheel-wrap"><WheelArt angle={angle} size={size} /></div>
      <div className="tilt-msg">
        {state === 'idle' && <button className="btn btn--secondary" onClick={enable} data-testid="tilt-enable">{t('tiltEnable')}</button>}
        {state === 'live' && <button className="chip" onClick={() => { zero.current = null; }} data-testid="tilt-calibrate">{t('tiltCalibrate')}</button>}
        {state === 'nosensor' && <span className="warn small">{t('tiltNone')}</span>}
        {state === 'denied' && <span className="warn small">{t('tiltDenied')}</span>}
      </div>
    </div>
  );
}
