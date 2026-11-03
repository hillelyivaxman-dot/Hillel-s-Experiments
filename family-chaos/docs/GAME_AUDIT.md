# Game audit — what each of the 30 games is, and what makes it different

Method: every game is (1) run to its end by scripted bots at 1/3/8 players (`tests/unit/newgames.test.ts`, `games.test.ts`, …), (2) checked with scripted
"good player" bots that must be able to WIN in the intended way (aim solver for basketball, autopilots for the racers, beam/delivery bot for rescue, …),
(3) driven in two real browser contexts with real touch input on every control (`tests/e2e/games-input.spec.ts`), and (4) looked at in screenshots.
**Nothing here was played by humans or on real phones yet** — balance numbers are first guesses; see "Not verified".

| # | Game | Category | Core mechanic (what you actually do) | Why it is not a copy of another game |
|---|------|----------|---------------------------------------|----------------------------------------|
| 1 | Kart Chaos | Racing | Auto-accelerating kart, steer with two big arrows, brake to drift, items (oil/shield/turbo) from ? boxes, turbo meter | Item combat + drifting |
| 2 | **Boat Racing** | Racing | Heavy, slidey boat; read the river: fast streams on one side (blue), eddies pushing back (orange), rocks, whirlpools; SURGE burst | Environment-reading, no items |
| 3 | **Bike Racing** | Racing | Light grippy bike; HOP over hurdles, ramps launch you, clean hops build a speed combo, straight landings give a boost | Rhythm / obstacle timing, no items |
| 4 | Space Racing | Racing | Ship flies forward on its own through an asteroid field, steer + boost energy, rubber-banding | Vertical auto-scroll, dodging |
| 5 | Chaos Rush | Racing | Side-scrolling platform run: jump pits/spikes/saws, dash, shove rivals | Platforming |
| 6 | Maze Escape | Racing | New random maze each round, fog of war (only the area around runners is lit), race to the door | Navigation under fog |
| 7 | Soccer | Sports | Teams, kick/sprint, golden goal | Team ball game |
| 8 | Air Hockey | Sports | Mallets on a half-court, smash | Reflex duel on a table |
| 9 | **Basketball Chaos** | Sports | Per-player lane with a moving hoop; pull the stick back to aim (dotted arc preview), let go to shoot; real ball physics: rim, backboard, net; swish/streak bonus | Slingshot aiming with physics |
| 10 | Crazy Bowling | Sports | Turn-based: slide the ball, lock, power meter + hook with the stick, chain-reaction pins, strike/spare | Turn-based precision |
| 11 | Tower Stack | Sports | Swinging block, drop timing, overhang is cut, perfect drops keep width | Timing/stacking |
| 12 | Reaction Duel | Party | Wait for green, fastest tap, fake-outs | Pure reflex |
| 13 | Hot Potato | Party | Pass the bomb by touch/throw, elimination | Elimination by passing |
| 14 | Bumper Battle | Party | Shove rivals off a shrinking arena | Physics shoving |
| 15 | Vanishing Floor ("Floor is Lava") | Party | Tiles crack under you and vanish; hop and shove | Survival on a decaying floor |
| 16 | **Freeze Tag** | Party | Asymmetric: freezer(s) vs runners; ice, thaw teammates by standing next to them | Roles + rescue (not hot potato) |
| 17 | Balloon Panic | Party | Push-your-luck: pump (more points) or bank, hidden pop limit | Risk management |
| 18 | Family Board Party | Party | Dice board with stars/coins/duels and tap minigames | Board game |
| 19 | Party Trivia | Brain | 26 bilingual questions, 4 coloured answers, speed + streak | Knowledge |
| 20 | Team Puzzle | Brain | Co-op memory: the sequence flashes, each player owns only some colours | Cooperative memory |
| 21 | Draw & Guess | Brain | One draws with the stick, others tilt toward one of 4 words and lock | Drawing/guessing |
| 22 | Crazy Kitchen | Co-op | Cook & serve orders together; kitchen reshuffles | Co-op logistics |
| 23 | **Zombie Survival** | Co-op | Waves of cartoon zombies (walkers, runners, brutes), slash arc + roll, revive by standing next to a fallen friend, hearts drop | Melee horde defence |
| 24 | Base Defense | Co-op | Shoot enemies heading to a crystal, buy auto-turrets with coins | Tower-defence, ranged |
| 25 | **Space Rescue** | Co-op | Inertial ship, hold a tractor beam to pull drifting astronauts, oxygen timers, rocks | Beam + countdown (not carrying chests) |
| 26 | Treasure Evacuation | Co-op | Carry chests on foot to the exit, guards chase, flood rises | On-foot carry + chase |
| 27 | Tank Battle | Arcade | Cover, bouncing shells, mines, last tank | Elimination with ricochets |
| 28 | **Mage Hill** | Arcade | King-of-the-hill: stand ALONE on a moving hill to score; fireballs knock rivals off; respawn after 3 s | Objective play, not elimination (not tank) |
| 29 | Trap Builders | Arcade | Build traps, then everyone runs through them; traps score | Build-then-race |
| 30 | Treasure Hunt | Arcade | Dig for hidden loot with a hot/cold meter, radar, bombs | Search and risk |

Bold = reworked or newly differentiated in this overhaul. Library categories follow the core mechanic (`CATEGORY_OF` in `shared/catalog.ts`).

## Findings and what was done
| Severity | Finding | Action |
|----------|---------|--------|
| Gameplay | Racing controls awkward (wheel + gas) and boat/bike were reskinned karts | Auto-accelerate + two big arrows (wheel/tilt remain as options); boats and bikes got their own mechanics (above) |
| Gameplay | Basketball: hold-and-release meter felt arbitrary | Rebuilt with aimable physics, preview arc, moving hoops |
| Gameplay | "Arena Survival" had emoji-like monsters and a flat difficulty curve | Rebuilt as Zombie Survival (3 types, caps, spawn rules, hearts, revive) |
| Gameplay | Wizard Duel was Tank Battle with spells | Rebuilt as Mage Hill (objective scoring, respawn) |
| Gameplay | Tag overlapped with Hot Potato | Rebuilt as Freeze Tag (asymmetric roles, thawing) |
| Gameplay | Space Rescue and Treasure Evacuation both "carry things home" | Rescue now beam + oxygen timers + inertial flight |
| Gameplay | Bowling aim/power confusing | Aim -> lock -> power meter + stick hook, preview line |
| Cosmetic | Emoji used as graphics everywhere | One drawn icon set (`shared/icons.ts`) for UI, HUDs and scenes; original SVG card art for the 19 newer games |
| UX | No short how-to on the phone | Intro card on the phone during the countdown |
| UX | Admin unclear | `/admin` setup page + management panel (see PROGRESS.md) |

## Not verified
* No real phones, no Safari/Firefox, no human play-testing: feel, difficulty and fun are unproven.
* Zombie/Mage Hill/Freeze Tag balance numbers are untested by people.
* Sound is still the shared synthesized set (muteable); game-specific sounds are minimal.
