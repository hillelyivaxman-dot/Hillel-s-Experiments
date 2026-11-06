# PROGRESS — FAMILY CHAOS (quality fix round on top of 3.0)

Branch: `ccr-64ced051-a2t8s8` · folder: `family-chaos/` · live site: https://family-chaos.onrender.com
Render auto-deploys from this branch. From the dev sandbox the live site is **not reachable**, so nothing here claims it was deployed or checked live.
Older games live on the git branch `backup/pre-3.0-422a138` (and Hot Potato is still in the code, just not in the library).

## The ten games now
Kart Chaos · Chaos Rush · Mini Soccer · Air Hockey · Flag Wars · Family Board Party · Trap Builders · Bumper Battle · Floor Is Lava · **Base Defense (new, co-op)**.
Hot Potato was taken out of the main library (`ARCHIVED_IDS` in `shared/catalog.ts`; module, renderer and tests are kept).

## How to continue after an interruption
1. `cd family-chaos && npm ci && npm run build && npx vitest run`.
2. Browser tests, one spec file at a time, detached, and **don't rebuild `dist` or free ports while they run**:
   `for f in after-game controller controls devices games-input kart3d multiplayer network accounts; do npx playwright test tests/e2e/$f.spec.ts …; done` (~20 min).
3. Read NEXT_STEPS.md; commit per stable unit; push `ccr-64ced051-a2t8s8`; update this file.

## This round (what was fixed / improved)
1. **Stuck purple screen after a game — root cause found and fixed.** In phone landscape the results screen (big critter + text + two big buttons) was taller than the screen, so *Play again / Back to lobby* sat below the bottom edge and only the patterned background was visible; phones that are not the room leader had no action at all. Now: one compact results panel (side by side in landscape), actions always inside the viewport, non-leaders see "waiting for <leader>…", tournament info + countdown to the next game, safe-area padding. Also: a leader whose phone sleeps hands the crown on after 8 s; a UI **error boundary** shows Reload/Home instead of a bare background if any screen crashes.
2. **Design v4 "arcade cabinet"** (`client/src/arcade.css`, loaded last): 4–10 px corners instead of pills/bubbles, framed panels with title strips, bevelled keys, rounded-square pad buttons, dark grid + scanline background, console header. Applied to home, lobby (players / join / tournament as separate framed panels), game tiles, results, phone UI.
3. **Kart Chaos:** calmer turn rates, speed-scaled look-ahead and kerb-proportional steering assist (hard to lose the road, still easy to steer), rubber-band catch-up for trailing karts, softer wall bounce, stronger brakes, farther/higher chase camera, see-through smaller steering keys. Handling unit tests made deterministic (cruise-only start).
4. **Chaos Rush:** the screen edge only moves forward (front runner + slow creep); anyone behind it gets a 3-second "GET BACK ON SCREEN!" countdown (red edge glow, big number over the runner, phone HUD + vibration), then is eliminated (ghost + OUT). Respawns always land on screen; last runner standing ends the round; results rank by finish / survival time. Unit tests.
5. **Base Defense (new, co-op, replaces Hot Potato in the ten):** shared core, waves of runners/grunts/brutes scaled to group size, auto-fire defenders with four roles (Gunner BURST, Builder TURRET, Tank SHOCK, Medic HEAL), shared scrap → turrets and team upgrades, downed/revive, shared team stars. Renderer, phone HUD/controller, catalog, unit tests.
6. **Bumper Battle team mode** (option "Mode": free for all / teams): red vs blue, last team standing, shared first place, no KO credit for pushing a team-mate. **GOAL!** banners in soccer and hockey.
6b. **Mini Soccer rebuilt around possession** (user feedback: kicking was hard to do, the ball floated): touching the ball picks it up and it sits in front of you, wherever you look, with an aim arrow and a halo; A = SHOOT along the arrow when you have it, A = SLIDE TACKLE when you don't (steals from a carrier, then a short recovery); C = pass; B = sprint. Phone HUD says "you have the ball"; STOLEN! effect. Unit tests for carry / shoot / slide-steal; games-input, controller, after-game, devices e2e re-run green.
7. Tests added: `tests/e2e/after-game.spec.ts` (start → finish → results with actions visible in 3 viewports → lobby → next game; leader hand-over; 8 games back to back with no page errors), `tests/unit/rush-elimination.test.ts`, `tests/unit/basedefense.test.ts` (+ bumper teams).

## Test status
* `tsc --noEmit` clean; unit tests **123 pass** (18 files).
* Browser suite on this build: see the "Browser results" line at the bottom (filled in after the run).
* **Not tested:** real phones (tilt, wheel feel, 3D frame rate), the live Render site, Postgres (PGlite only), load with many rooms.

## Still not good / not done (honest)
* Kart: no AI bots to fill the grid (2-player races feel empty); podium scene; 3D frame rate on a real phone unknown.
* Flag Wars / Mini Soccer: only small polish this round (soccer/hockey GOAL banners); no new maps, no new soccer controls.
* Family Board Party: no new bonus mini-games or team bonus rounds yet. Trap Builders, Floor Is Lava: unchanged this round.
* Base Defense: first version, never play-tested by people; numbers (wave sizes, costs, enemy speed) are constants in `shared/basedefense.ts` / `server/games/basedefense.ts`.
* Per-game original sound; team tournaments; Render needs `DATABASE_URL` for accounts / saved tournaments.

## Next
1. Play Base Defense, Chaos Rush and Kart with real phones and tune the constants.
2. Kart AI bots + podium; soccer feel (ball friction/kick power), Flag Wars extra route.
3. Board Party team mini-games; Floor Is Lava dynamic stages.

Last commit: see `git log -1` on the branch.

Browser results (this build, per spec file): after-game 3/3, controller 13/13, controls 3/3 (one assertion was loosened: the steering-assist now bends the idle kart along the road too), devices 3/3, games-input 1/1, kart3d 3/3, multiplayer 7/7, network 6/6, accounts 4/4 = 40/40. Not run: real phones, live site.
