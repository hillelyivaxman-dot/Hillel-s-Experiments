// Game catalog: metadata shared by the server, the host screen and the phones.
// `status: 'playable'` games have a server module in server/games and a renderer
// in client/src/render. Anything else is shown as "coming soon" and cannot start.

import type { ButtonKey } from './protocol';

export type Category =
  | 'racing' | 'action' | 'sports' | 'party' | 'arcade'
  | 'puzzle' | 'coop' | 'strategy' | 'survival' | 'board';

export interface L10n { he: string; en: string }

export interface ControllerButton {
  key: ButtonKey;
  label: L10n;
  color: string;
  big?: boolean;
  /** Small icon id drawn on the button (see client/src/controller/icons.tsx). */
  icon?: string;
}

/** Declarative phone controller layout; each game picks one. */
/** Controller profiles: decide how buttons are arranged around the right thumb. */
export type PadStyle = 'racing' | 'fighter' | 'platform' | 'party';

export type ControllerLayout =
  // buttons are ordered by importance: [0] is the primary button under the resting thumb
  | { kind: 'stick'; style: PadStyle; buttons: ControllerButton[]; landscape?: boolean }
  | { kind: 'tap'; button: ControllerButton } // one giant button
  | { kind: 'choices'; count: 2 | 3 | 4 };

export interface GameOption {
  key: string;
  label: L10n;
  values: number[];
  default: number;
  names?: L10n[]; // optional display names per value
}

export interface GameMeta {
  id: string;
  name: L10n;
  tagline: L10n;
  howTo: L10n;
  category: Category;
  minPlayers: number;
  maxPlayers: number;
  status: 'playable' | 'soon';
  accent: [string, string]; // card gradient
  controller: ControllerLayout;
  options: GameOption[];
}

const stickPad = (style: PadStyle, buttons: ControllerButton[], landscape = true): ControllerLayout =>
  ({ kind: 'stick', style, buttons, landscape });

export const CATALOG: GameMeta[] = [
  {
    id: 'bumper',
    name: { he: 'קרב מתנגשים', en: 'Bumper Battle' },
    tagline: { he: 'דחפו את כולם מהזירה!', en: 'Shove everyone off the arena!' },
    howTo: {
      he: 'ג׳ויסטיק לתנועה, הסתערות לדחיפה, התחמקות לצד. אספו כוחות והפעילו אותם בזמן הנכון. הזירה מתכווצת!',
      en: 'Stick to move, DASH to shove, DODGE to sidestep. Grab powers and fire them with POWER. The arena shrinks!',
    },
    category: 'action', minPlayers: 2, maxPlayers: 8, status: 'playable',
    accent: ['#ff4d6d', '#ff9a3c'],
    controller: stickPad('fighter', [
      { key: 'A', label: { he: 'הסתערות', en: 'DASH' }, color: '#ff4d6d', big: true, icon: 'dash' },
      { key: 'B', label: { he: 'כוח', en: 'POWER' }, color: '#b26bff', icon: 'star' },
      { key: 'C', label: { he: 'התחמקות', en: 'DODGE' }, color: '#3ec1ff', icon: 'dodge' },
    ]),
    options: [{ key: 'lives', label: { he: 'חיים', en: 'Lives' }, values: [1, 2, 3, 4, 5], default: 3 }],
  },
  {
    id: 'kart',
    name: { he: 'כאוס קארטינג', en: 'Kart Chaos' },
    tagline: { he: 'מרוץ קטן, בלגן גדול', en: 'Tiny cars, huge mess' },
    howTo: {
      he: 'ג׳ויסטיק להיגוי, גז ובלם בימין. מד הטורבו מתמלא — לחצו טורבו. קופסאות ? נותנות פריטים.',
      en: 'Stick steers, GAS and BRAKE on the right. Fill the turbo meter and hit TURBO. ? boxes give items.',
    },
    category: 'racing', minPlayers: 1, maxPlayers: 8, status: 'playable',
    accent: ['#3ec1ff', '#5d5dff'],
    controller: stickPad('racing', [
      { key: 'A', label: { he: 'גז', en: 'GAS' }, color: '#5dfc8d', big: true, icon: 'gas' },
      { key: 'B', label: { he: 'בלם', en: 'BRAKE' }, color: '#ff8c42', icon: 'brake' },
      { key: 'D', label: { he: 'טורבו', en: 'TURBO' }, color: '#3ec1ff', icon: 'turbo' },
      { key: 'C', label: { he: 'פריט', en: 'ITEM' }, color: '#b26bff', icon: 'item' },
    ]),
    options: [
      { key: 'laps', label: { he: 'הקפות', en: 'Laps' }, values: [1, 2, 3, 4, 5], default: 3 },
      {
        key: 'track', label: { he: 'מסלול', en: 'Track' }, values: [0, 1, 2], default: 0,
        names: [{ he: 'סופגנייה', en: 'Donut Loop' }, { he: 'נחש', en: 'Snake Pass' }, { he: 'שמונה', en: 'Figure Eight' }],
      },
    ],
  },
  {
    id: 'reaction',
    name: { he: 'דו־קרב תגובה', en: 'Reaction Duel' },
    tagline: { he: 'מי הכי מהיר בעולם?', en: 'Fastest thumb wins' },
    howTo: {
      he: 'חכו לירוק ואז לחצו! לחיצה מוקדמת = עונש. היזהרו מתרגילים.',
      en: 'Wait for GREEN, then tap! Early taps are punished. Beware of fake-outs.',
    },
    category: 'party', minPlayers: 1, maxPlayers: 12, status: 'playable',
    accent: ['#5dfc8d', '#2ef2e0'],
    controller: { kind: 'tap', button: { key: 'A', label: { he: 'עכשיו!', en: 'TAP!' }, color: '#5dfc8d', big: true } },
    options: [{ key: 'rounds', label: { he: 'סבבים', en: 'Rounds' }, values: [3, 5, 7, 10], default: 5 }],
  },
  {
    id: 'potato',
    name: { he: 'תפוח אדמה לוהט', en: 'Hot Potato' },
    tagline: { he: 'תעבירו את הפצצה. מהר!', en: 'Pass the bomb. Fast!' },
    howTo: {
      he: 'מחזיקים את הפצצה? געו במישהו או זרקו אליו (כוונו עם הג׳ויסטיק). כשהפתיל נגמר — בום.',
      en: 'Holding the bomb? Touch someone or THROW it (aim with the stick). When the fuse ends: boom.',
    },
    category: 'party', minPlayers: 3, maxPlayers: 8, status: 'playable',
    accent: ['#ffd23f', '#ff6b3c'],
    controller: stickPad('party', [
      { key: 'A', label: { he: 'ספרינט', en: 'SPRINT' }, color: '#ffd23f', big: true, icon: 'dash' },
      { key: 'B', label: { he: 'זריקה', en: 'THROW' }, color: '#ff4d6d', icon: 'throw' },
    ]),
    options: [],
  },
  soon('soccer', 'מיני כדורגל', 'Mini Soccer', 'sports', ['#22c55e', '#15803d']),
  soon('obstacle', 'מרוץ מכשולים', 'Obstacle Rush', 'arcade', ['#f472b6', '#a855f7']),
  soon('treasure', 'ציד אוצרות', 'Treasure Hunt', 'arcade', ['#fbbf24', '#b45309']),
  soon('hockey', 'הוקי אוויר', 'Air Hockey', 'sports', ['#38bdf8', '#0ea5e9']),
  soon('draw', 'צייר ונחש', 'Draw & Guess', 'party', ['#fb7185', '#f59e0b']),
  soon('maze', 'בריחה מהמבוך', 'Maze Escape', 'puzzle', ['#818cf8', '#4338ca']),
  soon('tower', 'מגדל מתנדנד', 'Tower Stack', 'arcade', ['#2dd4bf', '#0f766e']),
  soon('trivia', 'טריוויה מסיבה', 'Party Trivia', 'party', ['#c084fc', '#7c3aed']),
];

function soon(id: string, he: string, en: string, category: Category, accent: [string, string]): GameMeta {
  return {
    id, name: { he, en }, tagline: { he: 'בפיתוח', en: 'In development' },
    howTo: { he: '', en: '' }, category, minPlayers: 2, maxPlayers: 8, status: 'soon', accent,
    controller: { kind: 'tap', button: { key: 'A', label: { he: '', en: '' }, color: '#888' } }, options: [],
  };
}

export const getMeta = (id: string) => CATALOG.find((g) => g.id === id);

export function defaultOptions(meta: GameMeta): Record<string, number> {
  return Object.fromEntries(meta.options.map((o) => [o.key, o.default]));
}

export const CATEGORY_NAMES: Record<Category, L10n> = {
  racing: { he: 'מרוצים', en: 'Racing' },
  action: { he: 'אקשן', en: 'Action' },
  sports: { he: 'ספורט', en: 'Sports' },
  party: { he: 'מסיבה', en: 'Party' },
  arcade: { he: 'ארקייד', en: 'Arcade' },
  puzzle: { he: 'פאזל', en: 'Puzzle' },
  coop: { he: 'שיתופי', en: 'Co-op' },
  strategy: { he: 'אסטרטגיה', en: 'Strategy' },
  survival: { he: 'הישרדות', en: 'Survival' },
  board: { he: 'לוח', en: 'Board' },
};
