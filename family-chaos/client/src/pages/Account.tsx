import { useState } from 'react';
import { ACHIEVEMENTS } from '../../../shared/achievements';
import { getMeta } from '../../../shared/catalog';
import { AVATAR_COUNT, PLAYER_COLORS } from '../../../shared/protocol';
import { api, useMe, type Me } from '../account';
import { useT, type Key } from '../i18n';
import { sfx } from '../sound';
import { CritterCanvas, Logo, savedProfile, SettingsBar } from '../ui/common';

type T = ReturnType<typeof useT>['t'];
const KNOWN = ['bad_email', 'weak_password', 'bad_name', 'email_taken', 'bad_login', 'locked', 'rate_limited', 'signed_out', 'accounts_unavailable'];
const errText = (t: T, e?: string) => t((KNOWN.includes(e ?? '') ? `acc_${e}` : 'acc_generic') as Key);

function AvatarPicker({ value, onChange, color }: { value: number; onChange: (v: number) => void; color?: string }) {
  return (
    <div className="avatar-pick">
      {Array.from({ length: AVATAR_COUNT }, (_, i) => (
        <button type="button" key={i} className={`avatar-opt ${value === i ? 'is-on' : ''}`} aria-pressed={value === i} onClick={() => { onChange(i); sfx.click(); }}>
          <CritterCanvas color={color ?? PLAYER_COLORS[i % PLAYER_COLORS.length]} variant={i} size={52} animate={value === i} />
        </button>
      ))}
    </div>
  );
}

function SignedOut({ reload, persistent }: { reload: () => void; persistent: boolean }) {
  const { t } = useT();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState(savedProfile.name());
  const [avatar, setAvatar] = useState(savedProfile.avatar());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = mode === 'in'
      ? await api('/api/auth/login', { email, password })
      : await api('/api/auth/register', { email, password, nickname, avatar });
    setBusy(false);
    if (!r.ok) { setError(errText(t, r.error)); sfx.bad(); return; }
    sfx.join();
    reload();
  };

  return (
    <form className="card account-form" onSubmit={submit} data-testid="auth-form">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'in'} className={`chip ${mode === 'in' ? 'is-on' : ''}`} onClick={() => setMode('in')}>{t('signIn')}</button>
        <button type="button" role="tab" aria-selected={mode === 'up'} className={`chip ${mode === 'up' ? 'is-on' : ''}`} onClick={() => setMode('up')} data-testid="tab-register">{t('register')}</button>
      </div>
      <p className="muted small">{t('guestNote')}</p>
      {!persistent && <p className="warn small">{t('tempAccounts')}</p>}
      <label>{t('email')}<input type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></label>
      <label>{mode === 'in' ? t('passwordLbl') : t('newPassword')}
        <input type="password" name="password" required minLength={mode === 'up' ? 8 : undefined} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
      </label>
      {mode === 'up' && (
        <>
          <label>{t('yourName')}<input name="nickname" maxLength={14} required value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="nickname" /></label>
          <fieldset className="avatar-fieldset"><legend>{t('pickCritter')}</legend><AvatarPicker value={avatar} onChange={setAvatar} /></fieldset>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn--primary btn--xl" disabled={busy} data-testid="auth-submit">{mode === 'in' ? t('signIn') : t('register')}</button>
    </form>
  );
}

function SignedIn({ me, reload }: { me: Me; reload: () => void }) {
  const { t, l, lang } = useT();
  const u = me.user!;
  const s = me.stats!;
  const [nickname, setNickname] = useState(u.nickname);
  const [avatar, setAvatar] = useState(u.avatar);
  const [msg, setMsg] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [del, setDel] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const color = PLAYER_COLORS[u.avatar % PLAYER_COLORS.length];
  const fmt = new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api('/api/me', { nickname, avatar });
    setMsg(r.ok ? t('saved') : errText(t, r.error));
    if (r.ok) { savedProfile.save(nickname, avatar); reload(); }
  };

  return (
    <div className="profile">
      <section className="card profile__head">
        <CritterCanvas color={color} variant={u.avatar} size={120} />
        <div>
          <h1 className="profile__name" data-testid="profile-name">{u.nickname}</h1>
          <p className="muted" dir="ltr">{u.email}</p>
          {!me.persistent && <p className="warn small">{t('tempAccounts')}</p>}
        </div>
        <div className="profile__actions">
          <a className="btn btn--primary" href="/host">📺 {t('playNow')}</a>
          <button className="chip" data-testid="sign-out" onClick={async () => { await api('/api/auth/logout', {}); reload(); }}>{t('signOut')}</button>
        </div>
      </section>

      <section className="stat-cards">
        <div className="stat"><b data-testid="stat-games">{s.games}</b><span>{t('games')}</span></div>
        <div className="stat"><b data-testid="stat-wins">{s.wins}</b><span>{t('wins')}</span></div>
        <div className="stat"><b data-testid="stat-stars">{s.stars}</b><span>⭐ {t('stars')}</span></div>
      </section>

      <section className="card">
        <h2>{t('achievements')}</h2>
        <div className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const done = me.achievements?.find((x) => x.id === a.id)?.done;
            return (
              <div key={a.id} className={`ach ${done ? 'is-done' : ''}`} data-ach={a.id} data-done={done ? 1 : 0}>
                <span className="ach__icon">{a.icon}</span><b>{l(a.name)}</b><small>{l(a.desc)}</small>
              </div>
            );
          })}
        </div>
      </section>

      <div className="profile__cols">
        <section className="card">
          <h2>{t('favorites')}</h2>
          {me.favorites?.length ? (
            <ol className="plain-list">{me.favorites.map((g) => <li key={g}>{getMeta(g) ? l(getMeta(g)!.name) : g} · {s.perGame[g]?.plays}</li>)}</ol>
          ) : <p className="muted">{t('noHistory')}</p>}
          <h2>{t('history')}</h2>
          {me.history?.length ? (
            <ol className="plain-list history" data-testid="history">
              {me.history.map((h, i) => (
                <li key={i}><span>{getMeta(h.game) ? l(getMeta(h.game)!.name) : h.game}</span><span>#{h.place}/{h.players} {'⭐'.repeat(h.stars)}</span><small className="muted">{fmt.format(new Date(h.at))}</small></li>
              ))}
            </ol>
          ) : <p className="muted">{t('noHistory')}</p>}
        </section>

        <section className="card">
          <h2>{t('profileSettings')}</h2>
          <form className="stack" onSubmit={saveProfile}>
            <label>{t('yourName')}<input value={nickname} maxLength={14} onChange={(e) => setNickname(e.target.value)} /></label>
            <AvatarPicker value={avatar} onChange={setAvatar} color={color} />
            <button className="btn btn--secondary">{t('save')}</button>
            {msg && <p className="muted" role="status">{msg}</p>}
          </form>
          <h2>{t('changePassword')}</h2>
          <form className="stack" onSubmit={async (e) => {
            e.preventDefault();
            const r = await api('/api/me/password', pw);
            setMsg(r.ok ? t('passwordChanged') : errText(t, r.error));
            if (r.ok) setPw({ current: '', next: '' });
          }}>
            <label>{t('currentPassword')}<input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} dir="ltr" /></label>
            <label>{t('newPassword')}<input type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} dir="ltr" /></label>
            <button className="btn btn--secondary">{t('changePassword')}</button>
          </form>
          <button className="mini mini--danger danger-link" onClick={() => setShowDelete((x) => !x)}>{t('deleteAccount')}</button>
          {showDelete && (
            <form className="stack" onSubmit={async (e) => {
              e.preventDefault();
              const r = await api('/api/me/delete', { password: del });
              if (r.ok) reload(); else setMsg(errText(t, r.error));
            }}>
              <p className="warn small">{t('deleteWarn')}</p>
              <input type="password" autoComplete="current-password" value={del} onChange={(e) => setDel(e.target.value)} dir="ltr" />
              <button className="btn btn--primary">{t('deleteAccount')}</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

export function Account() {
  const { t } = useT();
  const [me, reload] = useMe();
  return (
    <div className="account-page">
      <header className="topbar"><a href="/" aria-label={t('backHome')}><Logo small /></a><SettingsBar /></header>
      <main className="account-main">
        {!me ? <p className="muted">{t('connecting')}</p> : me.signedIn ? <SignedIn me={me} reload={reload} /> : <SignedOut reload={reload} persistent={me.persistent} />}
      </main>
    </div>
  );
}
