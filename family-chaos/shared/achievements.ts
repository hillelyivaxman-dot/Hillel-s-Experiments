import type { L10n } from './catalog';

export interface PlayerStats {
  games: number;
  wins: number;
  stars: number;
  perGame: Record<string, { plays: number; wins: number }>;
}

export interface Achievement {
  id: string;
  icon: string;
  name: L10n;
  desc: L10n;
  test: (s: PlayerStats) => boolean;
}

const won = (s: PlayerStats, g: string) => (s.perGame[g]?.wins ?? 0) > 0;

/** Achievements are derived from saved match results (never reported by phones). */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_game', icon: 'gamepad', name: { he: 'צעד ראשון', en: 'First Steps' }, desc: { he: 'שחקו משחק אחד', en: 'Play one game' }, test: (s) => s.games >= 1 },
  { id: 'first_win', icon: 'trophy', name: { he: 'ניצחון ראשון', en: 'First Win' }, desc: { he: 'נצחו במשחק', en: 'Win a game' }, test: (s) => s.wins >= 1 },
  { id: 'regular', icon: 'team', name: { he: 'קבוע בחבורה', en: 'Regular' }, desc: { he: '10 משחקים', en: 'Play 10 games' }, test: (s) => s.games >= 10 },
  { id: 'stars25', icon: 'star', name: { he: 'אספן כוכבים', en: 'Star Collector' }, desc: { he: 'צברו 25 כוכבים', en: 'Earn 25 stars' }, test: (s) => s.stars >= 25 },
  { id: 'all_rounder', icon: 'dice', name: { he: 'רב־תחומי', en: 'All-Rounder' }, desc: { he: 'שחקו ב־4 משחקים שונים', en: 'Play 4 different games' }, test: (s) => Object.keys(s.perGame).length >= 4 },
  { id: 'kart_win', icon: 'flag', name: { he: 'שד מהירות', en: 'Speed Demon' }, desc: { he: 'נצחו בכאוס קארטינג', en: 'Win Kart Chaos' }, test: (s) => won(s, 'kart') },
  { id: 'bumper_win', icon: 'boom', name: { he: 'אחרון בזירה', en: 'Last One Standing' }, desc: { he: 'נצחו בקרב מתנגשים', en: 'Win Bumper Battle' }, test: (s) => won(s, 'bumper') },
  { id: 'flag_win', icon: 'flag2', name: { he: 'גנב דגלים', en: 'Flag Thief' }, desc: { he: 'נצחו במלחמת דגלים', en: 'Win Flag Wars' }, test: (s) => won(s, 'flagwars') },
  { id: 'potato_win', icon: 'bomb', name: { he: 'חסין פצצות', en: 'Bomb Dodger' }, desc: { he: 'נצחו בתפוח אדמה לוהט', en: 'Win Hot Potato' }, test: (s) => won(s, 'potato') },
];
