import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG, CATEGORY_NAMES, type Category } from '../../../shared/catalog';
import { PLAYER_COLORS } from '../../../shared/protocol';
import { useMe } from '../account';
import { useT } from '../i18n';
import { prefs } from '../prefs';
import { store } from '../net';
import { sfx } from '../sound';
import { introCards } from '../ui/intro';
import { CritterCanvas, GameCard, Logo, SettingsBar } from '../ui/common';

gsap.registerPlugin(useGSAP);

export function Home() {
  const { t, l } = useT();
  const root = useRef<HTMLDivElement>(null);
  const [me] = useMe();
  const [accountsOn, setAccountsOn] = useState(true);
  useEffect(() => { fetch('/api/info').then((r) => r.json()).then((i: { accounts?: string }) => setAccountsOn(i.accounts !== 'off')).catch(() => {}); }, []);
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [code, setCode] = useState('');
  const cats = useMemo(() => [...new Set(CATALOG.map((g) => g.category))], []);
  const [query, setQuery] = useState('');
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [favs, setFavs] = useState<string[]>(() => { try { return JSON.parse(store.get('fc.favs') ?? '[]'); } catch { return []; } });
  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    setFavs(next); store.set('fc.favs', JSON.stringify(next)); sfx.click();
  };
  const q = query.trim().toLowerCase();
  const games = CATALOG
    .filter((g) => (cat === 'all' || g.category === cat) && (!onlyFavs || favs.includes(g.id)) &&
      (!q || g.name.he.toLowerCase().includes(q) || g.name.en.toLowerCase().includes(q) || g.tagline.en.toLowerCase().includes(q) || g.tagline.he.includes(q) || l(CATEGORY_NAMES[g.category]).toLowerCase().includes(q)))
    .sort((a, b) => (favs.includes(b.id) ? 1 : 0) - (favs.includes(a.id) ? 1 : 0) || (a.status === b.status ? 0 : a.status === 'playable' ? -1 : 1));

  useGSAP(() => {
    if (prefs.reducedMotion) return;
    const tl = gsap.timeline({ defaults: { ease: 'back.out(1.8)' } });
    tl.from('.logo__family', { y: -60, opacity: 0, duration: 0.5 })
      .from('.logo__ch', { y: 80, scale: 0.2, rotate: () => gsap.utils.random(-40, 40), opacity: 0, stagger: 0.07, duration: 0.6 }, '-=0.2')
      .from('.hero__tagline, .hero__sub', { y: 20, opacity: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' }, '-=0.2')
      .from('.hero__cta > *', { scale: 0.6, opacity: 0, stagger: 0.1, duration: 0.5 }, '-=0.2')
      .from('.hero__crowd > *', { y: 120, opacity: 0, stagger: 0.06, duration: 0.6 }, '-=0.5')
      .add(() => {
        gsap.to('.hero__crowd > *', { y: -10, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.15, from: 'random' } });
      });
    introCards('.library .game-card', { y: 40, delay: 0.6, stagger: 0.04 });
  }, { scope: root });

  const go = (path: string) => { sfx.click(); location.assign(path); };

  return (
    <div className="home" ref={root}>
      <header className="topbar">
        {accountsOn && <a className="chip account-chip" href="/account" data-testid="account-link">
          👤 {me?.signedIn ? me.user!.nickname : t('signIn')}
        </a>}
        <SettingsBar />
      </header>
      <section className="hero">
        <Logo />
        <p className="hero__tagline">{t('tagline')}</p>
        <p className="hero__sub">{t('sub')}</p>
        <div className="hero__cta">
          <button className="btn btn--primary btn--xl" onClick={() => go('/host')} data-testid="host-btn">📺 {t('host')}</button>
          <form className="join-inline" onSubmit={(e) => { e.preventDefault(); go(`/join/${code}`); }}>
            <input
              className="code-input" value={code} maxLength={4} placeholder="ABCD" dir="ltr" aria-label={t('code')}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            />
            <button className="btn btn--secondary" type="submit">📱 {t('joinPhone')}</button>
          </form>
        </div>
        <div className="hero__crowd" aria-hidden="true">
          {PLAYER_COLORS.slice(0, 8).map((c, i) => <CritterCanvas key={i} color={c} variant={(i * 5) % 12} size={88} />)}
        </div>
      </section>

      <section className="how">
        <h2>{t('howItWorks')}</h2>
        <ol className="how__steps">
          <li><span>1</span>{t('step1')}</li>
          <li><span>2</span>{t('step2')}</li>
          <li><span>3</span>{t('step3')}</li>
        </ol>
      </section>

      <section className="library">
        <h2>{t('library')}</h2>
        <div className="library__tools">
          <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchGames')} aria-label={t('searchGames')} data-testid="game-search" />
          <button className={`chip ${onlyFavs ? 'is-on' : ''}`} onClick={() => setOnlyFavs((v) => !v)} aria-pressed={onlyFavs} data-testid="favs-toggle">★ {t('favorites')} ({favs.length})</button>
        </div>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={cat === 'all'} className={`chip ${cat === 'all' ? 'is-on' : ''}`} onClick={() => setCat('all')}>{t('all')}</button>
          {cats.map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'is-on' : ''}`} onClick={() => setCat(c)}>
              {l(CATEGORY_NAMES[c])}
            </button>
          ))}
        </div>
        <div className="library__grid">
          {games.map((g) => (
            <div className="game-wrap" key={g.id}>
              <GameCard g={g} showTime onClick={() => go('/host')} />
              <button className={`fav-btn ${favs.includes(g.id) ? 'is-on' : ''}`} onClick={() => toggleFav(g.id)} aria-pressed={favs.includes(g.id)} aria-label={`${t('favorites')}: ${l(g.name)}`} data-fav={g.id}>★</button>
            </div>
          ))}
          {!games.length && <p className="muted">{t('noGames')}</p>}
        </div>
      </section>
      <footer className="footer">{t('privacy')} · FAMILY CHAOS</footer>
    </div>
  );
}
