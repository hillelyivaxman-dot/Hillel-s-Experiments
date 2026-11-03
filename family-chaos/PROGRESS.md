# PROGRESS — FAMILY CHAOS (30 games, overhaul A-D)

Branch: `ccr-64ced051-a2t8s8` · folder: `family-chaos/` · live site: https://family-chaos.onrender.com
(Render auto-deploys from this branch. From the dev sandbox the live site is **not reachable**, so "deployed" is never claimed here.)

## How to continue after an interruption
1. `cd family-chaos && npm ci && npm run check` (types + unit + build + browser tests; ~25 min, run it detached). Must be green before pushing.
2. Read docs/GAME_AUDIT.md (all 30 games) and NEXT_STEPS.md.
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

## MAJOR OVERHAUL (gameplay, controls, graphics, admin) — rounds A-D
Details per game: **docs/GAME_AUDIT.md** (table of all 30 games, what makes each one different, findings, what is not verified).
* **Round A — controls & racing.** Racing is now auto-accelerate with two big arrow buttons (wheel and tilt remain as options in the ⚙ sheet). Karts keep items + drift; **boats** have streams/eddies/rocks/whirlpools + SURGE; **bikes** have ramps, hurdles, HOP and a combo. A short "how to play" card shows on every phone during the countdown. Controller e2e tests were rewritten for the new controls.
* **Round B — gameplay.** Basketball rebuilt (aim with the stick, preview arc, real ball physics on the server, moving hoops, swish/streak). Zombie Survival (3 zombie types, waves, revive, hearts), Mage Hill (replaces Wizard Duel), Freeze Tag (replaces Tag), Space Rescue (tractor beam + oxygen), Bowling hook, Maze fog of war. Library categories regrouped into six by core mechanic.
* **Round C — graphics.** One drawn icon set (`shared/icons.ts`, drawn by React and canvas) replaced emoji in the UI, phone HUDs, results and scenes; original SVG card art for the 19 newer games; zombies, astronauts, hearts, hoops, ice etc. are drawn in code. (Emoji is no longer used as graphics; a few typographic glyphs like ▲ ● ■ remain as button labels.)
* **Round D — admin & group experience.** `/admin` page (what is missing: database -> account -> owner code -> host screen), owner-only management panel on the host screen in Hebrew/English (start/pause/end/lobby, pick game, tournaments, 12 crown powers with explanations and reasons when disabled, players with ping and connection alerts). Authorisation is checked on the server for the crown powers (`Room.godPower` uses the verified `client.owner`), refused during tournaments. Browser test `tests/e2e/games-input.spec.ts` presses every control of all 30 games with real touch in two contexts and checks it reaches the server.

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

## Last verified test runs (sandbox, Chromium only)
- `npx vitest run`: **14 files / 205 tests passed** (every game played to the end by bots at 1/3/8 players; scripted "good player" bots for basketball aim, racers, rescue, zombies, mage hill, freeze tag; tournaments incl. knockout/hold; crown authorisation; owner claim; racer features; frame-size budget).
- Browser suite on the final code, in pieces: full run = 33 passed + 3 failed whose expectations were outdated by the new racing controls (GAS button / wheel / stale heading assertions); those were fixed and re-run: **passed**. `games-input.spec` (all 30 games, two real browser contexts, every control touched, results and back to lobby): **passed (4.4 min)**. `devices.spec` layout test (all 30 games x 6 phone profiles): **passed (4.3 min)**. `accounts.spec` (owner claim, crown, management panel, /admin page): passed. The "two phones" test + kart multi-touch test: 10/10 passes in repeat runs after fixing my own heading-wrap bug in the kart part (full-lock turns exceeded half a turn so the signed angle wrapped).
- **Not one single uninterrupted green run of the whole suite on the very last commit** (it takes ~35 min; the pieces above were run separately after the last test edits).
- Still unexplained: the old first-attempt failure of the *bumper* part of "two phones control two different characters…" seen once earlier (no reproduction in 18 isolated + 12 CPU-stressed runs).
- Not done: real phones, Safari/Firefox engines, a real Render deploy check (the sandbox cannot reach the site), human play-testing.

## Library / website improvements (requested)
- [x] categories filter · [x] search · [x] favourites (stored on the device) · [x] player count shown on every card · [x] original vector icon per game · [x] estimated play time (home cards) · [x] search also matches taglines · [ ] page transitions · [ ] console-style redesign of home/lobby

## Incident (fixed)
Live site returned **502 Bad Gateway**: the in-process Postgres (PGlite) added for accounts used 457 MB idle / 748 MB peak, over Render's 512 MB free limit, so the instance was OOM-killed. Fix: accounts are OFF on Render unless `DATABASE_URL` (Neon) is set; server peak is now ~85 MB. Regression test in `tests/unit/accounts.test.ts`.

## Known limits
- No real-device testing (no physical phones / Safari / Firefox engines in the sandbox).
- Render free plan: sleeps after 15 min idle, 5 GB/month bandwidth, rooms in memory.
