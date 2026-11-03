// CRAZY KITCHEN shared definitions: stations, their two layouts (the kitchen reshuffles half way), recipes.
export type Kind = 'bun' | 'patty' | 'tomato' | 'lettuce';
export type State = 'r' | 'c' | 'k' | 'b'; // raw, chopped, cooked, burnt
export type StationKind = 'crate' | 'board' | 'stove' | 'counter' | 'plates' | 'serve' | 'trash';

export interface StationDef { id: string; kind: StationKind; crate?: Kind; w: number; h: number; pos: [number, number][] } // pos[layout]

export const KITCHEN = { W: 1400, H: 800, R: 26, SPEED: 330, CHOP_TIME: 2.4, COOK_TIME: 6, BURN_TIME: 5, REACH: 58 } as const;

const S = (id: string, kind: StationKind, a: [number, number], b: [number, number], w = 120, h = 90, crate?: Kind): StationDef => ({ id, kind, crate, w, h, pos: [a, b] });

export const STATIONS: StationDef[] = [
  S('c-bun', 'crate', [90, 24], [540, 24], 120, 90, 'bun'),
  S('c-patty', 'crate', [230, 24], [400, 24], 120, 90, 'patty'),
  S('c-tomato', 'crate', [370, 24], [230, 24], 120, 90, 'tomato'),
  S('c-lettuce', 'crate', [510, 24], [90, 24], 120, 90, 'lettuce'),
  S('plates', 'plates', [690, 24], [690, 24], 120, 90),
  S('trash', 'trash', [840, 24], [840, 24], 100, 90),
  S('n1', 'counter', [470, 330], [470, 330], 110, 80), S('n2', 'counter', [590, 330], [590, 330], 110, 80),
  S('n3', 'counter', [710, 330], [710, 330], 110, 80), S('n4', 'counter', [830, 330], [830, 330], 110, 80),
  S('b1', 'board', [90, 600], [690, 620], 130, 90), S('b2', 'board', [240, 600], [840, 620], 130, 90),
  S('s1', 'stove', [690, 620], [90, 600], 130, 90), S('s2', 'stove', [840, 620], [240, 600], 130, 90),
  S('serve', 'serve', [1250, 320], [1250, 320], 120, 160),
];

export interface Recipe { id: string; items: string[]; name: { he: string; en: string }; pts: number }
export const RECIPES: Recipe[] = [
  { id: 'burger', items: ['bun.r', 'patty.k', 'tomato.c'], name: { he: 'המבורגר', en: 'Burger' }, pts: 28 },
  { id: 'salad', items: ['tomato.c', 'lettuce.c'], name: { he: 'סלט', en: 'Salad' }, pts: 18 },
  { id: 'grill', items: ['patty.k', 'lettuce.c'], name: { he: 'גריל וירק', en: 'Grill & Greens' }, pts: 20 },
];
export const recipeById = (id: string) => RECIPES.find((r) => r.id === id)!;
export const itemCode = (k: Kind, s: State) => `${k}.${s}`;
/** Plate contents match a recipe exactly (order does not matter). */
export const matchRecipe = (items: string[]): Recipe | null => {
  const a = [...items].sort().join('|');
  return RECIPES.find((r) => [...r.items].sort().join('|') === a) ?? null;
};
/** Can this item be put on a plate at all (is it part of some recipe, in the right state)? */
export const plateable = (code: string) => RECIPES.some((r) => r.items.includes(code));
