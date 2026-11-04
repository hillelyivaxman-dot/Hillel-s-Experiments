import { useEffect, useRef, useState } from 'react';
import type { PlayerInfo } from '../../../shared/protocol';
import { getTrack } from '../../../shared/tracks';
import { useT } from '../i18n';
import { store, type Conn } from '../net';
import type { CamMode, CarView, KartScene, Who } from '../render3d/kartScene';
import { sfx } from '../sound';
import { Icon } from './icons';

interface Snap { at: number; f: any }
const INTERP_MS = 110; // other cars are drawn 110 ms in the past so they move smoothly between 20 Hz snapshots

const lerpAng = (a: number, b: number, t: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const toView = (c: any): CarView => ({ id: c.id, x: c.x, y: c.y, a: c.a, v: c.v ?? 0, st: c.st ?? 0, b: c.b ?? 0, s: c.s ?? 0, h: c.h ?? 0, ar: c.ar ?? 0, fin: c.fin ?? 0, dr: c.dr ?? 0 });

/**
 * Kart Chaos 3D view. On a phone it is the player's own screen (cockpit / bumper / chase camera + speedometer, lap, place and
 * mini map); on the host it is a broadcast with a spectator camera. The server owns the race: this component only draws it,
 * interpolating other cars and extrapolating (dead-reckoning) the player's own car between server snapshots.
 */
export function KartView({ conn, meId, players, cam, host = false, onCam }: { conn: Conn; meId: string | null; players: PlayerInfo[]; cam: CamMode; host?: boolean; onCam?: (m: CamMode) => void }) {
  const { l, lang } = useT();
  const wrap = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), mini = useRef<HTMLCanvasElement>(null);
  const scene = useRef<KartScene | null>(null);
  const snaps = useRef<Snap[]>([]);
  const who = useRef(new Map<string, Who>());
  const camRef = useRef(cam); camRef.current = cam;
  const [focus, setFocus] = useState<string | null>(meId);
  const focusRef = useRef<string | null>(focus); focusRef.current = focus;
  const [failed, setFailed] = useState(false);
  const [hud, setHud] = useState({ v: 0, lap: 1, laps: 3, place: 1, of: 1, turbo: 0, item: '', lapT: 0, last: 0, best: 0, end: -1, fin: 0, toast: '' });
  const hudRef = useRef(hud); hudRef.current = hud;
  const toastT = useRef(0);

  useEffect(() => { who.current = new Map(players.map((p) => [p.id, { name: p.name, color: p.color, avatar: p.avatar }])); }, [players]);
  useEffect(() => { if (!host) setFocus(meId); }, [meId, host]);

  useEffect(() => {
    let raf = 0, dead = false, last = performance.now(), trackId = -1, lapT0 = 0, lastLap = 0;
    const own = { x: 0, y: 0, a: 0, init: false };
    const shown = new Map<string, CarView>();
    let hudAt = 0, miniAt = 0;
    const toast = (s: string) => { toastT.current = performance.now(); setHud((h) => ({ ...h, toast: s })); };

    const off = conn.on((m) => {
      if (m.t !== 'frame' || m.g !== 'kart') return;
      const f = m.f as any, at = performance.now();
      ((window as unknown as { __fcKart?: Record<string, number> }).__fcKart ??= { frames: 0, calls: 0, cars: 0 }).msgs = (((window as unknown as { __fcKart: Record<string, number> }).__fcKart.msgs ?? 0) + 1); // test hook
      snaps.current.push({ at, f }); if (snaps.current.length > 6) snaps.current.shift();
      if (trackId !== f.tr && !scene.current && !dead) { trackId = f.tr; if (store.get('fc.no3d') === '1') { setFailed(true); } else start(f.tr); }
      for (const e of f.ev ?? []) {
        const fo = focusRef.current, S = scene.current;
        if (e.id && e.id === fo) {
          if (e.k === 'lap') { toast(`${l({ he: 'הקפה', en: 'LAP' })} ${e.lap}`); sfx.coin(); lapT0 = f.t; lastLap = e.lt; }
          else if (e.k === 'finish') { toast(`${l({ he: 'סיימתם', en: 'FINISH' })} #${e.place}`); sfx.win(); }
          else if (e.k === 'boost' || e.k === 'pad') { S?.blink(0.25); sfx.boost(); }
          else if (e.k === 'spin') { S?.kick(9); sfx.bad(); }
          else if (e.k === 'shield') sfx.power();
          else if (e.k === 'oil') sfx.pass();
        }
        if (e.k === 'wall' && S) { const me = shown.get(fo ?? ''); if (me && Math.hypot(me.x - e.x, me.y - e.y) < 120) { S.kick(5); S.burst(e.x, 6, e.y, 0xffd27a, 10, 220); sfx.bump(); } }
        if (e.k === 'bump' && S) { const me = shown.get(fo ?? ''); if (me && Math.hypot(me.x - e.x, me.y - e.y) < 120) { S.kick(4); S.burst(e.x, 10, e.y, 0xffffff, 8, 200); sfx.bump(); } }
        if (e.k === 'box' && S) S.burst(e.x, 16, e.y, 0xb26bff, 14, 200);
      }
    });

    async function start(tid: number) {
      try {
        const mod = await import('../render3d/kartScene');
        if (dead || !canvas.current) return;
        const q = (navigator.hardwareConcurrency ?? 4) <= 4 || window.innerWidth * window.devicePixelRatio > 2400 ? 'low' : 'high';
        const S = new mod.KartScene(canvas.current, tid, q);
        scene.current = S; S.resize();
        loop(performance.now());
      } catch (err) { console.warn('3D unavailable', err); setFailed(true); }
    }

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const S = scene.current, ss = snaps.current;
      if (!S || !ss.length) return;
      const latest = ss[ss.length - 1], prev = ss[ss.length - 2];
      const fo = focusRef.current ?? latest.f.ord?.[0] ?? latest.f.c[0]?.id;
      const renderAt = now - INTERP_MS;
      let a = ss[0], b = ss[ss.length - 1];
      for (let i = 0; i < ss.length - 1; i++) if (ss[i].at <= renderAt && ss[i + 1].at >= renderAt) { a = ss[i]; b = ss[i + 1]; break; }
      const k = b.at > a.at ? Math.max(0, Math.min(1, (renderAt - a.at) / (b.at - a.at))) : 1;
      const views: CarView[] = [];
      for (const cb of latest.f.c as any[]) {
        const ca = (a.f.c as any[]).find((q) => q.id === cb.id) ?? cb, cc = (b.f.c as any[]).find((q) => q.id === cb.id) ?? cb;
        let v: CarView;
        if (!host && cb.id === meId) {
          // own car: dead-reckon from the newest snapshot (position + speed along the heading, heading + yaw rate) and blend
          const e = Math.min(0.15, (now - latest.at) / 1000);
          const pc = prev ? (prev.f.c as any[]).find((q) => q.id === cb.id) : null;
          const dtS = prev ? Math.max(0.02, (latest.at - prev.at) / 1000) : 0.05;
          let yaw = 0; if (pc) { let d = cb.a - pc.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; yaw = Math.max(-4, Math.min(4, d / dtS)); }
          const ta = cb.a + yaw * e, tx = cb.x + Math.cos(cb.a) * (cb.v ?? 0) * e, ty = cb.y + Math.sin(cb.a) * (cb.v ?? 0) * e;
          if (!own.init || Math.hypot(own.x - tx, own.y - ty) > 140) { own.x = tx; own.y = ty; own.a = ta; own.init = true; }
          const bl = Math.min(1, 14 * dt);
          own.x += (tx - own.x) * bl; own.y += (ty - own.y) * bl; own.a = lerpAng(own.a, ta, bl);
          v = { ...toView(cb), x: own.x, y: own.y, a: own.a };
        } else {
          const near = Math.hypot(cc.x - ca.x, cc.y - ca.y) < 200;
          v = { ...toView(cc), x: near ? ca.x + (cc.x - ca.x) * k : cc.x, y: near ? ca.y + (cc.y - ca.y) * k : cc.y, a: lerpAng(ca.a, cc.a, k) };
        }
        shown.set(v.id, v); views.push(v);
      }
      S.mode = camRef.current;
      S.render(dt, views, who.current, fo ?? '', latest.f.oil ?? [], latest.f.bo ?? '');
      const dbg = ((window as unknown as { __fcKart?: { frames: number; calls: number; cars: number } }).__fcKart ??= { frames: 0, calls: 0, cars: 0 }); dbg.frames++; dbg.calls = S.renderer.info.render.calls; dbg.cars = views.length; // test hook
      const fv = shown.get(fo ?? '');
      // DOM HUD ~8x per second
      if (now - hudAt > 120 && fv) {
        hudAt = now;
        const c = (latest.f.c as any[]).find((q) => q.id === fo), ord: string[] = latest.f.ord ?? [];
        if (c) setHud((h) => ({ v: Math.round(Math.abs(c.v ?? 0) * 0.42), lap: c.lap, laps: latest.f.laps, place: ord.indexOf(fo!) + 1, of: ord.length, turbo: c.tb ?? 0, item: c.it ?? '', lapT: Math.max(0, latest.f.t - lapT0), last: c.lt ?? lastLap, best: c.bl ?? 0, end: latest.f.end ?? -1, fin: c.fin ?? 0, toast: now - toastT.current < 1600 ? h.toast : '' }));
      }
      if (now - miniAt > 100 && mini.current) { miniAt = now; drawMini(mini.current, trackId, views, fo ?? '', who.current); }
    }

    const ro = new ResizeObserver(() => scene.current?.resize());
    if (wrap.current) ro.observe(wrap.current);
    return () => { dead = true; off(); cancelAnimationFrame(raf); ro.disconnect(); scene.current?.dispose(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn, meId, host]);

  const cycle = () => { const order: CamMode[] = host ? ['chase', 'spectator', 'bumper'] : ['chase', 'bumper', 'cockpit']; onCam?.(order[(order.indexOf(cam) + 1) % order.length]); sfx.click(); };
  const nextFocus = (dir: number) => { const ids = (snaps.current[snaps.current.length - 1]?.f.c ?? []).map((c: any) => c.id) as string[]; if (!ids.length) return; const i = ids.indexOf(focus ?? ''); setFocus(ids[(i + dir + ids.length) % ids.length]); sfx.click(); };
  const camName = { cockpit: l({ he: 'תא נהג', en: 'Cockpit' }), bumper: l({ he: 'פגוש', en: 'Bumper' }), chase: l({ he: 'מאחור', en: 'Chase' }), spectator: l({ he: 'צופה', en: 'Spectator' }) }[cam];
  const fmt = (s: number) => (s > 0 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}` : '--');
  const focusInfo = focus ? who.current.get(focus) : undefined;

  if (failed) return <div className="kart3d kart3d--fail" data-testid="kart3d-fail"><p>{l({ he: 'הדפדפן הזה לא תומך בתלת־ממד. אפשר עדיין לנהוג — המסך הגדול מציג את המרוץ.', en: 'This browser cannot do 3D. You can still drive — the big screen shows the race.' })}</p></div>;
  return (
    <div className={`kart3d ${host ? 'kart3d--host' : ''}`} ref={wrap} data-testid="kart3d">
      <canvas ref={canvas} className="kart3d__canvas" />
      <div className="kart3d__hud">
        <div className="k3-top">
          <span className="k3-pill k3-place" data-testid="k3-place"><b>{hud.place || '-'}</b>/{hud.of}</span>
          <span className="k3-pill" data-testid="k3-lap">{l({ he: 'הקפה', en: 'LAP' })} <b>{hud.lap}</b>/{hud.laps}</span>
          <span className="k3-pill k3-time">{fmt(hud.lapT)}</span>
          {hud.end >= 0 && <span className="k3-pill k3-end"><Icon name="flag" size="1em" /> {hud.end}</span>}
          <button className="k3-pill k3-cam" onClick={cycle} data-testid="k3-cam" aria-label="camera">{camName}</button>
        </div>
        <canvas ref={mini} width={150} height={110} className="k3-mini" aria-label={l({ he: 'מפה', en: 'Map' })} />
        <div className="k3-speed" data-testid="k3-speed"><b>{hud.v}</b><small>km/h</small><i style={{ width: `${Math.min(100, hud.turbo)}%` }} /></div>
        {hud.best > 0 && <div className="k3-laps"><small>{l({ he: 'הקפה אחרונה', en: 'Last' })} {fmt(hud.last)} · {l({ he: 'הכי טובה', en: 'Best' })} {fmt(hud.best)}</small></div>}
        {hud.toast && <div className="k3-toast" key={hud.toast}>{hud.toast}</div>}
        {host && (
          <div className="k3-host">
            <button className="chip" onClick={() => nextFocus(-1)} aria-label="prev">◀</button>
            <b style={{ color: focusInfo?.color }}>{focusInfo?.name ?? ''}</b>
            <button className="chip" onClick={() => { setFocus(null); sfx.click(); }} data-testid="k3-leader">{lang === 'he' ? 'מוביל' : 'Leader'}</button>
            <button className="chip" onClick={() => nextFocus(1)} aria-label="next">▶</button>
          </div>
        )}
      </div>
    </div>
  );
}

function drawMini(cv: HTMLCanvasElement, tid: number, cars: CarView[], me: string, who: Map<string, Who>) {
  const g = cv.getContext('2d')!, W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const tr = getTrack(tid), sx = (W - 16) / 1600, sy = (H - 16) / 900, s = Math.min(sx, sy), ox = (W - 1600 * s) / 2, oy = (H - 900 * s) / 2;
  g.fillStyle = 'rgba(10,5,30,.55)'; g.beginPath(); g.roundRect(0, 0, W, H, 14); g.fill();
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 6; g.beginPath();
  tr.pts.forEach((p, i) => (i ? g.lineTo(ox + p.x * s, oy + p.y * s) : g.moveTo(ox + p.x * s, oy + p.y * s))); g.closePath(); g.stroke();
  g.strokeStyle = '#3b3d4d'; g.lineWidth = 3.5; g.stroke();
  for (const c of cars) { const w = who.get(c.id), mine = c.id === me; g.fillStyle = w?.color ?? '#fff'; g.strokeStyle = mine ? '#fff' : '#120a2a'; g.lineWidth = mine ? 3 : 1.5; g.beginPath(); g.arc(ox + c.x * s, oy + c.y * s, mine ? 6 : 4, 0, 7); g.fill(); g.stroke(); }
}
