import { boardGame } from './board';
import { bumperGame } from './bumper';
import { hockeyGame } from './hockey';
import { kartGame } from './kart';
import { kitchenGame } from './kitchen';
import { potatoGame } from './potato';
import { reactionGame } from './reaction';
import { trapBuildersGame } from './trapbuilders';
import { vanishGame } from './vanish';
import { rushGame } from './rush';
import { soccerGame } from './soccer';
import type { GameModule } from './types';

// Register new game modules here (and mark them `status: 'playable'` in shared/catalog.ts).
export const GAMES: Record<string, GameModule> = Object.fromEntries(
  [bumperGame, kartGame, reactionGame, potatoGame, rushGame, soccerGame, hockeyGame, boardGame, kitchenGame, trapBuildersGame, vanishGame].map((g) => [g.id, g]),
);
