import { useEffect, useState } from 'react';
import { api } from '../account';
import { useT } from '../i18n';
import { Icon } from '../ui/icons';
import { Logo, SettingsBar } from '../ui/common';

interface Status { accounts: string; persistent: boolean; signedIn: boolean; role: string | null; nickname: string | null; ownerClaimed: boolean; codeFromEnv: boolean }

/** /admin — one clear page that says what is needed to become the owner (and what is missing on this server). */
export function Admin() {
  const { l } = useT();
  const [st, setSt] = useState<Status | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => { fetch('/api/admin/status', { credentials: 'same-origin' }).then((r) => r.json()).then(setSt).catch(() => setSt(null)); };
  useEffect(load, []);

  const step = (n: number, ok: boolean, title: string, body: React.ReactNode) => (
    <li className={`admin-step ${ok ? 'is-ok' : ''}`} data-testid={`admin-step-${n}`}>
      <span className="admin-step__n">{ok ? <Icon name="check" size="1.2em" /> : n}</span>
      <div><h3>{title}</h3>{body}</div>
    </li>
  );

  return (
    <div className="center-screen admin-page">
      <header className="topbar"><Logo small /><SettingsBar /></header>
      <div className="card admin-card">
        <h1><Icon name="crown" size="1.3em" /> {l({ he: 'ניהול האתר', en: 'Site admin' })}</h1>
        <p className="muted">{l({ he: 'כפתור הכתר (12 כוחות על המשחק) מופיע רק לבעל האתר, והשרת בודק זאת בכל פעולה. כך מגדירים:', en: 'The crown button (12 powers over the game) is only for the site owner, and the server checks it on every action. Setup:' })}</p>
        {!st ? <p className="muted">…</p> : (
          <ol className="admin-steps">
            {step(1, st.accounts !== 'off' && st.persistent,
              l({ he: 'מסד נתונים לחשבונות', en: 'A database for accounts' }),
              st.accounts === 'off'
                ? <p>{l({ he: 'החשבונות כבויים בשרת הזה, ולכן אי אפשר להפעיל אדמין. ב־Render: Environment ← Add Variable ← שם: DATABASE_URL, ערך: כתובת החיבור מ־Neon (חינם), ואז Save. ההוראות המלאות ב־docs/DEPLOY.md.', en: 'Accounts are off on this server, so admin cannot be enabled. On Render: Environment → Add Variable → name DATABASE_URL, value the Neon (free) connection string, then Save. Full steps in docs/DEPLOY.md.' })}</p>
                : st.persistent ? <p>{l({ he: 'מחובר ושומר נתונים.', en: 'Connected and persistent.' })}</p>
                  : <p className="warn">{l({ he: 'החשבונות עובדים אבל הנתונים נמחקים בהפעלה מחדש. חברו DATABASE_URL.', en: 'Accounts work but are wiped on restart. Set DATABASE_URL.' })}</p>)}
            {step(2, st.signedIn,
              l({ he: 'כניסה לחשבון', en: 'Sign in' }),
              st.signedIn ? <p>{l({ he: `מחוברים כ־${st.nickname}`, en: `Signed in as ${st.nickname}` })}</p>
                : <p>{st.accounts === 'off' ? l({ he: 'זמין אחרי שלב 1.', en: 'Available after step 1.' }) : <a className="btn btn--secondary" href="/account">{l({ he: 'הרשמה / כניסה', en: 'Register / sign in' })}</a>}</p>)}
            {step(3, st.role === 'OWNER',
              l({ he: 'קוד בעלים (פעם אחת)', en: 'Owner code (one time)' }),
              st.role === 'OWNER' ? <p data-testid="admin-owner-ok">{l({ he: 'אתם בעלי האתר.', en: 'You are the owner.' })}</p>
                : st.ownerClaimed ? <p className="warn">{l({ he: 'כבר יש בעלים לאתר הזה. רק הוא רואה את כפתור הכתר.', en: 'This site already has an owner. Only they see the crown.' })}</p>
                  : st.signedIn ? (
                    <form className="stack" onSubmit={async (e) => { e.preventDefault(); const r = await api('/api/me/owner', { code }); setMsg(r.ok ? l({ he: 'הוגדרתם כבעלים!', en: 'You are now the owner!' }) : l({ he: 'הקוד שגוי.', en: 'Wrong code.' })); setCode(''); load(); }}>
                      <p className="muted small">{st.codeFromEnv ? l({ he: 'הקוד הוא הערך של OWNER_SETUP_CODE שהגדרתם ב־Render.', en: 'The code is the OWNER_SETUP_CODE value you set on Render.' }) : l({ he: 'הקוד מודפס ב־Render ← Logs, בשורה שמתחילה ב־OWNER SETUP CODE (או הגדירו בעצמכם OWNER_SETUP_CODE).', en: 'The code is printed in Render → Logs on a line starting with OWNER SETUP CODE (or set OWNER_SETUP_CODE yourself).' })}</p>
                      <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" dir="ltr" data-testid="admin-code" />
                      <button className="btn btn--primary" data-testid="admin-claim">{l({ he: 'אישור', en: 'Claim' })}</button>
                      {msg && <p role="status">{msg}</p>}
                    </form>
                  ) : <p>{l({ he: 'זמין אחרי כניסה לחשבון.', en: 'Available after signing in.' })}</p>)}
            {step(4, st.role === 'OWNER',
              l({ he: 'פותחים את מסך המארח', en: 'Open the host screen' }),
              <p>{st.role === 'OWNER'
                ? <a className="btn btn--primary" href="/host" data-testid="admin-open-host">{l({ he: 'פתיחת מסך המארח', en: 'Open host screen' })}</a>
                : l({ he: 'באותו דפדפן שבו התחברתם, פתחו /host. יופיע כפתור כתר עם לוח ניהול בעברית.', en: 'In the same browser, open /host. A crown button with an admin panel appears.' })}</p>)}
          </ol>
        )}
      </div>
    </div>
  );
}
