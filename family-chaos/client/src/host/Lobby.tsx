import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { CATALOG, getMeta } from '../../../shared/catalog';
import type { AdminAction, PlayerInfo, RoomState } from '../../../shared/protocol';
import { useT } from '../i18n';
import { prefs } from '../prefs';
import { sfx } from '../sound';
import { CritterCanvas, GameCard, Logo, SettingsBar } from '../ui/common';

gsap.registerPlugin(useGSAP);

/** Base URL phones should open. On localhost we swap in the PC's LAN address. */
function useJoinBase() {
  const [base, setBase] = useState(location.origin);
  useEffect(() => {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
    fetch('/api/info').then((r) => r.json()).then((info: { lan: string[]; publicUrl: string | null }) => {
      if (info.publicUrl) setBase(info.publicUrl);
      else if (info.lan[0]) {
        // dev server (vite) runs on another port than the game server
        const u = new URL(info.lan[0]);
        u.port = location.port;
        setBase(u.origin);
      }
    }).catch(() => {});
  }, []);
  return base;
}

function PlayerTile({ p, leader, act, watch, stars }: { p: PlayerInfo; leader: boolean; act: (a: AdminAction) => void; watch: boolean; stars: number }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sfx.join();
    if (!prefs.reducedMotion && ref.current) {
      gsap.from(ref.current, { y: -120, scale: 0.3, rotate: gsap.utils.random(-30, 30), opacity: 0, duration: 0.7, ease: 'back.out(2)' });
    }
  }, []);
  return (
    <div className={`player-tile ${p.connected ? '' : 'is-off'} ${p.ready ? 'is-ready' : ''}`} ref={ref} style={{ ['--pc' as string]: p.color }} data-player={p.name} data-pid={p.id}>
      {leader && <span className="player-tile__crown" title={t('leader')}>👑</span>}
      <CritterCanvas color={p.color} variant={p.avatar} size={110} />
      <span className="player-tile__name">{p.name}</span>
      <span className="player-tile__meta">{p.ready ? `✔ ${t('ready')}` : p.connected ? '…' : '⚡'}{stars ? ` · ⭐${stars}` : ''}</span>
      {!watch && (
        <span className="player-tile__actions">
          {!leader && <button className="mini" onClick={() => act({ a: 'leader', playerId: p.id })}>👑 {t('makeLeader')}</button>}
          <button className="mini mini--danger" onClick={() => act({ a: 'kick', playerId: p.id })}>✖ {t('kick')}</button>
        </span>
      )}
    </div>
  );
}

export function Lobby({ room, act, watch }: { room: RoomState; act: (a: AdminAction) => void; watch: boolean }) {
  const { t, l } = useT();
  const base = useJoinBase();
  const joinUrl = `${base}/join/${room.code}`;
  const watchUrl = `${base}/watch/${room.code}`;
  const [qr, setQr] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const meta = getMeta(room.selectedGame)!;
  const connected = room.players.filter((p) => p.connected).length;
  const canStart = connected >= meta.minPlayers;

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, width: 360, color: { dark: '#120a2a', light: '#ffffff' } }).then(setQr).catch(() => {});
  }, [joinUrl]);

  useGSAP(() => {
    if (prefs.reducedMotion) return;
    gsap.from('.lobby__join', { x: -80, opacity: 0, duration: 0.6, ease: 'power3.out' });
    gsap.from('.lobby__games .game-card', { y: 60, opacity: 0, stagger: 0.05, duration: 0.5, ease: 'back.out(1.6)', delay: 0.2 });
    gsap.to('.qr-frame', { rotate: 1.5, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }, { scope: root });

  const slots = Math.max(0, Math.min(room.maxPlayers, 8) - room.players.length);

  return (
    <div className="lobby" ref={root}>
      <header className="topbar">
        <Logo small />
        <div className="topbar__right">
          {!watch && <button className="chip" onClick={() => setShowSettings((s) => !s)}>⚙ {t('settings')}</button>}
          <SettingsBar />
        </div>
      </header>

      {showSettings && !watch && (
        <form className="card room-settings" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          act({ a: 'room', maxPlayers: Number(fd.get('max')), password: String(fd.get('pw') ?? '') });
          setShowSettings(false);
        }}>
          <label>{t('maxPlayers')}
            <select name="max" defaultValue={room.maxPlayers}>{[2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          <label>{t('roomPassword')}<input name="pw" type="text" maxLength={32} autoComplete="off" /></label>
          <button className="btn btn--primary">{t('save')}</button>
          <p className="muted small">{t('remoteTip')}</p>
          <div className="copy-row" dir="ltr">
            <code>{watchUrl}</code>
            <button type="button" className="chip" onClick={() => { navigator.clipboard?.writeText(watchUrl).then(() => setCopied(true)).catch(() => {}); }}>
              {copied ? t('copied') : t('copy')}
            </button>
          </div>
        </form>
      )}

      <main className="lobby__main">
        <aside className="lobby__join">
          <h2>{t('scanToJoin')}</h2>
          <div className="qr-frame">{qr ? <img src={qr} alt={joinUrl} width={300} height={300} /> : <div className="qr-ph" />}</div>
          <p className="muted">{t('orGoTo')}</p>
          <p className="join-url" dir="ltr">{base.replace(/^https?:\/\//, '')}/join</p>
          <div className="room-code" dir="ltr" data-testid="room-code">
            {room.code.split('').map((c, i) => <span key={i}>{c}</span>)}
          </div>
          {room.hasPassword && <p className="muted">🔒 {t('password')}</p>}
        </aside>

        <section className="lobby__players">
          <h2>{t('players')} <span className="count">{connected}/{room.maxPlayers}</span></h2>
          <div className="player-grid">
            {room.players.map((p) => (
              <PlayerTile key={p.id} p={p} leader={p.id === room.leaderId} act={act} watch={watch} stars={p.stars} />
            ))}
            {Array.from({ length: slots }, (_, i) => (
              <div key={`s${i}`} className="player-tile is-empty"><span className="empty-dot" /><span className="muted">{i === 0 && !room.players.length ? t('waitingPlayers') : t('emptySlot')}</span></div>
            ))}
          </div>
        </section>
      </main>

      <section className="lobby__bottom">
        <div className="lobby__games">
          {CATALOG.map((g) => (
            <GameCard key={g.id} g={g} compact selected={g.id === room.selectedGame} onClick={() => { sfx.click(); act({ a: 'select', game: g.id }); }} />
          ))}
        </div>
        <div className="selected-game" style={{ ['--a1' as string]: meta.accent[0], ['--a2' as string]: meta.accent[1] }}>
          <div>
            <h3>{l(meta.name)}</h3>
            <p>{l(meta.howTo)}</p>
            <div className="options">
              {meta.options.map((o) => {
                const v = room.options[o.key] ?? o.default;
                const idx = o.values.indexOf(v);
                const label = o.names ? l(o.names[idx]) : String(v);
                return (
                  <button key={o.key} className="chip" disabled={watch}
                    onClick={() => act({ a: 'option', key: o.key, value: o.values[(idx + 1) % o.values.length] })}>
                    {l(o.label)}: <b>{label}</b>
                  </button>
                );
              })}
            </div>
          </div>
          {!watch && (
            <button className="btn btn--primary btn--xl start-btn" disabled={!canStart} data-testid="start-btn"
              onClick={() => { sfx.go(); act({ a: 'start' }); }}>
              {canStart ? `▶ ${t('start')}` : t('needPlayers', { n: meta.minPlayers })}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
