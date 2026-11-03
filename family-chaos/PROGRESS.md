# PROGRESS — FAMILY CHAOS (30 games, tournament v1)

Branch: `ccr-64ced051-a2t8s8` · folder: `family-chaos/` · live site: https://family-chaos.onrender.com
(Render auto-deploys from this branch. From the dev sandbox the live site is **not reachable**, so "deployed" is never claimed here.)

## How to continue after an interruption
1. `cd family-chaos && npm ci && npm run check` (types + unit + build + browser tests; ~7 min). Must be green before pushing.
2. Read the **Game checklist** below and continue with the first unchecked game of the current wave.
3. Add a game = `docs/ADDING_A_GAME.md` (server module + renderer + catalog entry + controller + tests).
4. Commit per game or per wave; push `ccr-64ced051-a2t8s8`. Update this file.

## Done
- Platform: rooms, lobby, QR, accounts, controllers (measured layout engine), HTTPS/WSS tests, Render blueprint.
- Playable: **30 of 30** (see table below). First 11: Bumper Battle, Kart Chaos, Reaction Duel, Hot Potato, Chaos Rush, **Soccer, Air Hockey, Crazy Kitchen, Family Board Party, Trap Builders, Vanishing Floor**.
- **Task 1 — Kart steering (done):** virtual **steering wheel** you rotate with a finger (grab anywhere, relative rotation, ±115° lock,
  expo curve, snaps back on release), **arrow** steering (hold left/right, ramped on the server) and **tilt** steering
  (DeviceMotion, iPhone permission tap, calibration, invert option). GAS / BRAKE / TURBO / ITEM buttons.
  Arcade physics rewrite (`server/games/kart.ts`): smoothed steering, yaw rate that falls with speed, lateral grip with slide, drift
  (brake + steer), cornering speed cost, gentler brake, straight-line assist, wall slide. Fixed a road-lookup bug at the figure-eight crossing.
  Tests: `tests/unit/kart-handling.test.ts` (no snap turns/spin, steering ramp, responsiveness, wide arc at speed, braking, drift flag),
  autopilot finishes 2 laps on all 3 tracks; e2e: wheel proportionality / snap back, arrows, tilt with simulated sensor.
  **Not tested on real hardware**: tilt direction/sign on a physical phone (an "invert" switch exists), wheel feel on a real thumb.

## Game checklist — ALL 30 games are playable (server rules + renderer + phone controller + unit smoke tests)
Legend: every game below is `status: 'playable'` in `shared/catalog.ts`, has server-authoritative rules in `server/games/`, a canvas renderer in `client/src/render/`, a phone HUD in `client/src/pages/Join.tsx`, and is covered by `tests/unit/newgames.test.ts` (bots play it to the end with 1/3/8 players, ranks everyone, snapshot size budget) plus the per-game browser loops (`controls`, `controller`, `devices` specs iterate the whole catalog).

| # | Game | Notes |
|---|------|-------|
| 1-11 | Bumper Battle, Kart Chaos, Reaction Duel, Hot Potato, Chaos Rush, Soccer, Air Hockey, Crazy Kitchen, Family Board Party, Trap Builders, Vanishing Floor ("Floor is Lava") | earlier waves, fully tested |
| 12 | **Basketball Chaos** | hold to charge a meter, release in the green zone (zone depends on distance; far = 3 pts, perfect = +1) |
| 13 | **Crazy Bowling** | turn-based, aim → power meter, 10 pins with chain reaction, strike/spare bonus |
| 14-15 | **Boat Racing / Bike Racing** | same racing engine as Kart with different handling presets (`RACER_TUNING` in `server/games/kart.ts`) and water/dirt themes |
| 16 | **Tank Battle** | walls, shells bounce once, mines, 3 hits |
| 17 | **Wizard Duel** | fireball with splash + knockback, shield, blink, heal orbs |
| 18 | **Arena Survival** (co-op) | waves of monsters, slash/roll, teammates revive you by standing next to you; stars by wave reached |
| 19 | **Base Defense** (co-op) | protect the crystal, shoot, buy auto-turrets with coins |
| 20 | **Tag Chaos** | "it" with sprint stamina; least time as "it" wins |
| 21 | **Maze Escape** | new random (always solvable) maze each round, race to the exit |
| 22 | **Space Rescue** (co-op) | pick up astronauts, bring them to the station, avoid rocks |
| 23 | **Treasure Evacuation** (co-op) | carry chests to the exit, guards chase, flood rises |
| 24 | **Treasure Hunt** | dig, hot/cold meter on the phone, radar, bombs |
| 25 | **Tower Stack** | swinging block, overhang is cut, perfect drops keep width |
| 26 | **Space Racing** | vertical race through rocks, boost energy, rubber-banding |
| 27 | **Balloon Panic** | push-your-luck pump/bank |
| 28 | **Team Puzzle** (co-op) | sequence memory; each player owns only some colours |
| 29 | **Draw & Guess** | stick draws (pen button), guessers tilt the stick toward one of 4 words and lock; HE/EN word bank |
| 30 | **Party Trivia** | 26 bilingual questions, 4 coloured answers, speed + streak scoring |

## Tournaments (in-memory, per room)
Lobby → "🏆 Party tournament": **3 / 5 / 8 random games**, **✎ Pick games** (tap games in the rail in order, then start), or **⚔ Knockout** (the last place of each individual-ranking game is out until one player is left; no-shows forfeit). Points per place 10/7/5/3/2/1, next game starts by itself after 12 s, **Next game now / ⏸ Hold here / Cancel** on the results screen, champion + crown at the end. Ties share a place. Crown powers are refused while a tournament runs. Tests: `tests/unit/tournament.test.ts` (series, skip, cancel, hold, player-count filter, knockout) and a browser test in `tests/e2e/multiplayer.spec.ts`.
**Not built yet:** League and Multi-day formats, persistence across Render restarts (needs `DATABASE_URL`), tournament profile card, bracket screen.

## Honest status of the rest of the master prompt
- **GOD ADMIN crown — built (server-side), needs the database to be usable on Render.** `users.role` column; one-time owner claim in `/account` ("Owner setup") with a setup code from `OWNER_SETUP_CODE` or printed in the server log; the WebSocket connection is marked `owner` only when the session cookie belongs to an OWNER user (verified in `server/index.ts`, never trusted from the client); 12 powers (confetti, earthquake, flash, fanfare, freeze 3 s, slow-mo, turbo, mirror controls, +3 stars, rob the leader, new leader, end game) run inside `Room.godPower`; refused for non-owners and during a running tournament (`competitive`); every use is logged. Tests: `tests/unit/god.test.ts`. Roles ADMIN/HOST are reserved values in the schema but have no behaviour yet. Accounts are OFF on Render until `DATABASE_URL` is set, so the crown only appears after that (docs/DEPLOY.md, Hebrew section).
- Google login / password reset: not built.
- XP / cosmetics / profile card: not built (basic stats + achievements exist).
- Console-style redesign of home/library/lobby, estimated play time on cards, GSAP page transitions: not done (library already has search, favourites, categories, player counts).
- Game art: each of the 19 new games uses a canvas-drawn scene and an emoji card icon (not custom SVG art yet).
- No real-device testing. Balance of the new games has only been checked with bots and screenshots, not with people.

## Last verified test run (sandbox, Chromium only)
- `npx vitest run`: **13 files / 199 tests passed** (every new game played to the end with bots at 1/3/8 players, scripted rule tests, tournament + knockout + hold, crown authorisation, owner claim, frame-size budget, boat/bike autopilots).
- `npx playwright test` (all specs except the 30-games x 6-phones layout test): **32 passed, 1 flaky** (known: "two phones control two different characters…" fails its first attempt under load and passes on retry). Includes: all 30 controllers' buttons (1 phone), all 30 games start/run/return to lobby, party tournament in the browser, owner setup + crown in the browser.
- The 30-games x 6-phone-profiles layout test (`devices.spec.ts` "every phone gets the right controller…") was **not run in full** (it takes ~25 min); it was run for 9 games (trivia, puzzle, balloon, board, draw, basketball, tower, wizard, spacerace) x 6 phones: passed. Run the rest with `npx playwright test devices -g "every phone"` (optionally `DEV_GAMES=a,b,c`).
- Not done: real phones, Safari/Firefox engines, a real Render deploy check (the sandbox cannot reach the site).

## Library / website improvements (requested)
- [x] categories filter · [x] search · [x] favourites (stored on the device) · [x] player count shown on every card · [x] original vector icon per game · [x] estimated play time (home cards) · [x] search also matches taglines · [ ] page transitions · [ ] console-style redesign of home/lobby

## Incident (fixed)
Live site returned **502 Bad Gateway**: the in-process Postgres (PGlite) added for accounts used 457 MB idle / 748 MB peak, over Render's 512 MB free limit, so the instance was OOM-killed. Fix: accounts are OFF on Render unless `DATABASE_URL` (Neon) is set; server peak is now ~85 MB. Regression test in `tests/unit/accounts.test.ts`.

## Known limits
- No real-device testing (no physical phones / Safari / Firefox engines in the sandbox).
- Render free plan: sleeps after 15 min idle, 5 GB/month bandwidth, rooms in memory.
