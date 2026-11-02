import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Lang } from '../../shared/protocol';
import { initialLang, LangCtx } from './i18n';
import { store } from './net';
import { prefs } from './prefs';
import { Home } from './pages/Home';
import { Host } from './pages/Host';
import { Join } from './pages/Join';
import { unlockAudio } from './sound';
import './styles.css';

function route() {
  const p = location.pathname.replace(/\/+$/, '');
  if (p === '/host') return { page: 'host' as const };
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
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
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
      {r.page === 'watch' && <Host watchCode={r.code} />}
      {r.page === 'join' && <Join initialCode={r.code} />}
    </LangCtx.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
