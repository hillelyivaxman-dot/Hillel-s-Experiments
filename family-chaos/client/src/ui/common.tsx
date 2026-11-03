import { useEffect, useRef, useState } from 'react';
import type { GameMeta } from '../../../shared/catalog';
import { CATEGORY_NAMES, PLAY_TIME } from '../../../shared/catalog';
import { useContext } from 'react';
import { LangCtx, useT } from '../i18n';
import { prefs, setReducedMotion, setSound } from '../prefs';
import { drawCritter } from '../render/critter';
import { sfx, unlockAudio } from '../sound';
import { store } from '../net';

export function CritterCanvas({ color, variant, size = 96, hurt = false, animate = true }: {
  color: string; variant: number; size?: number; hurt?: boolean; animate?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const g = c.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.direction = 'ltr';
      g.clearRect(0, 0, size, size);
      drawCritter(g, size / 2, size * 0.56, size * 0.3, color, variant, { t: animate && !prefs.reducedMotion ? t : 0, hurt });
      if (animate && !prefs.reducedMotion) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [color, variant, size, hurt, animate]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'logo--small' : ''}`} aria-label="FAMILY CHAOS" dir="ltr">
      <span className="logo__family">FAMILY</span>
      <span className="logo__chaos">
        {'CHAOS'.split('').map((ch, i) => <span key={i} className="logo__ch" style={{ ['--i' as string]: i }}>{ch}</span>)}
      </span>
    </div>
  );
}

export function SettingsBar() {
  const { lang, setLang } = useContext(LangCtx);
  const { t } = useT();
  const [, force] = useState(0);
  return (
    <div className="settings-bar">
      <button className="chip" onClick={() => { setLang(lang === 'he' ? 'en' : 'he'); sfx.click(); }} aria-label="Language">
        {lang === 'he' ? 'English' : 'עברית'}
      </button>
      <button className="chip" onClick={() => { setSound(!prefs.sound); unlockAudio(); sfx.click(); force((x) => x + 1); }}>
        {prefs.sound ? '🔊' : '🔇'} <span className="chip__label">{t('sound')}</span>
      </button>
      <button className="chip" onClick={() => { setReducedMotion(!prefs.reducedMotion); force((x) => x + 1); }}>
        {prefs.reducedMotion ? '🐢' : '✨'} <span className="chip__label">{t('motion')}: {prefs.reducedMotion ? t('reduced') : t('full')}</span>
      </button>
    </div>
  );
}

export function GameCard({ g, selected, onClick, compact = false }: { g: GameMeta; selected?: boolean; onClick?: () => void; compact?: boolean }) {
  const { l, t } = useT();
  const soon = g.status !== 'playable';
  return (
    <button
      className={`game-card ${selected ? 'is-selected' : ''} ${soon ? 'is-soon' : ''} ${compact ? 'game-card--compact' : ''}`}
      style={{ ['--a1' as string]: g.accent[0], ['--a2' as string]: g.accent[1] }}
      onClick={soon ? undefined : onClick}
      disabled={soon}
      aria-pressed={selected}
      data-game={g.id}
    >
      <span className="game-card__art"><GameIcon id={g.id} /></span>
      <span className="game-card__body">
        <span className="game-card__cat">{compact && soon ? t('soon') : `${l(CATEGORY_NAMES[g.category])} · ${g.minPlayers}–${g.maxPlayers} ${t('players')}${PLAY_TIME[g.id] ? ` · ⏱ ${PLAY_TIME[g.id][0] === PLAY_TIME[g.id][1] ? PLAY_TIME[g.id][0] : PLAY_TIME[g.id].join('–')}′` : ''}`}</span>
        <span className="game-card__name">{l(g.name)}</span>
        {!compact && <span className="game-card__tag">{soon ? t('soon') : l(g.tagline)}</span>}
      </span>
      {soon && !compact && <span className="game-card__soon">{t('soon')}</span>}
    </button>
  );
}

const GAME_EMOJI: Record<string, string> = {
  basketball: '🏀', bowling: '🎳', boat: '🚤', bike: '🏍️', tank: '🪖', wizard: '🧙', survival: '⚔️', defense: '🛡️', tag: '🔥', maze: '🌀', rescue: '🧑‍🚀',
  evac: '🧰', treasure: '💎', tower: '🧱', spacerace: '🚀', balloon: '🎈', puzzle: '🧩', draw: '✏️', trivia: '❓',
};

/** Original vector icons for each game card. */
export function GameIcon({ id }: { id: string }) {
  const common = { width: '100%', height: '100%', viewBox: '0 0 100 100' } as const;
  switch (id) {
    case 'bumper':
      return (<svg {...common}><ellipse cx="50" cy="62" rx="44" ry="26" fill="#3b1d6e" /><ellipse cx="50" cy="56" rx="44" ry="26" fill="#8b5cf6" stroke="#ffd23f" strokeWidth="4" /><circle cx="36" cy="48" r="13" fill="#ff4d6d" stroke="#120a2a" strokeWidth="3" /><circle cx="64" cy="54" r="13" fill="#3ec1ff" stroke="#120a2a" strokeWidth="3" /><path d="M48 40l4-10 4 10" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>);
    case 'kart':
      return (<svg {...common}><path d="M10 70 Q50 10 90 70" stroke="#3a3a4a" strokeWidth="20" fill="none" /><path d="M10 70 Q50 10 90 70" stroke="#fff" strokeWidth="2" strokeDasharray="6 6" fill="none" /><rect x="30" y="52" width="36" height="20" rx="7" fill="#3ec1ff" stroke="#120a2a" strokeWidth="3" /><circle cx="38" cy="74" r="6" fill="#120a2a" /><circle cx="60" cy="74" r="6" fill="#120a2a" /><path d="M24 60h-14M24 66h-10" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" /></svg>);
    case 'reaction':
      return (<svg {...common}><circle cx="50" cy="50" r="38" fill="#16a34a" stroke="#120a2a" strokeWidth="4" /><path d="M54 18 36 54h14l-4 28 18-38H50z" fill="#ffd23f" stroke="#120a2a" strokeWidth="3" strokeLinejoin="round" /></svg>);
    case 'potato':
      return (<svg {...common}><circle cx="48" cy="58" r="28" fill="#1a1a2e" stroke="#000" strokeWidth="3" /><circle cx="38" cy="48" r="7" fill="rgba(255,255,255,.4)" /><path d="M62 34q12-14 4-22" stroke="#c8a26b" strokeWidth="5" fill="none" /><circle cx="66" cy="12" r="8" fill="#ffd23f" /><circle cx="66" cy="12" r="4" fill="#ff4d6d" /></svg>);
    case 'soccer':
      return (<svg {...common}><rect x="6" y="14" width="88" height="62" rx="8" fill="#35b05b" stroke="#fff" strokeWidth="3" /><path d="M50 14v62" stroke="#fff" strokeWidth="3" /><circle cx="50" cy="45" r="12" fill="none" stroke="#fff" strokeWidth="3" /><rect x="6" y="32" width="12" height="26" fill="none" stroke="#fff" strokeWidth="3" /><rect x="82" y="32" width="12" height="26" fill="none" stroke="#fff" strokeWidth="3" /><circle cx="64" cy="40" r="9" fill="#fff" stroke="#120a2a" strokeWidth="3" /><circle cx="36" cy="52" r="8" fill="#ff4d6d" stroke="#120a2a" strokeWidth="2.5" /><circle cx="76" cy="58" r="8" fill="#3ec1ff" stroke="#120a2a" strokeWidth="2.5" /></svg>);
    case 'hockey':
      return (<svg {...common}><rect x="6" y="18" width="88" height="56" rx="14" fill="#dff1ff" stroke="#1d2a66" strokeWidth="4" /><path d="M50 18v56" stroke="#4a6fd0" strokeWidth="3" /><rect x="2" y="36" width="8" height="20" fill="#ff4d6d" /><rect x="90" y="36" width="8" height="20" fill="#3ec1ff" /><circle cx="50" cy="46" r="8" fill="#12172e" stroke="#ffd23f" strokeWidth="3" /><circle cx="26" cy="46" r="13" fill="#ff4d6d" stroke="#12172e" strokeWidth="3" /><circle cx="76" cy="40" r="13" fill="#3ec1ff" stroke="#12172e" strokeWidth="3" /></svg>);
    case 'board':
      return (<svg {...common}><rect x="6" y="14" width="88" height="68" rx="12" fill="#2a1666" stroke="#fff" strokeWidth="3" />{[0, 1, 2, 3, 4].map((i) => (<rect key={`t${i}`} x={12 + i * 17} y={20} width="14" height="14" rx="4" fill={['#ffd23f', '#ff4d6d', '#b26bff', '#3ec1ff', '#5dfc8d'][i]} />))}{[0, 1, 2, 3, 4].map((i) => (<rect key={`b${i}`} x={12 + i * 17} y={62} width="14" height="14" rx="4" fill={['#5dfc8d', '#f472b6', '#ffd23f', '#ff4d6d', '#3ec1ff'][i]} />))}<rect x="40" y="38" width="22" height="22" rx="5" fill="#fff" stroke="#120a2a" strokeWidth="3" /><circle cx="46" cy="44" r="2.5" fill="#120a2a" /><circle cx="56" cy="54" r="2.5" fill="#120a2a" /><circle cx="51" cy="49" r="2.5" fill="#120a2a" /><path d="M78 40l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#ffe45e" stroke="#120a2a" strokeWidth="2" /></svg>);
    case 'kitchen':
      return (<svg {...common}><rect x="6" y="52" width="88" height="30" rx="8" fill="#aeb9cc" stroke="#120a2a" strokeWidth="3" /><ellipse cx="32" cy="46" rx="22" ry="12" fill="#fff" stroke="#120a2a" strokeWidth="3" /><ellipse cx="32" cy="40" rx="14" ry="7" fill="#e8b36a" stroke="#120a2a" strokeWidth="2.5" /><ellipse cx="32" cy="36" rx="12" ry="5" fill="#7a4426" stroke="#120a2a" strokeWidth="2.5" /><ellipse cx="32" cy="31" rx="12" ry="5" fill="#ff4d4d" stroke="#120a2a" strokeWidth="2.5" /><path d="M64 30c0-12 12-12 12 0 0 6 6 6 6 12H58c0-6 6-6 6-12z" fill="#fff" stroke="#120a2a" strokeWidth="3" /><path d="M80 20l8-8M84 26l8-4" stroke="#ff4d6d" strokeWidth="4" strokeLinecap="round" /></svg>);
    case 'trapbuilders':
      return (<svg {...common}><path d="M0 74h30v10H0zM66 74h34v10H66z" fill="#7bd35a" stroke="#120a2a" strokeWidth="3" /><path d="M30 74h36v14H30z" fill="#12091f" /><path d="M10 74l5-16 5 16zM20 74l5-16 5 16z" fill="#e9edf7" stroke="#120a2a" strokeWidth="2.5" /><circle cx="48" cy="46" r="13" fill="#cfd6e6" stroke="#120a2a" strokeWidth="3" /><circle cx="48" cy="46" r="5" fill="#ff4d6d" /><circle cx="82" cy="56" r="14" fill="#f472b6" stroke="#120a2a" strokeWidth="3" /><path d="M76 20l6 12 12 2-9 8 2 12-11-6-11 6 2-12-9-8 12-2z" fill="#ffe45e" stroke="#120a2a" strokeWidth="2" /></svg>);
    case 'vanish':
      return (<svg {...common}>{[0, 1, 2, 3, 4, 5].map((i) => (i === 4 ? null : <rect key={i} x={8 + (i % 3) * 30} y={22 + Math.floor(i / 3) * 32} width="26" height="26" rx="6" fill={i === 1 ? '#ff6b3c' : i % 2 ? '#6d3fd8' : '#8b5cf6'} stroke="#120a2a" strokeWidth="3" />))}<path d="M40 28l6 10-6 6" stroke="#2b0a05" strokeWidth="3" fill="none" /><circle cx="68" cy="58" r="12" fill="#ff4d6d" stroke="#120a2a" strokeWidth="3" /></svg>);
    case 'rush':
      return (<svg {...common}><path d="M0 74h38v10H0zM58 74h42v10H58z" fill="#5ee27a" stroke="#120a2a" strokeWidth="3" /><path d="M70 74l6-16 6 16zM82 74l6-16 6 16z" fill="#e9edf7" stroke="#120a2a" strokeWidth="2.5" /><circle cx="30" cy="52" r="15" fill="#f472b6" stroke="#120a2a" strokeWidth="3" /><circle cx="25" cy="49" r="3.5" fill="#fff" /><circle cx="35" cy="49" r="3.5" fill="#fff" /><path d="M46 38c8-14 22-14 28-4" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="2 8" /><path d="M76 24l8 4-8 6" fill="none" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" /></svg>);
    default: {
      const e = GAME_EMOJI[id];
      return (<svg {...common}><circle cx="50" cy="50" r="40" fill="rgba(255,255,255,.18)" stroke="#120a2a" strokeWidth="3" /><text x="50" y="50" fontSize="46" textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight="900">{e ?? '?'}</text></svg>);
    }
  }
}

export function useConnStatus(conn: { status: string; onStatus: (h: (s: any) => void) => () => void } | null) {
  const [s, setS] = useState(conn?.status ?? 'connecting');
  useEffect(() => (conn ? conn.onStatus(setS) : undefined), [conn]);
  return s;
}

export function ConnBanner({ status }: { status: string }) {
  const { t } = useT();
  if (status === 'open') return null;
  return <div className="conn-banner" role="status">{status === 'connecting' ? t('connecting') : t('reconnecting')}</div>;
}

export const savedProfile = {
  name: () => store.get('fc.name') ?? '',
  avatar: () => Number(store.get('fc.avatar') ?? Math.floor(Math.random() * 12)) % 12,
  save: (name: string, avatar: number) => { store.set('fc.name', name); store.set('fc.avatar', String(avatar)); },
};
