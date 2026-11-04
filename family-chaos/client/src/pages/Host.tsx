import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/icons';
import type { AdminAction, RoomState } from '../../../shared/protocol';
import { Lobby } from '../host/Lobby';
import { AdminPanel } from '../host/AdminPanel';
import { Results } from '../host/Results';
import { Stage } from '../host/Stage';
import { useT, type Key } from '../i18n';
import { Conn, store } from '../net';
import { prefs } from '../prefs';
import { ConnBanner, Logo, useConnStatus } from '../ui/common';

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
  const shell = useRef<HTMLDivElement>(null);
  const groupNow = room ? (room.phase === 'lobby' ? 'lobby' : room.phase === 'results' ? 'results' : 'match') : '';
  useEffect(() => { // smooth lobby <-> game <-> results transition
    if (!groupNow || prefs.reducedMotion || !shell.current) return;
    gsap.fromTo(shell.current, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out', clearProps: 'opacity,transform' });
  }, [groupNow]);

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

  const group = room.phase === 'lobby' ? 'lobby' : room.phase === 'results' ? 'results' : 'match';
  const inMatch = room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'paused';
  return (
    <div className="host" data-phase={room.phase} ref={shell} data-group={group}>
      <ConnBanner status={status} />
      {room.phase === 'lobby' && <Lobby room={room} act={act} watch={watch} />}
      {inMatch && <Stage room={room} conn={conn} act={act} watch={watch} />}
      {room.phase === 'results' && <Results room={room} act={act} watch={watch} />}
      {room.chaos && <div className="chaos-banner" data-testid="chaos-banner"><Icon name="fire" size="1em" /> {lang === 'he' ? 'מצב כאוס' : 'CHAOS MODE'}</div>}
      {owner && !watch && (
        <div className="crown" data-testid="crown">
          <button className="crown__btn" onClick={() => setCrown((v) => !v)} aria-expanded={crown} aria-label="Admin" data-testid="crown-btn"><Icon name="crown" size="1.2em" /></button>
        </div>
      )}
      {owner && !watch && crown && <AdminPanel room={room} conn={conn} act={act} onClose={() => setCrown(false)} />}
      {error && <div className="toast" role="alert" onClick={() => setError(null)}>{error}</div>}
    </div>
  );
}
