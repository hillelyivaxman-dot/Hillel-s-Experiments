import { boardGame } from './board';
import { bumperGame } from './bumper';
import { hockeyGame } from './hockey';
import { bikeGame, boatGame, kartGame } from './kart';
import { kitchenGame } from './kitchen';
import { potatoGame } from './potato';
import { reactionGame } from './reaction';
import { trapBuildersGame } from './trapbuilders';
import { vanishGame } from './vanish';
import { rushGame } from './rush';
import { soccerGame } from './soccer';
import { basketballGame } from './basketball';
import { bowlingGame } from './bowling';
import { defenseGame, survivalGame, tagGame, tankGame, wizardGame } from './arena';
import { evacuationGame, huntGame, mazeGame, spaceRescueGame, towerGame } from './wave_c';
import { balloonGame, drawGame, puzzleGame, spaceRaceGame, triviaGame } from './wave_d';
import type { GameModule } from './types';

// Register new game modules here (and mark them `status: 'playable'` in shared/catalog.ts).
export const GAMES: Record<string, GameModule> = Object.fromEntries(
  [bumperGame, kartGame, reactionGame, potatoGame, rushGame, soccerGame, hockeyGame, boardGame, kitchenGame, trapBuildersGame, vanishGame,
    basketballGame, bowlingGame, boatGame, bikeGame, tankGame, wizardGame, survivalGame, defenseGame, tagGame,
    mazeGame, spaceRescueGame, evacuationGame, huntGame, towerGame, spaceRaceGame, balloonGame, puzzleGame, drawGame, triviaGame].map((g) => [g.id, g]),
);
