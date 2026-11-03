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

const BASE_GAMES: GameMeta[] = [
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
];

const btn = (key: ButtonKey, he: string, en: string, color: string, icon?: string, big?: boolean): ControllerButton => ({ key, label: { he, en }, color, icon, big });
const opt = (key: string, he: string, en: string, values: number[], def: number, names?: [string, string][]): GameOption =>
  ({ key, label: { he, en }, values, default: def, names: names?.map(([h, e]) => ({ he: h, en: e })) });
const racePad = (): ControllerLayout => wheelPad('racing', [btn('A', 'גז', 'GAS', '#5dfc8d', 'gas', true), btn('B', 'בלם', 'BRAKE', '#ff8c42', 'brake'), btn('D', 'טורבו', 'TURBO', '#3ec1ff', 'turbo'), btn('C', 'פריט', 'ITEM', '#b26bff', 'item')]);
const raceOpts = (): GameOption[] => [
  opt('laps', 'הקפות', 'Laps', [1, 2, 3, 4, 5], 3),
  opt('track', 'מסלול', 'Track', [0, 1, 2], 0, [['סופגנייה', 'Donut Loop'], ['נחש', 'Snake Pass'], ['שמונה', 'Figure Eight']]),
];
const SHAPES = [{ he: '▲', en: '▲' }, { he: '●', en: '●' }, { he: '■', en: '■' }, { he: '★', en: '★' }];
const shapeChoices = (): ControllerLayout => ({ kind: 'choices', count: 4, labels: SHAPES, colors: ['#ff4d6d', '#3ec1ff', '#ffd23f', '#5dfc8d'] });

function game(id: string, he: string, en: string, tagHe: string, tagEn: string, howHe: string, howEn: string, category: Category, min: number, max: number, accent: [string, string], controller: ControllerLayout, options: GameOption[] = []): GameMeta {
  return { id, name: { he, en }, tagline: { he: tagHe, en: tagEn }, howTo: { he: howHe, en: howEn }, category, minPlayers: min, maxPlayers: max, status: 'playable', accent, controller, options };
}

const NEW_GAMES_LIST: GameMeta[] = [
  // ---- wave A ----
  game('basketball', 'כדורסל כאוס', 'Basketball Chaos', 'כולם זורקים לאותה סל!', 'Everyone shoots at one hoop!',
    'זזו ימינה/שמאלה לבחור מרחק (רחוק = 3 נקודות). החזיקו את כפתור הזריקה כדי לטעון את המד, ושחררו בתוך האזור הירוק. שחרור מושלם נותן בונוס.',
    'Walk left/right to pick your distance (far = 3 points). HOLD the shoot button to charge the meter and RELEASE inside the green zone. A perfect release gives a bonus.',
    'sports', 1, 8, ['#fb923c', '#c2410c'], stickPad('party', [btn('A', 'זריקה (החזק)', 'SHOOT (hold)', '#ffd23f', 'kick', true)]),
    [opt('time', 'זמן', 'Time', [45, 60, 90], 60, [['45 שנ׳', '45 s'], ['דקה', '1 min'], ['דקה וחצי', '1.5 min']])]),
  game('bowling', 'באולינג משוגע', 'Crazy Bowling', 'כוונו, טענו, ובום — סטרייק!', 'Aim, power up, and boom — strike!',
    'בתורכם: כוונו עם הג׳ויסטיק ולחצו לנעילה, ואז לחצו שוב כשהמד בנקודה הירוקה. סטרייק וספייר נותנים בונוס. הכי הרבה נקודות מנצח.',
    'On your turn: aim with the stick and press to lock, then press again when the power meter is in the green. Strikes and spares give bonuses. Most points wins.',
    'sports', 1, 8, ['#8b5cf6', '#4c1d95'], stickPad('party', [btn('A', 'נעל / גלגל', 'LOCK / ROLL', '#5dfc8d', 'throw', true)]),
    [opt('frames', 'סבבים', 'Frames', [2, 3, 4, 5], 4)]),
  game('boat', 'מרוץ סירות', 'Boat Racing', 'גלים, החלקות וטורבו על המים', 'Waves, slides and turbo on the water',
    'ההגה מסובב את הסירה — היא מחליקה ולא נעצרת מיד! גז ובלם בימין, טורבו מהמד, פריטים מקופסאות ה־?.',
    'Steer the boat — it drifts and does not stop on a dime! GAS and BRAKE on the right, TURBO from the meter, items from ? boxes.',
    'racing', 1, 8, ['#06b6d4', '#1d4ed8'], racePad(), raceOpts()),
  game('bike', 'מרוץ אופניים', 'Bike Racing', 'קלים, מהירים וחדים בפניות', 'Light, fast and sharp in the corners',
    'אופניים מהירים עם אחיזה חזקה ופניות חדות. גז ובלם בימין, טורבו מהמד, פריטים מקופסאות ה־?.',
    'Fast bikes with strong grip and sharp turns. GAS and BRAKE on the right, TURBO from the meter, items from ? boxes.',
    'racing', 1, 8, ['#f97316', '#92400e'], racePad(), raceOpts()),
  // ---- wave B ----
  game('tank', 'קרב טנקים', 'Tank Battle', 'ירו, הקפיצו פגזים והניחו מוקשים', 'Fire, bounce shells and lay mines',
    'הטנק פונה לכיוון הג׳ויסטיק. ירייה (A) קופצת פעם אחת מהקירות. מוקש (B) מתחמש אחרי שנייה. 3 פגיעות והטנק מתפוצץ. האחרון שנשאר מנצח.',
    'The tank turns toward the stick. FIRE (A) shells bounce off walls once. MINE (B) arms after a second. Three hits and you blow up. Last tank standing wins.',
    'action', 2, 8, ['#65a30d', '#3f6212'], stickPad('fighter', [btn('A', 'ירי', 'FIRE', '#ff4d6d', 'fire', true), btn('B', 'מוקש', 'MINE', '#ffd23f', 'mine')])),
  game('wizard', 'דו־קרב קוסמים', 'Wizard Duel', 'כדורי אש, מגן והתעלמות', 'Fireballs, shields and blinks',
    'כדור אש (A) מתפוצץ ודוחף. מגן (B) חוסם פגיעות. קפיצת קסם (C) מתחמקת. אספו כדורים ירוקים לריפוי. האחרון שנשאר מנצח.',
    'FIREBALL (A) explodes and knocks back. SHIELD (B) blocks hits. BLINK (C) dodges. Grab green orbs to heal. Last wizard standing wins.',
    'action', 2, 8, ['#a855f7', '#5b21b6'], stickPad('fighter', [btn('A', 'כדור אש', 'FIREBALL', '#ff8c42', 'fire', true), btn('B', 'מגן', 'SHIELD', '#3ec1ff', 'shield'), btn('C', 'קפיצה', 'BLINK', '#b26bff', 'blink')])),
  game('survival', 'הישרדות בזירה', 'Arena Survival', 'כולם יחד נגד גלי מפלצות', 'All together against waves of monsters',
    'שיתוף פעולה! חתכו מפלצות (A) ובצעו גלגול (B) כדי להתחמק. נפלתם? חבר שעומד לידכם מחיה אתכם. שרדו את כל הגלים.',
    'Co-op! SLASH monsters (A) and ROLL (B) to dodge. Knocked down? A teammate standing next to you revives you. Survive all waves.',
    'survival', 1, 8, ['#ec4899', '#831843'], stickPad('fighter', [btn('A', 'חיתוך', 'SLASH', '#ff4d6d', 'shove', true), btn('B', 'גלגול', 'ROLL', '#3ec1ff', 'dodge')]),
    [opt('waves', 'גלים', 'Waves', [4, 6, 8], 6)]),
  game('defense', 'הגנה על הבסיס', 'Base Defense', 'שמרו על הגביש מפני הגלים', 'Protect the crystal from the waves',
    'שיתוף פעולה! ירו באויבים (A) לפני שהם מגיעים לגביש במרכז. כל אויב נותן מטבע — 4 מטבעות קונים צריח אוטומטי (B).',
    'Co-op! SHOOT enemies (A) before they reach the crystal in the middle. Each kill gives a coin — 4 coins buy an automatic turret (B).',
    'strategy', 1, 8, ['#14b8a6', '#115e59'], stickPad('fighter', [btn('A', 'ירי', 'SHOOT', '#ffd23f', 'fire', true), btn('B', 'צריח (4 מטבעות)', 'TURRET (4c)', '#5dfc8d', 'star')]),
    [opt('waves', 'גלים', 'Waves', [4, 6, 8], 6)]),
  game('tag', 'תופסת כאוס', 'Tag Chaos', 'אל תהיו התופס כשהזמן נגמר!', 'Do not be "it" when time runs out!',
    'התופס (באש) רודף אחרי כולם. נגעתם? התפקיד עובר! ספרינט (A) מתכלה ומתמלא. מי שהיה התופס הכי מעט זמן מנצח.',
    'The tagger (on fire) chases everyone. Touch someone to pass it on! SPRINT (A) drains and refills. Whoever was "it" for the least time wins.',
    'party', 3, 8, ['#22c55e', '#166534'], stickPad('party', [btn('A', 'ספרינט', 'SPRINT', '#ffd23f', 'dash', true)]),
    [opt('time', 'זמן', 'Time', [45, 60, 90], 60, [['45 שנ׳', '45 s'], ['דקה', '1 min'], ['דקה וחצי', '1.5 min']])]),
  // ---- wave C ----
  game('maze', 'בריחה מהמבוך', 'Maze Escape', 'מי ימצא את היציאה ראשון?', 'Who finds the exit first?',
    'כל סבב נוצר מבוך חדש. רוצו אל היציאה בפינה הימנית־תחתונה. ראשון מקבל הכי הרבה נקודות. הסתערות (A) מאיצה לרגע.',
    'A new maze every round. Race to the exit in the bottom-right corner. First gets the most points. DASH (A) gives a quick burst.',
    'puzzle', 1, 8, ['#818cf8', '#3730a3'], stickPad('party', [btn('A', 'הסתערות', 'DASH', '#ffd23f', 'dash', true)]),
    [opt('rounds', 'סבבים', 'Rounds', [2, 3, 5], 3)]),
  game('rescue', 'חילוץ בחלל', 'Space Rescue', 'מצילים אסטרונאוטים לפני שהזמן נגמר', 'Save astronauts before time runs out',
    'שיתוף פעולה! טוסו באוניית החלל, אספו אסטרונאוטים צפים (עד שניים) והביאו אותם לתחנה משמאל. הימנעו מסלעים — פגיעה מפילה את מי שנושאים. האצה (A).',
    'Co-op! Fly your ship, pick up drifting astronauts (up to two) and bring them to the station on the left. Avoid rocks — a crash drops your passengers. BOOST (A).',
    'coop', 1, 8, ['#38bdf8', '#312e81'], stickPad('fighter', [btn('A', 'האצה', 'BOOST', '#3ec1ff', 'turbo', true)])),
  game('evac', 'פינוי אוצרות', 'Treasure Evacuation', 'מוציאים את האוצר לפני ההצפה!', 'Get the treasure out before the flood!',
    'שיתוף פעולה! הרימו תיבות אוצר (A), סחבו אותן ליציאה משמאל והיזהרו מהשומרים. מים עולים מימין! ספרינט (B) כשאתם בלי תיבה.',
    'Co-op! Pick up treasure chests (A), carry them to the exit on the left and beware the guards. Water rises from the right! SPRINT (B) while empty-handed.',
    'coop', 1, 6, ['#fbbf24', '#0e7490'], stickPad('party', [btn('A', 'הרם / הנח', 'GRAB / DROP', '#5dfc8d', 'hand', true), btn('B', 'ספרינט', 'SPRINT', '#ffd23f', 'dash')])),
  game('treasure', 'ציד אוצרות', 'Treasure Hunt', 'חפרו מהר — האוצרות חבויים!', 'Dig fast — the treasure is hidden!',
    'האוצרות קבורים. חפרו (A) במקום הנכון. המד בטלפון מראה חם/קר. מכ״ם (B) מצביע על האוצר הקרוב. יש גם פצצות! הכי הרבה שווי מנצח.',
    'Treasure is buried. DIG (A) in the right spot. Your phone shows hot/cold. RADAR (B) points to the nearest treasure. Beware of bombs! Most value wins.',
    'arcade', 2, 8, ['#fbbf24', '#b45309'], stickPad('party', [btn('A', 'חפירה', 'DIG', '#ffd23f', 'dig', true), btn('B', 'מכ״ם', 'RADAR', '#3ec1ff', 'star')]),
    [opt('time', 'זמן', 'Time', [45, 75, 100], 75)]),
  game('tower', 'מגדל מתנדנד', 'Tower Stack', 'בנו את המגדל הכי גבוה — בלי ליפול', 'Build the tallest tower — without falling',
    'קוביה מתנדנדת מעל המגדל שלכם. לחצו כדי להפיל אותה בדיוק על הקודמת. מה שחורג נחתך. מושלם משאיר את הרוחב. המגדל הכי גבוה מנצח.',
    'A block swings above your tower. Tap to drop it exactly on the last one. Overhang gets cut off. Perfect drops keep the width. Tallest tower wins.',
    'arcade', 1, 8, ['#2dd4bf', '#0f766e'], { kind: 'tap', button: btn('A', 'הפל!', 'DROP!', '#2dd4bf', undefined, true) },
    [opt('time', 'זמן', 'Time', [45, 75, 100], 75)]),
  // ---- wave D ----
  game('spacerace', 'מרוץ חלל', 'Space Racing', 'דוהרים בין סלעים, אוספים אנרגיה', 'Rocket through rocks, grab energy',
    'האוניה טסה קדימה לבד. הזיזו ימינה/שמאלה, התחמקו מסלעים, אספו כדורי אנרגיה והשתמשו בהאצה (A). ראשון לקו הסיום מנצח.',
    'Your ship flies forward on its own. Steer left/right, dodge rocks, collect energy orbs and use BOOST (A). First over the finish line wins.',
    'racing', 1, 8, ['#6366f1', '#0f172a'], stickPad('fighter', [btn('A', 'האצה', 'BOOST', '#3ec1ff', 'turbo', true)])),
  game('balloon', 'בלון בפאניקה', 'Balloon Panic', 'לנפח או לשמור? סיכון!', 'Pump or bank? Push your luck!',
    'נפחו את הבלון (A) — כל נפיחה שווה יותר, אבל הוא עלול להתפוצץ בכל רגע ולהעלים הכל! לחצו שמור (B) כדי להכניס את הנקודות לכיס.',
    'PUMP your balloon (A) — every pump is worth more, but it can pop any time and wipe it all out! Press BANK (B) to lock the points in.',
    'party', 1, 8, ['#f43f5e', '#9d174d'], { kind: 'choices', count: 2, labels: [{ he: 'נפח!', en: 'PUMP!' }, { he: 'שמור', en: 'BANK' }], colors: ['#ff4d6d', '#5dfc8d'], icons: ['jump', 'bank'] },
    [opt('time', 'זמן', 'Time', [45, 60, 90], 60)]),
  game('puzzle', 'פאזל קבוצתי', 'Team Puzzle', 'זוכרים יחד את הרצף', 'Remember the sequence together',
    'שיתוף פעולה! הרצף מופיע על המסך לרגע ואז נעלם. לכל שחקן שייכים רק חלק מהצבעים — לחצו על הצבע שלכם בתורו. טעות עולה בחיים.',
    'Co-op! The sequence flashes on screen then hides. Each player owns only some of the colours — press yours when its turn comes. A mistake costs a life.',
    'puzzle', 2, 8, ['#e879f9', '#6d28d9'], shapeChoices(), [opt('levels', 'שלבים', 'Levels', [4, 6, 8], 6)]),
  game('draw', 'צייר ונחש', 'Draw & Guess', 'מציירים עם האצבע, מנחשים מהר', 'Draw with your thumb, guess fast',
    'המצייר מקבל מילה ומצייר עם הג׳ויסטיק (A = עט למטה, B = מחיקה). כל השאר מנחשים: הטו את הג׳ויסטיק לכיוון המילה הנכונה (למעלה/ימין/למטה/שמאל) ולחצו נעילה. מהר = יותר נקודות.',
    'The drawer gets a word and draws with the stick (A = pen down, B = clear). Everyone else guesses: tilt the stick toward the right word (up/right/down/left) and press LOCK. Faster = more points.',
    'party', 2, 8, ['#fb7185', '#d97706'], stickPad('party', [btn('A', 'עט / נעילה', 'PEN / LOCK', '#5dfc8d', 'dig', true), btn('B', 'מחק', 'CLEAR', '#ff8c42', 'chop')]),
    [opt('rounds', 'סבבים', 'Rounds', [2, 3, 4, 6], 3)]),
  game('trivia', 'טריוויה מסיבה', 'Party Trivia', 'שאלות, מהירות ורצף ניצחונות', 'Questions, speed and streaks',
    'השאלה מופיעה על המסך עם ארבע תשובות צבעוניות. לחצו על הסמל התואם (▲ ● ■ ★). תשובה נכונה ומהירה נותנת יותר נקודות, ורצף נותן בונוס.',
    'The question shows on screen with four coloured answers. Press the matching symbol (▲ ● ■ ★). Correct and fast earns more, and streaks give a bonus.',
    'party', 1, 12, ['#c084fc', '#7c3aed'], shapeChoices(), [opt('questions', 'שאלות', 'Questions', [5, 8, 12, 16], 8)]),
];
export const CATALOG: GameMeta[] = [...BASE_GAMES, ...NEW_GAMES_LIST];

/** Estimated length of one round in minutes [min, max], shown on the game cards. */
export const PLAY_TIME: Record<string, [number, number]> = {
  bumper: [3, 5], kart: [3, 6], reaction: [2, 3], potato: [3, 5], rush: [3, 5], soccer: [2, 3], hockey: [2, 4], board: [8, 12], kitchen: [3, 4], trapbuilders: [4, 6], vanish: [2, 4],
  basketball: [1, 2], bowling: [3, 5], boat: [3, 6], bike: [3, 6], tank: [2, 3], wizard: [2, 3], survival: [3, 5], defense: [4, 6], tag: [1, 2], maze: [3, 5], rescue: [2, 2], evac: [2, 2],
  treasure: [2, 2], tower: [2, 2], spacerace: [1, 2], balloon: [1, 2], puzzle: [3, 5], draw: [4, 8], trivia: [3, 6],
};

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
