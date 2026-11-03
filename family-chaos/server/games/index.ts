import { bumperGame } from './bumper';
import { kartGame } from './kart';
import { potatoGame } from './potato';
import { reactionGame } from './reaction';
import { rushGame } from './rush';
import type { GameModule } from './types';

// Register new game modules here (and mark them `status: 'playable'` in shared/catalog.ts).
export const GAMES: Record<string, GameModule> = Object.fromEntries(
  [bumperGame, kartGame, reactionGame, potatoGame, rushGame].map((g) => [g.id, g]),
);
