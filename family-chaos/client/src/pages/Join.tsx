import { useEffect, useRef, useState } from 'react';
import { CATALOG, getMeta } from '../../../shared/catalog';
import { AVATAR_COUNT, PLAYER_COLORS, type AdminAction, type RoomState } from '../../../shared/protocol';
import { Pad } from '../controller/Pad';
import { useT, type Key } from '../i18n';
import { Conn, store } from '../net';
import { sfx } from '../sound';
import { ConnBanner, CritterCanvas, GameCard, Logo, savedProfile, SettingsBar, useConnStatus } from '../ui/common';

type Hud = Record<string, string | number>;

/** Phone: join form → personal lobby → controller → results. */
export function Join({ initialCode }: { initialCode: string }) {
  const { t } = useT();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState(savedProfile.name);
  const [avatar, setAvatar] = useState(savedProfile.avatar);
  const [password, setPassword] = useState('');
  const [needPw, setNeedPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conn, setConn] = useState<Conn | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [hud, setHud] = useState<Hud>({});
  const [kicked, setKicked] = useState(false);
  const joined = useRef(false);
  const req = useRef<{ code: string; name: string; avatar: number; password?: string } | null>(null);
  const status = useConnStatus(conn);

  const tokenKey = (c: string) => `fc.tok.${c}`;

  const connect = () => {
    if (conn) {
      const r = req.current!;
      conn.send({ t: 'join', ...r, token: store.get(tokenKey(r.code)) ?? undefined });
      return;
    }
    const c = new Conn((cn) => {
      const r = req.current;
      if (r) cn.send({ t: 'join', ...r, token: store.get(tokenKey(r.code)) ?? undefined });
    });
    c.on((m) => {
      switch (m.t) {
        case 'joined':
          joined.current = true;
          store.set(tokenKey(m.code), m.token);
          setMe(m.playerId);
          setError(null);
          history.replaceState(null, '', `/join/${m.code}`);
          (navigator as Navigator & { wakeLock?: { request(t: string): Promise<unknown> } }).wakeLock?.request('screen').catch(() => {});
          break;
        case 'room': setRoom(m.room); break;
        case 'hud': setHud(m.h); break;
        case 'buzz': navigator.vibrate?.(m.ms); break;
        case 'kicked': setKicked(true); store.del(tokenKey(req.current?.code ?? '')); c.close(); break;
        case 'error':
          if (joined.current && (m.code === 'not_allowed' || m.code === 'in_game')) return; // admin UI race
          if (m.code === 'bad_password') setNeedPw(true);
          if (m.code === 'no_room' || m.code === 'not_allowed') { store.del(tokenKey(req.current?.code ?? '')); }
          setError(t(`errors_${m.code}` as Key));
          sfx.bad();
          break;
      }
    });
    setConn(c);
  };

  // auto-rejoin after refresh / reconnect when we have a session token for this room
  useEffect(() => {
    const c = initialCode.toUpperCase();
    if (c && store.get(tokenKey(c)) && savedProfile.name()) {
      req.current = { code: c, name: savedProfile.name(), avatar: savedProfile.avatar() };
      connect();
    }
    return () => conn?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    sfx.click();
    const n = name.trim();
    if (code.length !== 4 || !n) return;
    savedProfile.save(n, avatar);
    req.current = { code, name: n, avatar, password: password || undefined };
    connect();
  };

  if (kicked) return <div className="center-screen phone"><Logo small /><p className="big-msg">{t('kicked')}</p><a className="btn btn--secondary" href="/">🏠</a></div>;

  const meInfo = room?.players.find((p) => p.id === me);
  if (!room || !meInfo || !conn) {
    return (
      <div className="phone join">
        <header className="topbar"><Logo small /><SettingsBar /></header>
        <form className="card join__form" onSubmit={submit}>
          <h1>{t('join')}</h1>
          <label>{t('code')}
            <input className="code-input" value={code} maxLength={4} placeholder="ABCD" dir="ltr" autoComplete="off" autoCapitalize="characters" name="code"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
          </label>
          <label>{t('yourName')}
            <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} autoComplete="nickname" name="name" required />
          </label>
          {needPw && (
            <label>{t('password')}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} name="password" /></label>
          )}
          <fieldset className="avatar-pick">
            <legend>{t('pickCritter')}</legend>
            {Array.from({ length: AVATAR_COUNT }, (_, i) => (
              <button type="button" key={i} className={`avatar-opt ${avatar === i ? 'is-on' : ''}`} onClick={() => { setAvatar(i); sfx.click(); }} aria-pressed={avatar === i}>
                <CritterCanvas color={PLAYER_COLORS[i % PLAYER_COLORS.length]} variant={i} size={56} animate={avatar === i} />
              </button>
            ))}
          </fieldset>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn--primary btn--xl" type="submit" disabled={code.length !== 4 || !name.trim()} data-testid="join-btn">
            {t('enter')} 🎮
          </button>
          <p className="muted small">{t('privacy')}</p>
        </form>
        {conn && <ConnBanner status={status} />}
      </div>
    );
  }

  const isLeader = room.leaderId === me;
  const act = (a: AdminAction) => conn.send({ t: 'admin', act: a });
  const inMatch = room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'paused';
  const playing = inMatch && room.inGame.includes(me!);

  return (
    <div className={`phone ${playing ? 'phone--pad' : ''}`} style={{ ['--pc' as string]: meInfo.color }}>
      <ConnBanner status={status} />
      {room.phase === 'lobby' && <PhoneLobby room={room} me={me!} conn={conn} act={act} isLeader={isLeader} />}
      {inMatch && !playing && <div className="center-screen"><CritterCanvas color={meInfo.color} variant={meInfo.avatar} size={140} /><p className="big-msg">{t('watchScreen')}</p></div>}
      {playing && <PhoneGame room={room} conn={conn} hud={hud} isLeader={isLeader} act={act} />}
      {room.phase === 'results' && <PhoneResults room={room} me={me!} isLeader={isLeader} act={act} />}
      {error && <div className="toast" role="alert" onClick={() => setError(null)}>{error}</div>}
    </div>
  );
}

function PhoneLobby({ room, me, conn, act, isLeader }: { room: RoomState; me: string; conn: Conn; act: (a: AdminAction) => void; isLeader: boolean }) {
  const { t, l } = useT();
  const p = room.players.find((x) => x.id === me)!;
  const [picking, setPicking] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const meta = getMeta(room.selectedGame)!;
  return (
    <div className="phone-lobby">
      <header className="phone-lobby__me">
        <button className="me-critter" onClick={() => setPicking((x) => !x)} aria-label={t('change')}>
          <CritterCanvas color={p.color} variant={p.avatar} size={92} />
        </button>
        <div>
          <div className="me-name" style={{ color: p.color }}>{p.name}</div>
          <div className="muted" dir="ltr">{room.code}{isLeader ? ' · 👑' : ''}</div>
        </div>
        <button className="chip" onClick={() => { conn.send({ t: 'leave' }); store.del(`fc.tok.${room.code}`); location.assign('/'); }}>{t('leave')}</button>
      </header>
      {picking && (
        <div className="avatar-pick avatar-pick--inline">
          {Array.from({ length: AVATAR_COUNT }, (_, i) => (
            <button key={i} className={`avatar-opt ${p.avatar === i ? 'is-on' : ''}`} onClick={() => { conn.send({ t: 'profile', avatar: i }); savedProfile.save(p.name, i); setPicking(false); }}>
              <CritterCanvas color={p.color} variant={i} size={52} animate={false} />
            </button>
          ))}
        </div>
      )}
      <button className={`btn btn--xl ready-btn ${p.ready ? 'is-ready' : ''}`} onClick={() => { sfx.click(); conn.send({ t: 'ready', v: !p.ready }); }} data-testid="ready-btn">
        {p.ready ? `✔ ${t('ready')}` : t('notReady')}
      </button>

      {isLeader ? (
        <section className="leader-panel">
          <p className="muted">{t('hostControls')}</p>
          <div className="phone-games">
            {CATALOG.filter((g) => g.status === 'playable').map((g) => (
              <GameCard key={g.id} g={g} compact selected={g.id === room.selectedGame} onClick={() => act({ a: 'select', game: g.id })} />
            ))}
          </div>
          <div className="options">
            {meta.options.map((o) => {
              const v = room.options[o.key] ?? o.default;
              const idx = o.values.indexOf(v);
              return (
                <button key={o.key} className="chip" onClick={() => act({ a: 'option', key: o.key, value: o.values[(idx + 1) % o.values.length] })}>
                  {l(o.label)}: <b>{o.names ? l(o.names[idx]) : v}</b>
                </button>
              );
            })}
          </div>
          <button className="btn btn--primary btn--xl" onClick={() => act({ a: 'start' })} data-testid="phone-start">▶ {t('start')}</button>
        </section>
      ) : (
        <p className="waiting">{t('waitHost')}<br /><b>{t('selected')}: {l(meta.name)}</b></p>
      )}

      <ul className="phone-players">
        {room.players.filter((x) => x.id !== me).map((x) => (
          <li key={x.id} style={{ color: x.color }}>
            <span>{x.id === room.leaderId ? '👑 ' : ''}{x.name}{x.connected ? '' : ' ⚡'}</span>
            <span className="phone-players__actions">
              {isLeader && <button className="mini mini--danger" onClick={() => act({ a: 'kick', playerId: x.id })}>✖</button>}
              {isLeader && <button className="mini" onClick={() => act({ a: 'leader', playerId: x.id })}>👑</button>}
              <button className="mini" disabled={reported.has(x.id)} title={t('report')} aria-label={t('report')}
                onClick={() => { conn.send({ t: 'report', playerId: x.id }); setReported(new Set(reported).add(x.id)); }}>
                {reported.has(x.id) ? '✓' : '⚑'}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function hudLine(game: string, h: Hud, t: ReturnType<typeof useT>['t']): { text: string; tone: string } {
  switch (game) {
    case 'bumper':
      return { text: `${'❤'.repeat(Number(h.lives ?? 0))}  ${h.ko ?? 0} KO  ${h.dash ? '⚡' : '…'}${h.power ? ` · ${h.power}` : ''}`, tone: Number(h.lives) === 0 ? 'bad' : 'normal' };
    case 'kart':
      if (h.done) return { text: `🏁 ${t('finished')} #${h.place}`, tone: 'good' };
      return { text: `#${h.place ?? '-'}/${h.of ?? '-'} · ${t('lap')} ${h.lap ?? 1}/${h.laps ?? '-'}${h.item ? ` · ${{ turbo: '🚀', oil: '🛢', shield: '🛡' }[String(h.item)] ?? ''}` : ''}`, tone: 'normal' };
    case 'reaction':
      if (h.msg === 'early') return { text: t('early'), tone: 'bad' };
      if (h.msg === 'tapped') return { text: `${h.ms} ms`, tone: 'good' };
      return { text: `${t('round')} ${h.round ?? 1}/${h.rounds ?? '-'} · ${t('score')} ${h.score ?? 0}`, tone: 'normal' };
    case 'potato':
      if (h.out) return { text: t('youreOut'), tone: 'bad' };
      if (h.hot) return { text: `💣 ${t('youHaveBomb')}`, tone: 'hot' };
      return { text: `${t('round')} ${h.round ?? 1}`, tone: 'normal' };
  }
  return { text: '', tone: 'normal' };
}

function PhoneGame({ room, conn, hud, isLeader, act }: { room: RoomState; conn: Conn; hud: Hud; isLeader: boolean; act: (a: AdminAction) => void }) {
  const { t, l } = useT();
  const meta = getMeta(room.gameId!)!;
  const line = hudLine(meta.id, hud, t);
  return (
    <div className={`phone-game tone-${line.tone}`}>
      <div className="phone-game__hud">
        <span className="phone-game__title">{l(meta.name)}</span>
        <span className="phone-game__line" data-testid="hud">{room.phase === 'countdown' ? '3…2…1…' : line.text}</span>
        {isLeader && (room.phase === 'paused'
          ? <button className="mini" onClick={() => act({ a: 'resume' })}>▶</button>
          : <button className="mini" onClick={() => act({ a: 'pause' })}>⏸</button>)}
      </div>
      {meta.controller.kind === 'stick' && meta.controller.landscape && <p className="rotate-hint">{t('tiltHint')}</p>}
      <Pad layout={meta.controller} conn={conn} />
    </div>
  );
}

function PhoneResults({ room, me, isLeader, act }: { room: RoomState; me: string; isLeader: boolean; act: (a: AdminAction) => void }) {
  const { t } = useT();
  const r = room.results?.find((x) => x.playerId === me);
  const p = room.players.find((x) => x.id === me)!;
  return (
    <div className="center-screen phone-results">
      <CritterCanvas color={p.color} variant={p.avatar} size={150} hurt={!!r && r.place > 3} />
      {r ? (
        <>
          <p className="big-msg">{r.place === 1 ? `🏆 ${t('youWon')}` : `${t('place')} #${r.place}`}</p>
          <p className="stars">{'⭐'.repeat(r.stars) || '—'}</p>
          <p className="muted">{r.detail}</p>
        </>
      ) : <p className="big-msg">{t('watchScreen')}</p>}
      <p className="muted">⭐ {p.stars}</p>
      {isLeader && (
        <div className="results__actions">
          <button className="btn btn--primary btn--xl" onClick={() => act({ a: 'again' })}>🔁 {t('playAgain')}</button>
          <button className="btn btn--secondary" onClick={() => act({ a: 'lobby' })}>🏠 {t('backToLobby')}</button>
        </div>
      )}
    </div>
  );
}
