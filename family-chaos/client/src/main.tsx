import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Lang } from '../../shared/protocol';
import { initialLang, LangCtx } from './i18n';
import { store } from './net';
import { prefs } from './prefs';
import { Account } from './pages/Account';
import { Admin } from './pages/Admin';
import { Home } from './pages/Home';
import { Host } from './pages/Host';
import { Join } from './pages/Join';
import { unlockAudio } from './sound';
import { installCompat, isSupported } from './compat';
import './styles.css';

installCompat();

function route() {
  const p = location.pathname.replace(/\/+$/, '');
  if (p === '/host') return { page: 'host' as const };
  if (p === '/account') return { page: 'account' as const };
  if (p === '/admin') return { page: 'admin' as const };
  if (p === '/watch' || p.startsWith('/watch/')) return { page: 'watch' as const, code: p.split('/')[2] ?? '' };
  if (p === '/join' || p.startsWith('/join/')) return { page: 'join' as const, code: p.split('/')[2] ?? '' };
  return { page: 'home' as const };
}

function App() {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [r, setR] = useState(route);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }, [lang]);
  useEffect(() => {
    const onPop = () => setR(route());
    window.addEventListener('popstate', onPop);
    // iOS Safari only unlocks audio inside a user gesture: try on the first touch, click and key press
    const unlock = () => unlockAudio();
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { once: true });
    document.documentElement.dataset.motion = prefs.reducedMotion ? 'reduced' : 'full';
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const setLang = (l: Lang) => {
    store.set('fc.lang', l);
    setLangState(l);
  };
  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      {r.page === 'home' && <Home />}
      {r.page === 'host' && <Host />}
      {r.page === 'account' && <Account />}
      {r.page === 'admin' && <Admin />}
      {r.page === 'watch' && <Host watchCode={r.code} />}
      {r.page === 'join' && <Join initialCode={r.code} />}
    </LangCtx.Provider>
  );
}

const rootEl = document.getElementById('root')!;
if (isSupported()) createRoot(rootEl).render(<StrictMode><App /></StrictMode>);
else {
  rootEl.innerHTML = `<div class="unsupported card"><b>FAMILY CHAOS</b><p>הדפדפן הזה ישן מדי. עדכנו את Chrome / Safari / Edge / Firefox ונסו שוב.</p><p>This browser is too old. Please update Chrome, Safari, Edge or Firefox.</p></div>`;
}
