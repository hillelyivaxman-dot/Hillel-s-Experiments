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
  // racing: a wheel to rotate with a finger (or arrows / phone tilt) instead of a joystick
  | { kind: 'wheel'; style: PadStyle; buttons: ControllerButton[] }
  | { kind: 'tap'; button: ControllerButton } // one giant button
  | { kind: 'choices'; count: 2 | 3 | 4; labels?: L10n[]; colors?: string[]; icons?: string[] }; // 2-4 big labelled buttons

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

const wheelPad = (style: PadStyle, buttons: ControllerButton[]): ControllerLayout => ({ kind: 'wheel', style, buttons });
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
    controller: wheelPad('racing', [
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
  {
    id: 'rush',
    name: { he: 'כאוס ראש', en: 'Chaos Rush' },
    tagline: { he: 'רצים, קופצים, דוחפים — ומגיעים ראשונים!', en: 'Run, jump, shove — first to the finish!' },
    howTo: {
      he: 'רצים ימינה וקופצים מעל בורות, קוצים ומסורים. הסתערות מאיצה, דחיפה זורקת יריבים אחורה. פגיעה מחזירה לנקודת שמירה.',
      en: 'Run right and jump pits, spikes and saws. DASH to speed up, SHOVE to knock rivals back. A hit sends you to the last checkpoint.',
    },
    category: 'arcade', minPlayers: 1, maxPlayers: 8, status: 'playable',
    accent: ['#f472b6', '#a855f7'],
    controller: stickPad('platform', [
      { key: 'A', label: { he: 'קפיצה', en: 'JUMP' }, color: '#5dfc8d', big: true, icon: 'jump' },
      { key: 'B', label: { he: 'הסתערות', en: 'DASH' }, color: '#ffd23f', icon: 'dash' },
      { key: 'C', label: { he: 'דחיפה', en: 'SHOVE' }, color: '#ff4d6d', icon: 'shove' },
    ]),
    options: [{ key: 'len', label: { he: 'אורך מסלול', en: 'Course length' }, values: [8, 12, 16], default: 12 }],
  },
  {
    id: 'board',
    name: { he: 'מסיבת לוח משפחתית', en: 'Family Board Party' },
    tagline: { he: 'קוביות, כוכבים, מטבעות והפתעות', en: 'Dice, stars, coins and surprises' },
    howTo: {
      he: 'בתורכם: קוביה (A) וצעדו על הלוח. אספו מטבעות, קנו כוכב ב־10 מטבעות (הוא כל הזמן זז!), הפעילו כוחות (B) והתמודדו בדו־קרבות. בסוף כל סבב יש משחקון לחיצות. הכי הרבה כוכבים מנצח.',
      en: 'On your turn: roll (A) and walk the board. Collect coins, buy a star for 10 (it keeps moving!), use powers (B) and duel rivals. Every round ends with a tap race. Most stars wins.',
    },
    category: 'board', minPlayers: 2, maxPlayers: 8, status: 'playable',
    accent: ['#8b5cf6', '#ec4899'],
    controller: { kind: 'choices', count: 2, labels: [{ he: 'קוביה / כן / לחצו!', en: 'ROLL / YES / TAP!' }, { he: 'כוח / לא', en: 'POWER / NO' }], colors: ['#5dfc8d', '#ffb347'], icons: ['dice', 'star'] },
    options: [{ key: 'rounds', label: { he: 'סבבים', en: 'Rounds' }, values: [5, 8, 10], default: 8 }],
  },
  {
    id: 'kitchen',
    name: { he: 'מטבח משוגע', en: 'Crazy Kitchen' },
    tagline: { he: 'מבשלים יחד, מגישים מהר, לא נשרפים!', en: 'Cook together, serve fast, do not burn it!' },
    howTo: {
      he: 'שיתוף פעולה! קחו חומרי גלם (A), חתכו ירקות על הקרש (החזיקו B), בשלו קציצות במחבת (אל תתנו להן להישרף!), הרכיבו על צלחת והגישו לחלון לפני שההזמנה פוקעת. באמצע המשחק המטבח מתחלף!',
      en: 'Co-op! Grab ingredients (A), chop veg on a board (hold B), cook patties on the stove (do not let them burn!), build the plate and serve it before the order expires. Half way through, the kitchen reshuffles!',
    },
    category: 'coop', minPlayers: 1, maxPlayers: 6, status: 'playable',
    accent: ['#fb923c', '#e11d48'],
    controller: stickPad('party', [
      { key: 'A', label: { he: 'קח / שים', en: 'TAKE / PUT' }, color: '#5dfc8d', big: true, icon: 'hand' },
      { key: 'B', label: { he: 'חתוך', en: 'CHOP' }, color: '#ffd23f', icon: 'chop' },
    ]),
    options: [{ key: 'time', label: { he: 'זמן', en: 'Time' }, values: [120, 180, 240], default: 180, names: [{ he: '2 דקות', en: '2 min' }, { he: '3 דקות', en: '3 min' }, { he: '4 דקות', en: '4 min' }] }],
  },
  {
    id: 'vanish',
    name: { he: 'רצפה נעלמת', en: 'Vanishing Floor' },
    tagline: { he: 'הרצפה נסדקת — מי יישאר עומד?', en: 'The floor cracks — who is left standing?' },
    howTo: {
      he: 'הרצפה חלקלקה ומתפוררת! אריחים שאתם עומדים עליהם נסדקים ונעלמים. קפיצה (A) עוברת על חורים ובטוחה באוויר, חבטה (B) דוחפת יריבים אל החורים. האחרון שנשאר מנצח.',
      en: 'The floor is slippery and crumbling! Tiles you stand on crack and vanish. JUMP (A) clears holes and is safe in the air, SHOVE (B) pushes rivals toward the holes. Last one standing wins.',
    },
    category: 'party', minPlayers: 2, maxPlayers: 8, status: 'playable',
    accent: ['#f97316', '#be123c'],
    controller: stickPad('party', [
      { key: 'A', label: { he: 'קפיצה', en: 'JUMP' }, color: '#5dfc8d', big: true, icon: 'jump' },
      { key: 'B', label: { he: 'חבטה', en: 'SHOVE' }, color: '#ff4d6d', icon: 'shove' },
    ]),
    options: [],
  },
  soon('treasure', 'ציד אוצרות', 'Treasure Hunt', 'arcade', ['#fbbf24', '#b45309']),
  {
    id: 'soccer',
    name: { he: 'כדורגל', en: 'Soccer' },
    tagline: { he: 'קבוצה נגד קבוצה — מי יבקיע יותר?', en: 'Team vs team — who scores more?' },
    howTo: {
      he: 'הקבוצות נבחרות אוטומטית (אדומים נגד כחולים). ג׳ויסטיק לריצה, בעיטה לבעוט לכיוון הג׳ויסטיק, ספרינט מתכלה. תיקו = הארכה עם גול הזהב.',
      en: 'Teams are automatic (red vs blue). Stick to run, KICK shoots where you aim, SPRINT drains stamina. A tie goes to golden-goal overtime.',
    },
    category: 'sports', minPlayers: 2, maxPlayers: 8, status: 'playable',
    accent: ['#22c55e', '#15803d'],
    controller: stickPad('fighter', [
      { key: 'A', label: { he: 'בעיטה', en: 'KICK' }, color: '#ffd23f', big: true, icon: 'kick' },
      { key: 'B', label: { he: 'ספרינט', en: 'SPRINT' }, color: '#3ec1ff', icon: 'dash' },
    ]),
    options: [{ key: 'time', label: { he: 'זמן משחק', en: 'Match time' }, values: [60, 120, 180], default: 120, names: [{ he: 'דקה', en: '1 min' }, { he: '2 דקות', en: '2 min' }, { he: '3 דקות', en: '3 min' }] }],
  },
  {
    id: 'hockey',
    name: { he: 'הוקי אוויר', en: 'Air Hockey' },
    tagline: { he: 'מהיר, חלק ונוצץ — 1 נגד 1 או 2 נגד 2', en: 'Fast, slick, shiny — 1v1 or 2v2' },
    howTo: {
      he: 'הזיזו את המחבט עם הג׳ויסטיק (רק בחצי שלכם) והבקיעו לשער היריב. "חבטה" נותנת פרץ מהירות. ראשון ל־7 גולים מנצח.',
      en: 'Move your mallet with the stick (your half only) and score in the rival goal. SMASH gives a speed burst. First to 7 goals wins.',
    },
    category: 'sports', minPlayers: 2, maxPlayers: 4, status: 'playable',
    accent: ['#38bdf8', '#6366f1'],
    controller: stickPad('fighter', [{ key: 'A', label: { he: 'חבטה', en: 'SMASH' }, color: '#ffd23f', big: true, icon: 'turbo' }]),
    options: [{ key: 'goals', label: { he: 'גולים לניצחון', en: 'Goals to win' }, values: [3, 5, 7, 10], default: 7 }],
  },
  soon('draw', 'צייר ונחש', 'Draw & Guess', 'party', ['#fb7185', '#f59e0b']),
  soon('maze', 'בריחה מהמבוך', 'Maze Escape', 'puzzle', ['#818cf8', '#4338ca']),
  {
    id: 'trapbuilders',
    name: { he: 'בונים מלכודות', en: 'Trap Builders' },
    tagline: { he: 'קודם בונים מלכודות, אחר כך כולם רצים דרכן!', en: 'First you build the traps, then everyone runs through them!' },
    howTo: {
      he: 'שלב הבנייה: ג׳ויסטיק להזיז את הסמן, B להחליף סוג מלכודת (קוצים / מסור / בור), A להניח. שלב המרוץ: ריצה וקפיצה עד לקו הסיום. מי שנפגע במלכודת שלכם מביא לכם נקודה!',
      en: 'BUILD: stick moves your cursor, B switches trap type (spikes / saw / pit), A places it. RACE: run and jump to the finish. Every runner your trap catches earns you a point!',
    },
    category: 'strategy', minPlayers: 2, maxPlayers: 8, status: 'playable',
    accent: ['#f43f5e', '#7c3aed'],
    controller: stickPad('platform', [
      { key: 'A', label: { he: 'קפיצה / הנח', en: 'JUMP / PLACE' }, color: '#5dfc8d', big: true, icon: 'jump' },
      { key: 'B', label: { he: 'סוג / רוץ', en: 'TYPE / DASH' }, color: '#ffd23f', icon: 'dash' },
    ]),
    options: [{ key: 'rounds', label: { he: 'סבבים', en: 'Rounds' }, values: [2, 3, 5], default: 3 }],
  },
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
