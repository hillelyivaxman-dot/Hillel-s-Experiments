import gsap from 'gsap';
import { Icon } from '../ui/icons';
import { useEffect, useRef, useState } from 'react';
import { getMeta } from '../../../shared/catalog';
import type { AdminAction, PlayerInfo, RoomState } from '../../../shared/protocol';
import { useT } from '../i18n';
import { store, type Conn } from '../net';
import { prefs } from '../prefs';
import { FX } from '../render/fx';
import { interpolate, RENDERERS } from '../render';
import type { RenderInfo } from '../render/types';
import { sfx } from '../sound';
import { KartView } from '../ui/KartView';

const FRAME_MS = 1000 / 30;

export function Stage({ room, conn, act, watch }: { room: RoomState; conn: Conn; act: (a: AdminAction) => void; watch: boolean }) {
  const { t, l, lang } = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const players = useRef(new Map<string, PlayerInfo>());
  players.current = new Map(room.players.map((p) => [p.id, p]));
  const langRef = useRef(lang);
  langRef.current = lang;
  const gameId = room.gameId!;
  const renderer = RENDERERS[gameId];
  const meta = getMeta(gameId)!;

  useEffect(() => {
    const cv = canvas.current!;
    const g = cv.getContext('2d')!;
    g.direction = 'ltr'; // numbers + mixed Hebrew names render correctly
    const fx = new FX();
    let prev: any = null, cur: any = null, curAt = 0;
    const t0 = performance.now();
    (window as unknown as { __fcFrame: unknown }).__fcFrame = null;
    let last = t0;
    let raf = 0;
    const info = (): RenderInfo => ({ players: players.current, t: (performance.now() - t0) / 1000, lang: langRef.current, fx });

    const off = conn.on((m) => {
      if (m.t !== 'frame' || m.g !== gameId) return;
      prev = cur;
      cur = m.f;
      curAt = performance.now();
      (window as unknown as { __fcFrame: unknown }).__fcFrame = m.f;
      for (const e of (m.f as { ev?: any[] }).ev ?? []) {
        if (typeof e.k === 'string' && e.k.startsWith('god_')) { // crown powers (server-verified owner): generic visual + sound
          const w = renderer.world, cx = w.x + w.w / 2, cy = w.y + w.h / 2;
          if (e.k === 'god_confetti') { for (let i = 0; i < 6; i++) fx.burst(w.x + Math.random() * w.w, w.y + Math.random() * w.h * 0.5, ['#ff4d6d', '#3ec1ff', '#ffd23f', '#5dfc8d'][i % 4], 30, 500, 8, 400); sfx.win(); }
          else if (e.k === 'god_quake') { fx.kick(24); sfx.boom(); }
          else if (e.k === 'god_flash') { fx.blink('#ffffff', 0.9); sfx.power(); }
          else if (e.k === 'god_say') { fx.text(cx, cy - w.h * 0.28, document.documentElement.lang === 'he' ? e.he : e.en, '#ffd23f', 70); fx.burst(cx, cy - w.h * 0.28, '#b26bff', 24, 420, 7); sfx.power(); }
          else { fx.text(cx, cy, ':crown:', '#ffd23f', 160); fx.burst(cx, cy, '#ffd23f', 40, 450, 8); sfx.win(); }
          continue;
        }
        renderer.event?.(e, m.f, info());
      }
    });

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.direction = 'ltr'; // resizing the canvas resets this; keep numbers/punctuation in the right order
      const i = info();
      renderer.background(g, W, H, i.t);
      if (!cur) return;
      const f = interpolate(prev, cur, (now - curAt) / FRAME_MS);
      const wd = renderer.world;
      const s = Math.min(W / wd.w, H / wd.h);
      const ox = (W - wd.w * s) / 2 - wd.x * s, oy = (H - wd.h * s) / 2 - wd.y * s;
      const sx = fx.shake ? (Math.random() - 0.5) * fx.shake : 0, sy = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
      g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (ox + sx), dpr * (oy + sy));
      fx.update(dt);
      renderer.draw(g, f, i);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.hud?.(g, f, i, W, H);
      if (fx.flash > 0) {
        g.globalAlpha = fx.flash;
        g.fillStyle = fx.flashColor;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }
    };
    draw();
    return () => { off(); cancelAnimationFrame(raf); };
  }, [conn, gameId, renderer]);

  const [view3d, setView3dRaw] = useState(() => store.get('fc.host3d') !== '0');
  const setView3d = (f: (v: boolean) => boolean) => setView3dRaw((v) => { const n = f(v); store.set('fc.host3d', n ? '1' : '0'); return n; });
  const [hostCam, setHostCam] = useState<'chase' | 'spectator' | 'bumper' | 'cockpit'>('chase');
  const kart3d = gameId === 'kart' && view3d;
  return (
    <div className="stage">
      <canvas ref={canvas} className="stage__canvas" data-testid="stage" style={kart3d ? { visibility: 'hidden' } : undefined} />
      {kart3d && <KartView conn={conn} meId={null} players={room.players} cam={hostCam} host onCam={setHostCam} />}
      {gameId === 'kart' && <div className="stage__view"><button className="chip" onClick={() => setView3d((v) => !v)} data-testid="view-toggle">{view3d ? '2D' : '3D'}</button></div>}
      {!watch && (
        <div className="stage__controls">
          {room.phase === 'paused'
            ? <button className="chip" onClick={() => act({ a: 'resume' })}>▶ {t('resume')}</button>
            : <button className="chip" onClick={() => act({ a: 'pause' })}><Icon name="pause" /> {t('pause')}</button>}
          <button className="chip" onClick={() => act({ a: 'end' })}><Icon name="stop" /> {t('endRound')}</button>
        </div>
      )}
      {room.phase === 'countdown' && <Countdown endsAt={room.countdownEndsAt!} conn={conn} title={l(meta.name)} howTo={l(meta.howTo)} />}
      {room.phase === 'paused' && (
        <div className="overlay"><div className="overlay__big"><Icon name="pause" /> {t('paused')}</div>
          {!watch && <button className="btn btn--primary btn--xl" onClick={() => act({ a: 'resume' })}>▶ {t('resume')}</button>}
        </div>
      )}
    </div>
  );
}

function Countdown({ endsAt, conn, title, howTo }: { endsAt: number; conn: Conn; title: string; howTo: string }) {
  const { t } = useT();
  const [n, setN] = useState(() => Math.ceil((endsAt - conn.serverNow()) / 1000));
  const numRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setInterval(() => setN(Math.ceil((endsAt - conn.serverNow()) / 1000)), 50);
    return () => clearInterval(id);
  }, [endsAt, conn]);
  useEffect(() => {
    if (n > 0 && n <= 3) sfx.tick();
    if (!prefs.reducedMotion && numRef.current) gsap.fromTo(numRef.current, { scale: 2.4, opacity: 0, rotate: -12 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.45, ease: 'back.out(2.5)' });
  }, [n]);
  return (
    <div className="overlay overlay--countdown">
      <h2 className="overlay__title">{title}</h2>
      <p className="overlay__how">{howTo}</p>
      <div className="overlay__num" ref={numRef}>{n > 0 && n <= 3 ? n : n > 3 ? '…' : t('go')}</div>
    </div>
  );
}
