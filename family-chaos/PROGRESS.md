# PROGRESS — FAMILY CHAOS (30-game expansion)

Branch: `ccr-64ced051-a2t8s8` · folder: `family-chaos/` · live site: https://family-chaos.onrender.com
(Render auto-deploys from this branch. From the dev sandbox the live site is **not reachable**, so "deployed" is never claimed here.)

## How to continue after an interruption
1. `cd family-chaos && npm ci && npm run check` (types + unit + build + browser tests; ~7 min). Must be green before pushing.
2. Read the **Game checklist** below and continue with the first unchecked game of the current wave.
3. Add a game = `docs/ADDING_A_GAME.md` (server module + renderer + catalog entry + controller + tests).
4. Commit per game or per wave; push `ccr-64ced051-a2t8s8`. Update this file.

## Done
- Platform: rooms, lobby, QR, accounts, controllers (measured layout engine), HTTPS/WSS tests, Render blueprint.
- Playable (5): Bumper Battle, Kart Chaos, Reaction Duel, Hot Potato, Chaos Rush.
- **Task 1 — Kart steering (done):** virtual **steering wheel** you rotate with a finger (grab anywhere, relative rotation, ±115° lock,
  expo curve, snaps back on release), **arrow** steering (hold left/right, ramped on the server) and **tilt** steering
  (DeviceMotion, iPhone permission tap, calibration, invert option). GAS / BRAKE / TURBO / ITEM buttons.
  Arcade physics rewrite (`server/games/kart.ts`): smoothed steering, yaw rate that falls with speed, lateral grip with slide, drift
  (brake + steer), cornering speed cost, gentler brake, straight-line assist, wall slide. Fixed a road-lookup bug at the figure-eight crossing.
  Tests: `tests/unit/kart-handling.test.ts` (no snap turns/spin, steering ramp, responsiveness, wide arc at speed, braking, drift flag),
  autopilot finishes 2 laps on all 3 tracks; e2e: wheel proportionality / snap back, arrows, tilt with simulated sensor.
  **Not tested on real hardware**: tilt direction/sign on a physical phone (an "invert" switch exists), wheel feel on a real thumb.

## Game checklist (25 requested)
Legend: [x] playable + tested, [ ] not started. A game is only marked playable in `shared/catalog.ts` when it is [x].

### Wave 1
- [ ] Soccer · [ ] Air hockey · [ ] Crazy kitchen · [ ] Family board party · [ ] Trap builders
### Wave 2
- [ ] Basketball · [ ] Bowling · [ ] Boat race · [ ] Bike race · [ ] Vanishing floor
### Wave 3
- [ ] Tank battle · [ ] Wizard duel · [ ] Arena survival · [ ] Base defense · [ ] Tag
### Wave 4
- [ ] Maze escape · [ ] Space rescue · [ ] Treasure evacuation · [ ] Treasure hunt · [ ] Wobbly tower
### Wave 5
- [ ] Space race · [ ] Popping balloons · [ ] Team puzzle · [ ] Draw & guess · [ ] Party trivia

## Library / website improvements (requested)
- [ ] categories filter · [ ] search · [ ] original art per game · [ ] player count + estimated time · [ ] favourites · [ ] transitions · [ ] console-style design

## Known limits
- No real-device testing (no physical phones / Safari / Firefox engines in the sandbox).
- Render free plan: sleeps after 15 min idle, 5 GB/month bandwidth, rooms in memory.
