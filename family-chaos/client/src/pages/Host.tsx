import { useEffect, useRef, useState } from 'react';
import { GOD_POWERS, type AdminAction, type GodPower, type RoomState } from '../../../shared/protocol';
import { Lobby } from '../host/Lobby';
import { Results } from '../host/Results';
import { Stage } from '../host/Stage';
import { useT, type Key } from '../i18n';
import { Conn, store } from '../net';
import { ConnBanner, Logo, useConnStatus } from '../ui/common';

const GOD_LABEL: Record<GodPower, { icon: string; he: string; en: string }> = {
  confetti: { icon: '🎉', he: 'קונפטי', en: 'Confetti' }, quake: { icon: '🌋', he: 'רעידת אדמה', en: 'Earthquake' }, flash: { icon: '⚡', he: 'הבזק', en: 'Flash' },
  announce: { icon: '📣', he: 'הכרזה מלכותית', en: 'Royal fanfare' }, freeze: { icon: '🧊', he: 'הקפאה 3 שנ׳', en: 'Freeze 3s' }, slowmo: { icon: '🐌', he: 'הילוך איטי', en: 'Slow motion' },
  turbo: { icon: '🚀', he: 'טורבו לכולם', en: 'Turbo for all' }, mirror: { icon: '🪞', he: 'היגוי הפוך', en: 'Mirror controls' }, bonus: { icon: '⭐', he: '+3 כוכבים לאחד', en: '+3 stars to one' },
  steal: { icon: '🦹', he: 'גניבת כוכבים מהמוביל', en: 'Rob the leader' }, leader: { icon: '👑', he: 'החלפת מנהיג', en: 'New leader' }, end: { icon: '🏁', he: 'סיים משחק', en: 'End game' },
};

/** The big screen (TV / PC). Also used read-only for remote "watch" screens. */
export function Host({ watchCode }: { watchCode?: string }) {
  const watch = watchCode !== undefined;
  const { t, lang } = useT();
  const [conn, setConn] = useState<Conn | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needPw, setNeedPw] = useState(false);
  const [owner, setOwner] = useState(false);
  const [crown, setCrown] = useState(false);
  const pw = useRef('');
  const status = useConnStatus(conn);

  useEffect(() => {
    const c = new Conn((cn) => {
      if (watch) {
        cn.send({ t: 'watch', code: watchCode!.toUpperCase(), password: pw.current || undefined });
        return;
      }
      const saved = store.sget('fc.host');
      if (saved) {
        try {
          const { code, hostKey } = JSON.parse(saved);
          cn.send({ t: 'host_resume', code, hostKey });
          return;
        } catch { /* fallthrough */ }
      }
      cn.send({ t: 'host_create' });
    });
    const off = c.on((m) => {
      if (m.t === 'hosted') store.sset('fc.host', JSON.stringify({ code: m.code, hostKey: m.hostKey }));
      if (m.t === 'room') { setRoom(m.room); setError(null); }
      if (m.t === 'owner') setOwner(m.v);
      if (m.t === 'error') {
        if (!watch && m.code === 'no_room') { store.sdel('fc.host'); c.send({ t: 'host_create' }); return; }
        if (watch && m.code === 'bad_password') { setNeedPw(true); return; }
        if (m.code === 'not_allowed' || m.code === 'in_game') return; // transient UI races
        setError(t(`errors_${m.code}` as Key));
        // creating a room was refused because of the per-network limit: try again shortly by itself
        if (!watch && m.code === 'rate_limited') setTimeout(() => c.send({ t: 'host_create' }), 10_000);
      }
    });
    setConn(c);
    return () => { off(); c.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = (a: AdminAction) => { if (!watch) conn?.send({ t: 'admin', act: a }); };

  if (needPw && !room) {
    return (
      <div className="center-screen">
        <Logo small />
        <form className="card" onSubmit={(e) => { e.preventDefault(); setNeedPw(false); conn?.send({ t: 'watch', code: watchCode!.toUpperCase(), password: pw.current }); }}>
          <label>{t('password')}<input type="password" onChange={(e) => { pw.current = e.target.value; }} /></label>
          <button className="btn btn--primary">{t('enter')}</button>
        </form>
      </div>
    );
  }

  if (!room || !conn) {
    return <div className="center-screen"><Logo /><p className="muted">{error ?? t('connecting')}</p><ConnBanner status={status} /></div>;
  }

  const inMatch = room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'paused';
  return (
    <div className="host" data-phase={room.phase}>
      <ConnBanner status={status} />
      {room.phase === 'lobby' && <Lobby room={room} act={act} watch={watch} />}
      {inMatch && <Stage room={room} conn={conn} act={act} watch={watch} />}
      {room.phase === 'results' && <Results room={room} act={act} watch={watch} />}
      {owner && !watch && (
        <div className="crown" data-testid="crown">
          <button className="crown__btn" onClick={() => setCrown((v) => !v)} aria-expanded={crown} aria-label="Crown powers" data-testid="crown-btn">👑</button>
          {crown && (
            <div className="crown__menu" role="menu">
              {room.tour && !room.tour.done && <p className="muted small">{t('errors_competitive')}</p>}
              {GOD_POWERS.map((p) => (
                <button key={p} role="menuitem" className="chip" disabled={!!room.tour && !room.tour.done} data-power={p} onClick={() => conn.send({ t: 'god', power: p })}>
                  {GOD_LABEL[p].icon} {GOD_LABEL[p][lang]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <div className="toast" role="alert" onClick={() => setError(null)}>{error}</div>}
    </div>
  );
}
