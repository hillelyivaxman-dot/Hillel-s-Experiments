# FAMILY CHAOS design system v3 — "sticker-book arcade"

**Idea.** Every object looks like a die-cut vinyl sticker on a night-purple board: flat saturated colour, a thick ink outline, a hard unblurred drop edge, one halftone highlight. No glassy panels, no soft gradient washes. Source of truth: `client/src/design.css` (tokens at the top).

| Token | Value | Use |
|---|---|---|
| ink | `#140b2e` | outlines, hard shadows, text on bright fills |
| board / board-2 | `#231552` / `#2d1b66` | panels, tiles behind content |
| sun | `#ffd23f` | focus ring, selected, money, room-code keys |
| tomato / sky | `#ff4d6d` / `#3ec1ff` | primary action + red team / secondary action + blue team |
| mint / grape | `#5dfc8d` / `#8b5cf6` | ready, success / accents |

**Type.** Secular One (Hebrew + Latin display) for headings, buttons, names and scores; Rubik for reading text. Sentence case, no all-caps labels. Scale: 0.85 / 1 / 1.3 / 1.9 / clamp(3.6rem, 12vw, 8.5rem) for the logo.

**Components.** Buttons are sticker keys (3px ink outline, 7px hard shadow, press = sink). Chips are ink-outlined pills (selected = sun). Game tiles are die-cut cards: flat accent colour + skewed second colour + halftone dots, white sticker outline around the art, name stroked in ink, selected tile lifts and wobbles (the only idle motion besides the logo). Panels use `--edge` ink border + `0 8px 0 ink`. Icons: one drawn set (`shared/icons.ts`) in the same outline style; characters are the procedural critters (`render/critter.ts`).

**HUD.** Pills with ink outline and tabular numbers; scores in Secular One; team colours always tomato / sky.

**Motion.** GSAP for entrances and phase transitions (lobby ⇄ game ⇄ results, 0.35 s), CSS for presses. Everything respects `prefers-reduced-motion` / the in-app "Animations" switch.

**Input.** The host lobby is playable with a TV remote / keyboard / gamepad: arrows move over the ten tiles, Enter / A starts; focus ring is always visible (4px sun).

**Layout rules.** TV (1920x1080) and laptop (1280x720): everything important in one screen, ten games visible at once (5x2). Phones: landscape first; controls never under the notch; Kart Chaos shows its own 3D view behind translucent controls.
