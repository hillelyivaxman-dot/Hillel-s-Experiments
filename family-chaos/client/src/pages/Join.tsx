import { useEffect, useRef, useState } from 'react';
import { Icon, Rich } from '../ui/icons';
import { CATALOG, getMeta } from '../../../shared/catalog';
import { AVATAR_COUNT, PLAYER_COLORS, type AdminAction, type RoomState } from '../../../shared/protocol';
import { PadIcon } from '../controller/icons';
import { Pad } from '../controller/Pad';
import { usePadSettings } from '../controller/settings';
import { useMe } from '../account';
import { keepScreenOn } from '../compat';
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
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000); // never leave a message over the controls
    return () => clearTimeout(id);
  }, [error]);
  const [conn, setConn] = useState<Conn | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [hud, setHud] = useState<Hud>({});
  const [kicked, setKicked] = useState(false);
  const joined = useRef(false);
  const req = useRef<{ code: string; name: string; avatar: number; password?: string } | null>(null);
  const status = useConnStatus(conn);
  const [account] = useMe();
  // signed-in players: prefill the join form from the account profile
  useEffect(() => {
    if (account?.signedIn && account.user && !savedProfile.name()) { setName(account.user.nickname); setAvatar(account.user.avatar); }
  }, [account]);

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
          keepScreenOn();
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

  if (kicked) return <div className="center-screen phone"><Logo small /><p className="big-msg">{t('kicked')}</p><a className="btn btn--secondary" href="/"><Icon name="home" /></a></div>;

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
            {t('enter')} <Icon name="gamepad" />
          </button>
          <p className="muted small" data-testid="account-note">
            {account?.signedIn ? t('memberNote', { name: account.user!.nickname }) : <>{t('guestJoin')} <a href="/account">{t('signIn')}</a></>}
          </p>
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
          <div className="muted" dir="ltr">{room.code}{isLeader ? <> · <Icon name="crown" /></> : null}</div>
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
        {p.ready ? <><Icon name="check" /> {t('ready')}</> : t('notReady')}
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
            <span>{x.id === room.leaderId ? <Icon name="crown" /> : null}{x.id === room.leaderId ? ' ' : ''}{x.name}{x.connected ? '' : <> <Icon name="bolt" /></>}</span>
            <span className="phone-players__actions">
              {isLeader && <button className="mini mini--danger" onClick={() => act({ a: 'kick', playerId: x.id })}><Icon name="cross" /></button>}
              {isLeader && <button className="mini" onClick={() => act({ a: 'leader', playerId: x.id })}><Icon name="crown" /></button>}
              <button className="mini" disabled={reported.has(x.id)} title={t('report')} aria-label={t('report')}
                onClick={() => { conn.send({ t: 'report', playerId: x.id }); setReported(new Set(reported).add(x.id)); }}>
                {reported.has(x.id) ? <Icon name="check" size="1em" /> : <Icon name="flag2" size="1em" />}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface HudView { text: string; tone: 'normal' | 'hot' | 'bad' | 'good'; meter?: number; meterLabel?: string; chips?: { icon: string; on: boolean; label: string }[] }

function hudView(game: string, h: Hud, t: ReturnType<typeof useT>['t'], he: boolean): HudView {
  const L = (a: string, b: string) => (he ? a : b);
  const POW: Record<string, string> = { mega: ':arrowup:', shield: ':shield:', speed: ':bolt:' };
  switch (game) {
    case 'bumper':
      return {
        text: `${':heart:'.repeat(Number(h.lives ?? 0))}  ${h.ko ?? 0} KO`,
        tone: Number(h.lives) === 0 ? 'bad' : 'normal',
        chips: [
          { icon: 'dash', on: !!h.dash, label: L('הסתערות', 'DASH') },
          { icon: 'dodge', on: !!h.dodge, label: L('התחמקות', 'DODGE') },
          { icon: 'star', on: !!h.held, label: h.held ? POW[String(h.held)] ?? ':star:' : '—' },
        ],
      };
    case 'kart': case 'boat': case 'bike': {
      if (h.done) return { text: `${t('finished')} #${h.place}`, tone: 'good' };
      const base = `#${h.place ?? '-'}/${h.of ?? '-'} · ${t('lap')} ${h.lap ?? 1}/${h.laps ?? '-'}`;
      if (game === 'boat') return { text: base, tone: 'normal', chips: [{ icon: 'turbo', on: !!h.surge, label: L('דחיפה', 'SURGE') }] };
      if (game === 'bike') return { text: `${base}${Number(h.combo) > 0 ? ` · ×${h.combo}` : ''}`, tone: Number(h.combo) >= 3 ? 'hot' : 'normal', meter: Number(h.turbo ?? 0) / 100, meterLabel: L('בוסט', 'BOOST'), chips: [{ icon: 'jump', on: !!h.jump, label: L('קפיצה', 'HOP') }] };
      return { text: base, tone: 'normal', meter: Number(h.turbo ?? 0) / 100, meterLabel: L('טורבו', 'TURBO'), chips: [{ icon: 'item', on: !!h.item, label: { turbo: 'T', oil: 'O', shield: 'S' }[String(h.item)] ?? '—' }] };
    }
    case 'reaction':
      if (h.msg === 'early') return { text: t('early'), tone: 'bad' };
      if (h.msg === 'tapped') return { text: `${h.ms} ms`, tone: 'good' };
      return { text: `${t('round')} ${h.round ?? 1}/${h.rounds ?? '-'} · ${t('score')} ${h.score ?? 0}`, tone: 'normal' };
    case 'soccer':
      return {
        text: `${h.team === 0 ? ':dotred:' : ':dotblue:'} ${h.a ?? 0} : ${h.b ?? 0}${h.ot ? ' · GOLDEN' : ''}`, tone: 'normal',
        meter: Number(h.stamina ?? 0) / 100, meterLabel: L('ספרינט', 'SPRINT'),
        chips: [{ icon: 'kick', on: !!h.kick, label: L('בעיטה', 'KICK') }],
      };
    case 'hockey':
      return { text: `${h.team === 0 ? ':dotred:' : ':dotblue:'} ${h.a ?? 0} : ${h.b ?? 0}${h.sd ? ' · SUDDEN' : ''}`, tone: 'normal', chips: [{ icon: 'turbo', on: !!h.smash, label: L('חבטה', 'SMASH') }] };
    case 'board': {
      const ph = String(h.ph ?? '');
      const chips = [{ icon: 'star', on: Number(h.stars) > 0, label: `${h.stars ?? 0}:star: · ${h.coins ?? 0}c` }, ...(h.power ? [{ icon: 'star', on: true, label: h.power === 'double' ? '×2' : L('גניבה', 'STEAL') }] : [])];
      if (ph === 'mini' || ph === 'duel') return { text: `${L('לחצו מהר!', 'TAP FAST!')} ${h.taps ?? 0}`, tone: 'hot', chips };
      if (ph === 'done') return { text: L('המשחק נגמר!', 'Game over!'), tone: 'good', chips };
      if (ph === 'result') return { text: L('תוצאות…', 'Results…'), tone: 'normal', chips };
      if (ph === 'roll') return { text: h.me ? L('התור שלכם! לחצו על הקוביה', 'Your turn! Tap the dice') : L(`תור של ${h.who}`, `${h.who}'s turn`), tone: h.me ? 'good' : 'normal', chips };
      if (ph === 'buy') return { text: h.me ? (Number(h.can) ? L('לקנות כוכב ב־10? כן/לא', 'Buy a star for 10? Yes/No') : L('אין מספיק מטבעות', 'Not enough coins')) : L(`${h.who} שוקל/ת כוכב`, `${h.who} eyes a star`), tone: h.me ? 'good' : 'normal', chips };
      return { text: h.me ? L('זזים…', 'Moving…') : L(`תור של ${h.who}`, `${h.who}'s turn`), tone: 'normal', chips };
    }
    case 'kitchen': {
      const code = String(h.hold ?? '');
      const name = code.startsWith('plate:') ? L('צלחת', 'plate') + (code.length > 6 ? ' +' + code.slice(6).split(',').length : '') : code ? code.split('.')[0] + (code.endsWith('.c') ? ' :shovel:' : code.endsWith('.k') ? ' :flame:' : code.endsWith('.b') ? ' :boom:' : '') : L('ידיים ריקות', 'empty hands');
      return { text: `${h.score ?? 0} · ${name}`, tone: 'normal', chips: [{ icon: 'hand', on: !!code, label: `${h.orders ?? 0} ${L('הזמנות', 'orders')}` }] };
    }
    case 'trapbuilders': {
      const ph = String(h.ph ?? '');
      const kind = { spikes: L('קוצים', 'SPIKES'), saw: L('מסור', 'SAW'), pit: L('בור', 'PIT') }[String(h.kind)] ?? '';
      if (ph === 'build') return { text: `${L('בנייה', 'BUILD')} · ${kind} · ${h.left} ${L('נותרו', 'left')} · ${h.t}`, tone: 'normal', chips: [{ icon: 'star', on: Number(h.left) > 0, label: `${h.total ?? 0}` }] };
      if (ph === 'run') return h.done ? { text: L('סיימתם!', 'Finished!'), tone: 'good' } : { text: L('רוצו!', 'RUN!'), tone: 'normal', chips: [{ icon: 'dash', on: !!h.dash, label: L('הסתערות', 'DASH') }] };
      return { text: `${L('ניקוד', 'Score')} ${h.total ?? 0}`, tone: ph === 'done' ? 'good' : 'normal' };
    }
    case 'basketball':
      return { text: `${h.score ?? 0} ${L('נק׳', 'pts')} · ${h.left}s${Number(h.streak) > 1 ? ` · :flame:${h.streak}` : ''}`, tone: Number(h.streak) > 1 ? 'hot' : 'normal', chips: [{ icon: 'kick', on: Number(h.streak) >= 3, label: L('רצף', 'STREAK') + ' ' + (h.streak ?? 0) }] };
    case 'bowling':
      if (h.ph === 'done') return { text: L('המשחק נגמר!', 'Game over!'), tone: 'good' };
      if (!h.me) return { text: L(`תור של ${h.who} · ${h.total} נק׳`, `${h.who}'s turn · ${h.total} pts`), tone: 'normal' };
      return { text: h.ph === 'aim' ? L('כוונו עם הג׳ויסטיק ולחצו לנעילה', 'Aim with the stick, press to lock') : h.ph === 'power' ? L('לחצו כשהמד בירוק!', 'Press when the meter is green!') : L('מתגלגל…', 'Rolling…'), tone: 'good' };
    case 'tank':
      return { text: `${':heart:'.repeat(Math.max(0, Number(h.hp ?? 0)))} · ${L('נותרו', 'left')} ${h.left}`, tone: Number(h.hp) <= 1 ? 'bad' : 'normal', chips: [{ icon: 'fire', on: !!h.fire, label: L('ירי', 'FIRE') }, { icon: 'mine', on: !!h.mine, label: L('מוקש', 'MINE') }] };
    case 'wizard':
      if (h.down) return { text: L('הודפתם! חוזרים עוד רגע…', 'Knocked out! Back in a moment…'), tone: 'bad' };
      return { text: `${h.on ? L('את/ה על הגבעה! ', 'On the hill! ') : ''}${h.pts ?? 0} ${L('נק׳', 'pts')} · ${':heart:'.repeat(Math.max(0, Number(h.hp ?? 0)))} · ${h.left}s`, tone: h.on ? 'good' : Number(h.hp) <= 1 ? 'bad' : 'normal', chips: [{ icon: 'fire', on: !!h.fire, label: L('אש', 'FIRE') }, { icon: 'shield', on: !!h.shield, label: L('מגן', 'SHIELD') }, { icon: 'blink', on: !!h.blink, label: L('קפיצה', 'BLINK') }] };
    case 'survival': case 'defense':
      if (h.down) return { text: L('נפלתם! חבר צריך לעמוד לידכם', 'Down! A teammate must stand next to you'), tone: 'bad' };
      return { text: `${L('גל', 'Wave')} ${h.wave}/${h.waves} · ${':heart:'.repeat(Math.max(0, Number(h.hp ?? 0)))}${h.def ? ` · ${L('גביש', 'crystal')} ${h.core} · ${L('מטבעות', 'coins')} ${h.alt}` : ''}`, tone: Number(h.hp) <= 1 ? 'bad' : 'normal', chips: h.def ? [{ icon: 'fire', on: !!h.atk, label: L('ירי', 'SHOOT') }, { icon: 'star', on: Number(h.alt) >= 4, label: L('צריח', 'TURRET') }] : [{ icon: 'shove', on: !!h.atk, label: L('חיתוך', 'SLASH') }, { icon: 'dodge', on: !!h.alt, label: L('גלגול', 'ROLL') }] };
    case 'tag':
      if (h.fz) return { text: L('קפאתם! חבר צריך לעמוד לידכם', 'Frozen! A teammate must stand next to you'), tone: 'bad' };
      return { text: h.role ? `${L('את/ה המקפיא!', "You're the FREEZER!")} ${h.pts} ${L('נק׳', 'pts')} · ${h.free} ${L('חופשיים', 'free')}` : `${L('ברחו!', 'Run!')} ${h.pts} ${L('נק׳', 'pts')} · ${h.left}s`, tone: h.role ? 'hot' : 'normal', meter: Number(h.stam ?? 0) / 100, meterLabel: L('ספרינט', 'SPRINT') };
    case 'maze':
      return { text: `${L('סבב', 'Round')} ${h.round}/${h.rounds} · ${h.pts} ${L('נק׳', 'pts')}${h.done ? ' :check:' : ''}`, tone: h.done ? 'good' : 'normal', chips: [{ icon: 'dash', on: !!h.dash, label: L('הסתערות', 'DASH') }] };
    case 'rescue':
      return { text: h.stun ? L('התרסקתם!', 'Crashed!') : `${L('חולצו', 'Saved')} ${h.saved}/${h.target} · ${L('אבדו', 'lost')} ${h.lost} · ${L('נושאים', 'carrying')} ${h.carry} · ${h.left}s`, tone: h.stun ? 'bad' : 'normal', chips: [{ icon: 'turbo', on: !!h.boost, label: L('קרן', 'BEAM') }] };
    case 'evac':
      return { text: h.stun ? L('נתפסתם!', 'Caught!') : `:coin: ${h.got}/${h.total} · ${Number(h.carry) ? L('נושאים תיבה!', 'carrying a chest!') : L('ידיים ריקות', 'empty hands')} · ${h.left}s`, tone: h.stun ? 'bad' : 'normal' };
    case 'treasure':
      return { text: `:coin: ${h.score ?? 0} · ${h.left}s`, tone: Number(h.warm) > 0.7 ? 'hot' : 'normal', meter: Number(h.warm ?? 0), meterLabel: Number(h.warm) > 0.7 ? L('חם מאוד!', 'HOT!') : Number(h.warm) > 0.35 ? L('חמים', 'warm') : L('קר', 'cold'), chips: [{ icon: 'star', on: !!h.ping, label: L('מכ״ם', 'RADAR') }] };
    case 'tower':
      return h.over ? { text: `${L('המגדל', 'Tower')}: ${h.h} :brick:`, tone: 'good' } : { text: `${h.h} :brick: · :spark:${h.perfect} · ${h.left}s`, tone: 'normal' };
    case 'spacerace':
      if (h.done) return { text: `${t('finished')} #${h.place}`, tone: 'good' };
      return { text: `#${h.place}/${h.of} · ${h.pct}%`, tone: 'normal', meter: Number(h.en ?? 0) / 100, meterLabel: L('אנרגיה', 'ENERGY') };
    case 'balloon':
      return { text: `:balloon: ${h.pumps} · ${L('בכיס', 'banked')} ${h.bank} · ${h.left}s`, tone: Number(h.pumps) > 12 ? 'hot' : 'normal' };
    case 'puzzle': {
      const mine = String(h.mine ?? '').split(',').filter(Boolean).map((c) => ['▲', '●', '■', ':star:'][Number(c)]).join(' ');
      const ph = String(h.ph);
      return { text: `${L('הצבעים שלכם', 'Your colours')}: ${mine} · ${ph === 'show' ? L('זכרו!', 'Memorise!') : ph === 'enter' ? `${h.pos}/${h.len}` : ph === 'ok' ? ':check:' : ph === 'bad' ? ':cross:' : ''}`, tone: ph === 'bad' ? 'bad' : ph === 'ok' ? 'good' : 'normal' };
    }
    case 'draw': {
      const hebrew = he; const pick = (s: string) => { const [he, en] = s.split('|'); return he && en ? (hebrew ? he : en) : s; };
      if (h.ph === 'reveal') return { text: L('חושפים…', 'Revealing…'), tone: 'normal' };
      if (h.drawer) return { text: `${L('ציירו', 'Draw')}: ${pick(String(h.word))}`, tone: 'good' };
      const opts = String(h.opts ?? '').split(';').map(pick);
      return { text: h.locked ? L('ננעל! מחכים…', 'Locked! Waiting…') : `↑${opts[0]} →${opts[1]} ↓${opts[2]} ←${opts[3]}`, tone: h.locked ? 'good' : 'normal' };
    }
    case 'trivia':
      if (h.ph === 'reveal') return { text: Number(h.ok) ? `:check: ${L('נכון!', 'Correct!')} · ${h.pts}` : `:cross: · ${h.pts}`, tone: Number(h.ok) ? 'good' : 'bad' };
      return { text: Number(h.ans) >= 0 ? L('נעול! מחכים…', 'Locked! Waiting…') : `${L('שאלה', 'Q')} ${h.q}/${h.qs} · ${h.pts}`, tone: 'normal' };
    case 'vanish':
      return h.alive ? { text: `${L('נותרו', 'LEFT')} ${h.left}`, tone: 'normal', chips: [{ icon: 'jump', on: !!h.jump, label: L('קפיצה', 'JUMP') }, { icon: 'shove', on: !!h.dash, label: L('חבטה', 'SHOVE') }] } : { text: L('נפלתם! צפו בסוף', 'You fell! Watch the end'), tone: 'bad' };
    case 'rush':
      if (h.done) return { text: `${t('finished')} #${h.place}`, tone: 'good' };
      return {
        text: `#${h.place ?? '-'}/${h.of ?? '-'} · ${h.pct ?? 0}%`, tone: 'normal',
        chips: [{ icon: 'dash', on: !!h.dash, label: L('הסתערות', 'DASH') }, { icon: 'shove', on: !!h.shove, label: L('דחיפה', 'SHOVE') }],
      };
    case 'potato':
      if (h.out) return { text: t('youreOut'), tone: 'bad' };
      if (h.hot) return { text: t('youHaveBomb'), tone: 'hot', chips: [{ icon: 'throw', on: !!h.throw, label: L('זריקה', 'THROW') }] };
      return { text: `${t('round')} ${h.round ?? 1}`, tone: 'normal', chips: [{ icon: 'dash', on: !!h.sprint, label: L('ספרינט', 'SPRINT') }] };
  }
  return { text: '', tone: 'normal' };
}

/** Short "how to play" card on the phone while the countdown runs: the goal and what every control does. */
function PhoneIntro({ meta }: { meta: ReturnType<typeof getMeta> & object }) {
  const { l, lang } = useT();
  const c = meta.controller;
  const legend: { icon?: string; label: string; color: string }[] = [];
  if (c.kind === 'wheel') legend.push({ label: lang === 'he' ? 'חצים: ימינה / שמאלה' : 'Arrows: left / right', color: '#8fa0ff' });
  if (c.kind === 'stick') legend.push({ label: lang === 'he' ? 'ג׳ויסטיק: תזוזה' : 'Stick: move', color: '#8fa0ff' });
  if (c.kind === 'stick' || c.kind === 'wheel') for (const b of c.buttons) legend.push({ icon: b.icon, label: l(b.label), color: b.color });
  if (c.kind === 'tap') legend.push({ label: l(c.button.label), color: c.button.color });
  if (c.kind === 'choices') (c.labels ?? []).forEach((b, i) => legend.push({ label: l(b), color: c.colors?.[i] ?? '#fff' }));
  const first = l(meta.howTo).split(/(?<=[.!?])\s/)[0];
  return (
    <div className="phone-intro" data-testid="phone-intro">
      <h3>{l(meta.tagline)}</h3>
      <p>{first}</p>
      <ul>{legend.map((x, i) => <li key={i} style={{ ['--c' as string]: x.color }}>{x.icon && <PadIcon id={x.icon} />}<span>{x.label}</span></li>)}</ul>
    </div>
  );
}

function PhoneGame({ room, conn, hud, isLeader, act }: { room: RoomState; conn: Conn; hud: Hud; isLeader: boolean; act: (a: AdminAction) => void }) {
  const { t, l, lang } = useT();
  const meta = getMeta(room.gameId!)!;
  const v = hudView(meta.id, hud, t, lang === 'he');
  const [settings, setSettings] = usePadSettings();
  const [open, setOpen] = useState(false);
  return (
    <div className={`phone-game tone-${v.tone}`}>
      <div className="phone-game__hud">
        <span className="phone-game__title">{l(meta.name)}</span>
        <span className="phone-game__line" data-testid="hud"><Rich text={room.phase === 'countdown' ? '3 · 2 · 1' : room.phase === 'paused' ? `:pause: ${t('paused')}` : v.text} /></span>
        {v.meter !== undefined && (
          <span className="hud-meter" aria-label={v.meterLabel} data-testid="hud-meter"><i style={{ width: `${Math.round(v.meter * 100)}%` }} /><b>{v.meterLabel}</b></span>
        )}
        {v.chips?.map((c) => <span key={c.icon} className={`hud-chip ${c.on ? 'is-on' : ''}`} title={c.label}><PadIcon id={c.icon} /><span className="hud-chip__label"><Rich text={c.label} /></span></span>)}
        {isLeader && (room.phase === 'paused'
          ? <button className="hud-btn" onClick={() => act({ a: 'resume' })} aria-label={t('resume')}>▶</button>
          : <button className="hud-btn" onClick={() => act({ a: 'pause' })} aria-label={t('pause')}><Icon name="pause" size="1em" /></button>)}
        <button className="hud-btn" onClick={() => setOpen((x) => !x)} aria-label={t('padSettings')} data-testid="pad-settings"><Icon name="gear" /></button>
      </div>
      <div className="phone-game__pad">
        <Pad layout={meta.controller} conn={conn} settings={settings} />
        {room.phase === 'countdown' && <PhoneIntro meta={meta} />}
      </div>
      {open && (
        <div className="pad-sheet" role="dialog" aria-label={t('padSettings')}>
          <b>{t('padSettings')}</b>
          <div className="pad-sheet__row">
            <span>{t('buttonSize')}</span>
            {(['s', 'm', 'l'] as const).map((sz) => (
              <button key={sz} className={`chip ${settings.size === sz ? 'is-on' : ''}`} data-size={sz} onClick={() => setSettings({ size: sz })}>{sz.toUpperCase()}</button>
            ))}
          </div>
          <div className="pad-sheet__row">
            <span>{t('swapSides')}</span>
            <button className={`chip ${settings.mirrored ? 'is-on' : ''}`} data-testid="mirror" onClick={() => setSettings({ mirrored: !settings.mirrored })}>
              {settings.mirrored ? t('on') : t('off')}
            </button>
          </div>
          {meta.controller.kind === 'wheel' && (
            <>
              <div className="pad-sheet__row">
                <span>{t('steering')}</span>
                {(['wheel', 'arrows', 'tilt'] as const).map((m) => (
                  <button key={m} className={`chip ${settings.steer === m ? 'is-on' : ''}`} data-steer-mode={m} onClick={() => setSettings({ steer: m })}>
                    {t(m === 'wheel' ? 'steerWheel' : m === 'arrows' ? 'steerArrows' : 'steerTilt')}
                  </button>
                ))}
              </div>
              {settings.steer === 'tilt' && (
                <div className="pad-sheet__row">
                  <span>{t('tiltInvert')}</span>
                  <button className={`chip ${settings.tiltInvert ? 'is-on' : ''}`} onClick={() => setSettings({ tiltInvert: !settings.tiltInvert })}>{settings.tiltInvert ? t('on') : t('off')}</button>
                </div>
              )}
            </>
          )}
          {(meta.controller.kind === 'stick' || meta.controller.kind === 'wheel') && <p className="muted small">{t('tiltHint')}</p>}
          <button className="btn btn--secondary" onClick={() => setOpen(false)}><Icon name="check" /></button>
        </div>
      )}
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
          <p className="big-msg"><Rich text={r.place === 1 ? `:trophy: ${t('youWon')}` : `${t('place')} #${r.place}`} /></p>
          <p className="stars">{r.stars ? Array.from({ length: r.stars }, (_, i) => <Icon key={i} name="star" size="1.4em" />) : '—'}</p>
          <p className="muted"><Rich text={r.detail ?? ''} /></p>
        </>
      ) : <p className="big-msg">{t('watchScreen')}</p>}
      <p className="muted"><Icon name="star" /> {p.stars}</p>
      {isLeader && (
        <div className="results__actions">
          <button className="btn btn--primary btn--xl" onClick={() => act({ a: 'again' })}><Icon name="repeat" /> {t('playAgain')}</button>
          <button className="btn btn--secondary" onClick={() => act({ a: 'lobby' })}><Icon name="home" /> {t('backToLobby')}</button>
        </div>
      )}
    </div>
  );
}
