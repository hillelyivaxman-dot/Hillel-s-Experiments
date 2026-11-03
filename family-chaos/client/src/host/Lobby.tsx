import { useGSAP } from '@gsap/react';
import { Icon } from '../ui/icons';
import gsap from 'gsap';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { CATALOG, getMeta } from '../../../shared/catalog';
import type { AdminAction, PlayerInfo, RoomState } from '../../../shared/protocol';
import { useT } from '../i18n';
import { prefs } from '../prefs';
import { store } from '../net';
import { sfx } from '../sound';
import { introCards } from '../ui/intro';
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
      {leader && <span className="player-tile__crown" title={t('leader')}><Icon name="crown" /></span>}
      <CritterCanvas color={p.color} variant={p.avatar} size={110} />
      <span className="player-tile__name">{p.name}</span>
      <span className="player-tile__meta">{p.ready ? <><Icon name="check" size="1em" /> {t('ready')}</> : p.connected ? '…' : <Icon name="bolt" size="1em" />}{stars ? <> · <Icon name="star" size="1em" />{stars}</> : null}</span>
      {!watch && (
        <span className="player-tile__actions">
          {!leader && <button className="mini" onClick={() => act({ a: 'leader', playerId: p.id })}><Icon name="crown" /> {t('makeLeader')}</button>}
          <button className="mini mini--danger" onClick={() => act({ a: 'kick', playerId: p.id })}><Icon name="cross" /> {t('kick')}</button>
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
  const [custom, setCustom] = useState<string[] | null>(null);
  const favs: string[] = (() => { try { return JSON.parse(store.get('fc.favs') ?? '[]'); } catch { return []; } })(); // favourites float to the front
  const canStart = connected >= meta.minPlayers;

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, width: 360, color: { dark: '#120a2a', light: '#ffffff' } }).then(setQr).catch(() => {});
  }, [joinUrl]);

  useGSAP(() => {
    if (prefs.reducedMotion) return;
    gsap.from('.lobby__join', { x: -80, opacity: 0, duration: 0.6, ease: 'power3.out' });
    introCards('.lobby__games .game-card', { y: 40, delay: 0.15 });
    gsap.to('.qr-frame', { rotate: 1.5, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }, { scope: root });

  // only a few empty slots, so a small screen is never filled with placeholders
  const slots = Math.max(0, Math.min(room.maxPlayers, Math.max(4, room.players.length + 1)) - room.players.length);

  return (
    <div className="lobby" ref={root}>
      <header className="topbar">
        <Logo small />
        <div className="topbar__right">
          {!watch && <button className="chip" onClick={() => setShowSettings((s) => !s)}><Icon name="gear" /> {t('settings')}</button>}
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
          {room.hasPassword && <p className="muted"><Icon name="lock" /> {t('password')}</p>}
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
          {!watch && (
            <div className="tour-pick" data-testid="tour-pick">
                <span><Icon name="trophy" /> {l({ he: 'טורניר מסיבה', en: 'Party tournament' })}</span>
                {[3, 5, 8].map((n) => (
                  <button key={n} className="chip" disabled={connected < 2} data-testid={`tour-${n}`} onClick={() => { sfx.go(); act({ a: 'tournament', count: n }); }}>
                    {n} {l({ he: 'משחקים', en: 'games' })}
                  </button>
                ))}
                <button className="chip" disabled={connected < 2} data-testid="tour-knockout" onClick={() => { sfx.go(); act({ a: 'tournament', mode: 'knockout' }); }}><Icon name="fire" /> {l({ he: 'נוק־אאוט', en: 'Knockout' })}
                </button>
                <button className={`chip ${custom ? 'is-on' : ''}`} disabled={connected < 2} data-testid="tour-custom" onClick={() => setCustom(custom ? null : [])}><Icon name="edit" /> {l({ he: 'בחירה ידנית', en: 'Pick games' })}
                </button>
                {custom && (
                  <button className="btn btn--primary" disabled={!custom.length} data-testid="tour-custom-go" onClick={() => { sfx.go(); act({ a: 'tournament', games: custom }); setCustom(null); }}>
                    ▶ {l({ he: 'התחל טורניר', en: 'Start tournament' })} ({custom.length})
                  </button>
                )}
                {custom && <span className="muted small">{l({ he: 'לחצו על משחקים בסרגל למטה לפי הסדר', en: 'Tap games in the rail below, in order' })}</span>}
              </div>
          )}
        </section>
      </main>

      <section className="lobby__bottom">
        <div className="lobby__games">
          {[...CATALOG.filter((g) => g.status === 'playable')].sort((a, b) => (favs.includes(b.id) ? 1 : 0) - (favs.includes(a.id) ? 1 : 0)).map((g) => (
            <GameCard key={g.id} g={g} selected={custom ? custom.includes(g.id) : g.id === room.selectedGame} onClick={() => { sfx.click(); if (custom) setCustom(custom.includes(g.id) ? custom.filter((x) => x !== g.id) : [...custom, g.id]); else act({ a: 'select', game: g.id }); }} />
          ))}
          <div className="rail-soon" aria-hidden="true">+{CATALOG.filter((g) => g.status !== 'playable').length}<small>{t('soon')}</small></div>
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
            <div className="start-col">
              <button className="btn btn--primary btn--xl start-btn" disabled={!canStart} data-testid="start-btn"
                onClick={() => { sfx.go(); act({ a: 'start' }); }}>
                {canStart ? `▶ ${t('start')}` : t('needPlayers', { n: meta.minPlayers })}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
