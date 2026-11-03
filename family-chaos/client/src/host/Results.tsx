import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { getMeta } from '../../../shared/catalog';
import type { AdminAction, RoomState } from '../../../shared/protocol';
import { useT } from '../i18n';
import { prefs } from '../prefs';
import { sfx } from '../sound';
import { CritterCanvas, Logo } from '../ui/common';

gsap.registerPlugin(useGSAP);

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (prefs.reducedMotion) return;
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    cv.width = cv.clientWidth;
    cv.height = cv.clientHeight;
    const colors = ['#ff4d6d', '#3ec1ff', '#ffd23f', '#5dfc8d', '#b26bff', '#ff8c42'];
    const bits = Array.from({ length: 160 }, () => ({
      x: Math.random() * cv.width, y: -Math.random() * cv.height, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 180,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 10, w: 8 + Math.random() * 8, c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf = 0;
    let last = performance.now();
    const start = last;
    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.clearRect(0, 0, cv.width, cv.height);
      for (const b of bits) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
        if (b.y > cv.height + 20 && now - start < 3500) { b.y = -20; b.x = Math.random() * cv.width; }
        g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.w / 4, b.w, b.w / 2); g.restore();
      }
      if (now - start < 7000) raf = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}

export function Results({ room, act, watch }: { room: RoomState; act: (a: AdminAction) => void; watch: boolean }) {
  const { t, l } = useT();
  const root = useRef<HTMLDivElement>(null);
  const res = room.results ?? [];
  const byId = new Map(room.players.map((p) => [p.id, p]));
  const podium = res.filter((r) => r.place <= 3).slice(0, 3);
  const order = [podium[1], podium[0], podium[2]].filter(Boolean);
  const meta = room.gameId ? getMeta(room.gameId) : undefined;
  const leaderboard = [...room.players].sort((a, b) => b.stars - a.stars);
  const tour = room.tour;
  const tourRank = tour ? [...room.players].sort((a, b) => (tour.points[b.id] ?? 0) - (tour.points[a.id] ?? 0)) : [];
  const nextMeta = tour && !tour.done ? getMeta(tour.games[tour.idx + 1] ?? '') : undefined;
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!tour?.nextAt) { setLeft(0); return; }
    const end = performance.now() + 12000;
    setLeft(12);
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((end - performance.now()) / 1000))), 250);
    return () => clearInterval(id);
  }, [tour?.nextAt]);
  const champ = tour?.done && tour.champion ? byId.get(tour.champion) : undefined;

  useEffect(() => { sfx.win(); }, []);
  useGSAP(() => {
    if (prefs.reducedMotion) return;
    gsap.from('.podium__col', { y: 300, duration: 0.9, ease: 'back.out(1.4)', stagger: { each: 0.25, from: 'end' } });
    gsap.from('.podium__critter', { scale: 0, rotate: 180, duration: 0.6, ease: 'back.out(2)', delay: 0.8, stagger: 0.15 });
    gsap.from('.results__rest li, .leaderboard li', { x: 60, opacity: 0, stagger: 0.06, delay: 1.2 });
  }, { scope: root });

  return (
    <div className="results" ref={root}>
      <Confetti />
      <header className="topbar"><Logo small /><h1 className="results__title">{meta ? l(meta.name) : ''} — {t('results')}</h1></header>
      <div className="results__main">
        <div className="podium">
          {order.map((r) => {
            const p = byId.get(r.playerId);
            if (!p) return null;
            return (
              <div key={r.playerId} className={`podium__col podium__col--${r.place}`} style={{ ['--pc' as string]: p.color }}>
                <div className="podium__critter">{r.place === 1 && <span className="podium__crown">👑</span>}<CritterCanvas color={p.color} variant={p.avatar} size={r.place === 1 ? 170 : 130} /></div>
                <div className="podium__name">{p.name}</div>
                <div className="podium__detail">{r.detail}</div>
                <div className="podium__block"><span>{r.place}</span><small>{'⭐'.repeat(r.stars)}</small></div>
              </div>
            );
          })}
        </div>
        <aside className="results__side">
          {res.length > 3 && (
            <ol className="results__rest">
              {res.slice(3).map((r) => {
                const p = byId.get(r.playerId);
                return p ? <li key={r.playerId} style={{ color: p.color }}>#{r.place} {p.name} <span className="muted">{r.detail}</span></li> : null;
              })}
            </ol>
          )}
          {tour && (
            <div className="tour-panel" data-testid="tour-panel">
              <h3>🏆 {l({ he: 'טורניר', en: 'Tournament' })} {Math.min(tour.idx + 1, tour.total)}/{tour.total}</h3>
              {champ && <p className="tour-champ" data-testid="tour-champion">👑 {l({ he: 'האלוף/ה', en: 'Champion' })}: <b style={{ color: champ.color }}>{champ.name}</b></p>}
              <ol className="leaderboard">
                {tourRank.map((p) => <li key={p.id} style={{ color: p.color }}><span>{p.name}</span><b>{tour.points[p.id] ?? 0}</b></li>)}
              </ol>
              {nextMeta && <p className="muted">{l({ he: 'הבא', en: 'Next' })}: <b>{l(nextMeta.name)}</b>{left > 0 ? ` · ${left}` : ''}</p>}
              {!watch && !tour.done && (
                <div className="results__actions">
                  <button className="btn btn--secondary" onClick={() => act({ a: 'tour_skip' })} data-testid="tour-skip">⏭ {l({ he: 'המשחק הבא עכשיו', en: 'Next game now' })}</button>
                  <button className="chip" onClick={() => act({ a: 'tour_cancel' })}>✖ {l({ he: 'בטל טורניר', en: 'Cancel' })}</button>
                </div>
              )}
            </div>
          )}
          <h3>⭐ {t('sessionStars')}</h3>
          <ol className="leaderboard">
            {leaderboard.map((p) => <li key={p.id} style={{ color: p.color }}><span>{p.name}</span><b>{p.stars}</b></li>)}
          </ol>
          {!watch && (
            <div className="results__actions">
              <button className="btn btn--primary btn--xl" onClick={() => act({ a: 'again' })} data-testid="again-btn">🔁 {t('playAgain')}</button>
              <button className="btn btn--secondary" onClick={() => act({ a: 'lobby' })} data-testid="lobby-btn">🏠 {t('backToLobby')}</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
