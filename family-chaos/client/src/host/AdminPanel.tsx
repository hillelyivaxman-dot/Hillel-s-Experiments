import { useEffect, useRef, useState } from 'react';
import { CATALOG, CATEGORY_NAMES, getMeta } from '../../../shared/catalog';
import { GOD_POWERS, type AdminAction, type GodPower, type RoomState } from '../../../shared/protocol';
import { useT } from '../i18n';
import type { Conn } from '../net';
import { Icon } from '../ui/icons';

const POWERS: Record<GodPower, { icon: string; he: [string, string]; en: [string, string]; live?: boolean; target?: boolean }> = {
  confetti: { icon: 'spark', he: ['קונפטי', 'חגיגת קונפטי על המסך'], en: ['Confetti', 'A burst of confetti on the big screen'] },
  quake: { icon: 'boom', he: ['רעידת אדמה', 'המסך רועד חזק'], en: ['Earthquake', 'The screen shakes hard'] },
  flash: { icon: 'bolt', he: ['הבזק', 'הבזק לבן על המסך'], en: ['Flash', 'A white flash'] },
  announce: { icon: 'crown', he: ['הכרזה מלכותית', 'כתר גדול וניצוצות'], en: ['Royal fanfare', 'A giant crown and sparks'] },
  freeze: { icon: 'ice', he: ['הקפאה', 'המשחק נעצר ל־3 שניות ואז ממשיך'], en: ['Freeze', 'The game stops for 3 seconds, then continues'], live: true },
  slowmo: { icon: 'clock', he: ['הילוך איטי', 'המשחק מואט ל־6 שניות'], en: ['Slow motion', 'The game runs at half speed for 6 s'], live: true },
  turbo: { icon: 'rocket', he: ['טורבו לכולם', 'המשחק מואץ ל־6 שניות'], en: ['Turbo for all', 'The game runs 1.5x faster for 6 s'], live: true },
  mirror: { icon: 'repeat', he: ['היגוי הפוך', 'כל הבקרים הפוכים ל־6 שניות'], en: ['Mirror controls', 'Everyone steers backwards for 6 s'], live: true },
  bonus: { icon: 'star', he: ['+3 כוכבים', 'מעניק 3 כוכבי ערב לשחקן שבחרתם (או אקראי)'], en: ['+3 stars', 'Gives 3 evening stars to the chosen (or a random) player'], target: true },
  steal: { icon: 'coin', he: ['גניבת כוכבים', 'לוקח עד 2 כוכבים מהמוביל ונותן לאחרון'], en: ['Rob the leader', 'Moves up to 2 stars from the leader to the last place'] },
  leader: { icon: 'crown', he: ['החלפת מנהיג', 'מנהיג חדש לחדר (השחקן שבחרתם או אקראי)'], en: ['New room leader', 'Makes the chosen (or a random) player the leader'], target: true },
  end: { icon: 'flag', he: ['סיום המשחק', 'מסיים עכשיו ומציג תוצאות'], en: ['End the game', 'Ends it right now and shows the results'], live: true },
};

interface Alert { id: number; text: string; bad: boolean }

/** Owner-only management screen on the host: game control, game choice, tournaments, the 12 crown powers, players and connection alerts. */
export function AdminPanel({ room, conn, act, onClose }: { room: RoomState; conn: Conn; act: (a: AdminAction) => void; onClose: () => void }) {
  const { l, lang } = useT();
  const [target, setTarget] = useState('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const prev = useRef(new Map<string, boolean>());
  const seq = useRef(0);
  const live = room.phase === 'playing' || room.phase === 'paused' || room.phase === 'countdown';
  const tourOn = !!room.tour && !room.tour.done;
  const meta = room.gameId ? getMeta(room.gameId) : getMeta(room.selectedGame);

  useEffect(() => { // connection alerts: who dropped / came back / is very slow
    const add = (text: string, bad: boolean) => setAlerts((a) => [{ id: seq.current++, text, bad }, ...a].slice(0, 6));
    for (const p of room.players) {
      const was = prev.current.get(p.id);
      if (was === true && !p.connected) add(l({ he: `${p.name} התנתק/ה`, en: `${p.name} disconnected` }), true);
      if (was === false && p.connected) add(l({ he: `${p.name} חזר/ה`, en: `${p.name} reconnected` }), false);
      prev.current.set(p.id, p.connected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.players]);

  const power = (p: GodPower) => {
    const d = POWERS[p];
    const reason = tourOn ? l({ he: 'כבוי בטורניר (מצב תחרותי)', en: 'Off during tournaments (competitive)' }) : d.live && !live ? l({ he: 'זמין רק בזמן משחק', en: 'Only during a game' }) : '';
    return (
      <button key={p} className="admin-power" data-power={p} disabled={!!reason} title={reason || undefined} onClick={() => conn.send({ t: 'god', power: p, target: d.target && target ? target : undefined })}>
        <Icon name={d.icon} size="1.5em" />
        <span><b>{lang === 'he' ? d.he[0] : d.en[0]}</b><small>{reason || (lang === 'he' ? d.he[1] : d.en[1])}</small></span>
      </button>
    );
  };
  const pingClass = (ms: number, on: boolean) => (!on ? 'is-bad' : ms > 400 ? 'is-bad' : ms > 150 ? 'is-warn' : 'is-ok');
  const down = room.players.filter((p) => !p.connected);

  return (
    <aside className="admin-panel" data-testid="admin-panel" role="dialog" aria-label={l({ he: 'ניהול', en: 'Admin' })}>
      <header>
        <h2><Icon name="crown" size="1.2em" /> {l({ he: 'ניהול', en: 'Admin' })}</h2>
        <button className="chip" onClick={onClose} data-testid="admin-close" aria-label="close"><Icon name="cross" size="1em" /></button>
      </header>
      {down.length > 0 && <p className="admin-alert is-bad" role="alert">{l({ he: `${down.length} שחקנים מנותקים: ${down.map((p) => p.name).join(', ')}`, en: `${down.length} player(s) offline: ${down.map((p) => p.name).join(', ')}` })}</p>}
      <p className="muted small">{meta ? l(meta.name) : ''} · {room.phase}{tourOn ? ` · ${l({ he: 'טורניר', en: 'tournament' })} ${room.tour!.idx + 1}/${room.tour!.total}` : ''}</p>

      <section>
        <h3>{l({ he: 'שליטה במשחק', en: 'Game control' })}</h3>
        <div className="admin-row">
          {!live && <button className="btn btn--primary" data-testid="admin-start" onClick={() => act({ a: 'start' })}><Icon name="play" size="1em" /> {l({ he: 'התחל', en: 'Start' })}</button>}
          {live && room.phase !== 'countdown' && <button className="chip" onClick={() => act({ a: room.phase === 'paused' ? 'resume' : 'pause' })}><Icon name={room.phase === 'paused' ? 'play' : 'pause'} size="1em" /> {room.phase === 'paused' ? l({ he: 'המשך', en: 'Resume' }) : l({ he: 'השהה', en: 'Pause' })}</button>}
          {live && <button className="chip" data-testid="admin-end" onClick={() => act({ a: 'end' })}><Icon name="stop" size="1em" /> {l({ he: 'סיים משחק', en: 'End game' })}</button>}
          <button className="chip" data-testid="admin-lobby" onClick={() => act({ a: 'lobby' })}><Icon name="home" size="1em" /> {l({ he: 'כולם ללובי', en: 'Everyone to lobby' })}</button>
        </div>
      </section>

      <section>
        <h3>{l({ he: 'בחירת משחק', en: 'Pick a game' })}</h3>
        <select className="admin-select" value={room.selectedGame} disabled={live} onChange={(e) => act({ a: 'select', game: e.target.value })} aria-label={l({ he: 'בחירת משחק', en: 'Pick a game' })} data-testid="admin-game">
          {[...new Set(CATALOG.map((g) => g.category))].map((c) => (
            <optgroup key={c} label={l(CATEGORY_NAMES[c])}>
              {CATALOG.filter((g) => g.category === c && g.status === 'playable').map((g) => <option key={g.id} value={g.id}>{l(g.name)}</option>)}
            </optgroup>
          ))}
        </select>
        {live && <p className="muted small">{l({ he: 'אפשר לבחור משחק אחרי שהסיבוב נגמר.', en: 'You can pick another game when the round ends.' })}</p>}
      </section>

      <section>
        <h3>{l({ he: 'טורניר', en: 'Tournament' })}</h3>
        {tourOn
          ? (
            <div className="admin-row">
              <button className="chip" onClick={() => act({ a: 'tour_skip' })} disabled={room.phase !== 'results'}>{l({ he: 'המשחק הבא עכשיו', en: 'Next game now' })}</button>
              <button className="chip" onClick={() => act({ a: 'tour_hold', hold: !room.tour!.held })}>{room.tour!.held ? l({ he: 'המשך', en: 'Resume' }) : l({ he: 'עצור בין משחקים', en: 'Hold between games' })}</button>
              <button className="chip" onClick={() => act({ a: 'tour_cancel' })}><Icon name="cross" size="1em" /> {l({ he: 'בטל', en: 'Cancel' })}</button>
            </div>
          )
          : (
            <div className="admin-row">
              {[3, 5, 8].map((n) => <button key={n} className="chip" disabled={live} onClick={() => act({ a: 'tournament', count: n })}>{n} {l({ he: 'משחקים', en: 'games' })}</button>)}
              <button className="chip" disabled={live} onClick={() => act({ a: 'tournament', mode: 'knockout' })}><Icon name="fire" size="1em" /> {l({ he: 'נוק־אאוט', en: 'Knockout' })}</button>
            </div>
          )}
        <p className="muted small">{l({ he: 'בטורניר כוחות הכתר כבויים, כדי שהתחרות תישאר הוגנת.', en: 'Crown powers are off during tournaments, to keep the contest fair.' })}</p>
      </section>

      <section>
        <h3>{l({ he: 'כוחות הכתר', en: 'Crown powers' })}</h3>
        <label className="admin-target">{l({ he: 'שחקן יעד (לכוחות שצריכים)', en: 'Target player (for powers that need one)' })}
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="admin-select" data-testid="admin-target">
            <option value="">{l({ he: 'אקראי', en: 'Random' })}</option>
            {room.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="admin-powers">{GOD_POWERS.map(power)}</div>
      </section>

      <section>
        <h3>{l({ he: 'שחקנים מחוברים', en: 'Players' })}</h3>
        <ul className="admin-players" data-testid="admin-players">
          {room.players.map((p) => (
            <li key={p.id}>
              <i style={{ background: p.color }} />
              <b>{p.name}</b>
              {p.id === room.leaderId && <Icon name="crown" size="1em" />}
              <span className={`admin-ping ${pingClass(p.rtt ?? 0, p.connected)}`}>{p.connected ? `${p.rtt ?? 0} ms` : l({ he: 'מנותק', en: 'offline' })}</span>
              <span className="admin-mini">
                <button className="mini" onClick={() => act({ a: 'leader', playerId: p.id })} aria-label="leader"><Icon name="crown" size="1em" /></button>
                <button className="mini mini--danger" onClick={() => act({ a: 'kick', playerId: p.id })} aria-label="kick"><Icon name="cross" size="1em" /></button>
              </span>
            </li>
          ))}
        </ul>
        {alerts.length > 0 && <ul className="admin-alerts">{alerts.map((a) => <li key={a.id} className={a.bad ? 'is-bad' : 'is-ok'}>{a.text}</li>)}</ul>}
      </section>
    </aside>
  );
}
