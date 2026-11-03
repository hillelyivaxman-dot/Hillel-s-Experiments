import { boardGame } from './board';
import { bumperGame } from './bumper';
import { flagWarsGame } from './flagwars';
import { hockeyGame } from './hockey';
import { kartGame } from './kart';
import { potatoGame } from './potato';
import { rushGame } from './rush';
import { soccerGame } from './soccer';
import { trapBuildersGame } from './trapbuilders';
import { vanishGame } from './vanish';
import type { GameModule } from './types';

// FAMILY CHAOS 3.0 ships exactly ten games. Older games (kitchen, bowling, boats/bikes, tanks, ...) live on the branch
// `backup/pre-3.0-422a138`. Register a new module here AND mark it playable in shared/catalog.ts.
export const GAMES: Record<string, GameModule> = Object.fromEntries(
  [kartGame, rushGame, soccerGame, hockeyGame, flagWarsGame, boardGame, trapBuildersGame, bumperGame, vanishGame, potatoGame].map((g) => [g.id, g]),
);

