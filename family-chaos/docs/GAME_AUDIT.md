# Game audit — the ten games of FAMILY CHAOS 3.0

The earlier 30-game library was cut to exactly ten games. The other twenty (and Crazy Kitchen, bowling, boats/bikes as modes)
are **not deleted**: their code is on the git branch `backup/pre-3.0-422a138`.

| # | Game | Players | Controller | What makes it different | Status |
|---|------|---------|------------|-------------------------|--------|
| 1 | **Kart Chaos** | 1–8 | wheel / arrows / tilt, gas·brake·turbo·item (manual gas option) | Each phone renders its own **3D world** (Three.js): cockpit / bumper / chase camera, mini-map, speedometer, lap, rank. Host screen = spectator with leader tracking, car switcher, podium. Server-authoritative, phone frames at 20 Hz with interpolation + dead-reckoning. | 3D verified by headless-Chromium screenshots (software WebGL) and e2e; **not tried on a physical phone** |
| 2 | **Chaos Rush** | 2–8 | stick + jump / dash / shove | Obstacle-course race with a shared screen; shove and dash decide who reaches the end first. | works; polish pending (tracks, camera) |
| 3 | **Mini Soccer** | 2–8 | stick + sprint / kick / **pass** | Real ball physics, goals, teams for small groups, pass button. | works |
| 4 | **Air Hockey** | 2–4 | stick **or touchpad** (finger = mallet position) | Puck physics; the touchpad mode moves the mallet to the finger (absolute target). | works |
| 5 | **Flag Wars** | 2–8 | stick + jump / sprint / tackle / power | Two teams, capture the enemy flag and bring it home, tackle carriers, original symmetric map with walls, bases and bushes, class powers, overtime, small-team handicap. | rules, map, bots and unit tests done |
| 6 | **Family Board Party** | 2–8 | tap | Board with dice and tile effects. | works; interactivity/mini-games pending |
| 7 | **Trap Builders** | 2–8 | stick + place / trigger | Build phase then run phase. | works; flow polish pending |
| 8 | **Bumper Battle** | 2–8 | stick + dash | Sumo-style pushing on a shrinking arena. | works |
| 9 | **Floor Is Lava** | 2–8 | stick + jump | Platforms sink into lava. | works |
| 10 | **Hot Potato** | 3–8 | stick + pass | Pass the bomb before it blows; small groups get fewer fuses. | works |

## What is verified, what is not
* Unit tests (vitest): every game module builds, runs with bots, ends, gives standings; Flag Wars rules; tournaments (party / knockout / league / multi-day, persistence + resume with PGlite); GOD powers + chaos mode; Kart handling.
* Browser tests (Playwright, Chromium, CDP touch emulation): see PROGRESS.md for the latest result.
* **Never tested on a physical phone or on the live Render site** (not reachable from the dev sandbox). The Galaxy S25 Ultra check is a viewport/touch emulation only.

## Known gaps (honest list)
* Original per-game sound: only the shared sound set exists.
* Tournaments: no team tournaments yet; prizes are trophies only (no cosmetic unlocks).
* Chaos powers per game exist for Bumper, Floor Is Lava, Hot Potato, Flag Wars; the other six games only get the cosmetic powers.
