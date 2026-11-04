# PROGRESS — FAMILY CHAOS 3.0 (ten games)

Branch: `ccr-64ced051-a2t8s8` · folder: `family-chaos/` · live site: https://family-chaos.onrender.com
Render auto-deploys from this branch. From the dev sandbox the live site is **not reachable**, so nothing here claims it was deployed or checked live.
The old 30-game library is kept on the git branch `backup/pre-3.0-422a138`.

## How to continue after an interruption
1. `cd family-chaos && npm ci && npm run build && npx vitest run`, then run the browser tests **one spec file at a time, detached**
   (`for f in controller controls devices games-input kart3d multiplayer network accounts; do npx playwright test tests/e2e/$f.spec.ts …; done`; the whole suite is ~20 min).
   Never free ports (`fuser -k`) or rebuild `dist` while a test run is in progress.
2. Read NEXT_STEPS.md and docs/GAME_AUDIT.md.
3. Commit per stable unit, push `ccr-64ced051-a2t8s8`, update this file.

## Stage log
| Stage | What | State |
|---|---|---|
| 1 Backup + audit + library cut | backup branch; exactly ten games (Kart Chaos, Chaos Rush, Mini Soccer, Air Hockey, **Flag Wars**, Family Board Party, Trap Builders, Bumper Battle, Floor Is Lava, Hot Potato); Crazy Kitchen, bowling and the rest removed from the library | done (commit 4dc1c23) |
| 2 Kart Chaos 3D | Three.js world rendered **on each phone**; cockpit / bumper / chase cameras, mini-map, speedometer, lap, rank, speed + crash effects; wheel / arrows / tilt, gas·brake·turbo·item, manual-gas + sensitivity options; host spectator view (leader tracking, car switcher, lap times, podium); server-authoritative, 20 Hz phone frames, interpolation + dead-reckoning | done (cf4ada9); verified with headless software-WebGL screenshots + e2e; **not on a physical phone** |
| 3 Flag Wars | two teams, flags, tackle, sprint/jump/power, original map, small-group handicap, overtime, renderer, HUD, unit tests | done (4dc1c23) |
| 4 Other games | touchpad Air Hockey, soccer pass, Bumper/Lava/Potato/Flag Wars owner powers, Kart manual gas, snapshots/HUD per game | partly done (see below) |
| 5 Design system | "sticker-book arcade" (docs/DESIGN_SYSTEM.md), drawn icons, console-style lobby with ten tiles, keyboard + gamepad navigation, GSAP transitions | done (a8269ed); layout fixed for TV/PC sizes in this stage |
| 6 Controllers | accurate stick, multi-touch, pointer capture, no scroll, L/R + size options, rotate, reconnect; S25-Ultra-sized viewport emulation (412×891 / 891×412) | done; **emulation only** |
| 7 Accounts + GOD ADMIN | guest/account, stats, achievements, trophies; owner verified server-side; 19 powers; game-changing powers only in party rooms with visible chaos mode, refused during tournaments | done, unit + e2e tested; needs `DATABASE_URL` on Render |
| 8 Tournaments | party, knockout, league, multi-day; manual/random/mixed picks; points table; finals; trophies; hold/skip; persisted in the database and resumable | done, unit-tested (PGlite); browser flow for league + multi-day hold e2e-tested (multiplayer.spec); resume-from-database flow only unit-tested |
| 9 Tests | see below | done for what is listed |

## Test status (last full run on this build)
* `tsc --noEmit`: clean. Unit (vitest): **14 files, 113 tests pass**.
* Browser (Playwright, Chromium, CDP touch emulation), run per spec file: controller 13/13, controls 3/3, devices 3/3, games-input 1/1
  (every game: two phones, every control reaches the server, both players in the match, results, back to the lobby), kart3d 3/3, multiplayer 7/7, network 6/6, accounts 4/4 → **38/38**, plus league and multi-day tournament flows (2 more, 40 total).
* Failures found and fixed this stage: selected tile's endless wiggle made clicks "unstable" (now plays twice); lobby start button overflowed the fold at 1920×1080 with the long "needs 2 players" text; hockey touchpad test assumed a relative stick; a joystick test assumed the round was still running after the host lagged.
* Not tested: real phones (tilt direction, wheel feel, 3D frame rate on a real GPU), the live Render site, Postgres (unit tests use PGlite), many-room load beyond the earlier local checks.

## Honest remaining list
* Remaining-eight-game polish: Chaos Rush tracks/camera, Family Board Party interactivity and bonus mini-games, Trap Builders flow, original per-game sound.
* Tournaments: team tournaments, cosmetic prizes beyond trophies; browser test for resume.
* Chaos powers for Kart, Soccer, Hockey, Rush, Trap Builders, Board (only cosmetic powers there).
* Kart podium scene and extra 3D polish; a performance budget test on a real phone.
* Render: set `DATABASE_URL` (free Postgres) for accounts, owner and saved tournaments; without it those are off (see docs/DEPLOY.md).

Last commit: see `git log -1` on the branch.
