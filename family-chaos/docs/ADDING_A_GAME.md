# Adding a game

A game = **one server module** (rules + simulation) + **one client renderer** (drawing) + **one catalog entry** (metadata + phone controller layout).
Lobby, QR, joining, reconnects, pause/end, scoring (stars), results screen and phone UI are provided by the platform — you don't touch them.

## 1. Catalog entry — `shared/catalog.ts`

```ts
{
  id: 'coins',
  name: { he: 'תפוס מטבעות', en: 'Coin Grab' },
  tagline: { he: '…', en: '…' },
  howTo: { he: '…', en: '…' },          // shown on the countdown screen
  category: 'arcade', minPlayers: 2, maxPlayers: 8, status: 'playable',
  accent: ['#fbbf24', '#b45309'],       // card gradient
  controller: { kind: 'stick', buttons: [{ key: 'A', label: { he: 'צפצוף', en: 'HONK' }, color: '#ffd23f', big: true }] },
  options: [{ key: 'time', label: { he: 'זמן', en: 'Time' }, values: [30, 45, 60], default: 45 }],
}
```

Controller layouts: `stick` (joystick + 1–4 buttons A–D), `tap` (one giant button), `choices` (2–4 colored buttons).

## 2. Server module — `server/games/<id>.ts`

Copy `server/games/_template.ts`. The `GameContext` (see `server/games/types.ts`) gives you:

| API | What it does |
| --- | --- |
| `ctx.players` | participants (id, name, color, avatar) |
| `ctx.options` | validated option values |
| `ctx.input(id)` | latest stick `x,y` (-1..1) and held buttons bitmask `b` |
| `onPress(id, BTN.A, at)` | button rising edge with server arrival time |
| `ctx.rand()` | seeded RNG (tests are deterministic) |
| `ctx.fx(kind, data)` | event for the screen (sound/particles) |
| `ctx.hud(id, {...})` | small per-player status on that phone |
| `ctx.buzz(id, ms)` | vibrate that phone |
| `ctx.rtt(id)`, `ctx.hostRtt()` | latency estimates (for fair timing) |

Implement `tick(dt)`, `snapshot()`, `isOver()`, `standings()`. **Never trust the phone for scores** — phones only send stick/buttons.
Register the module in `server/games/index.ts`.

## 3. Renderer — `client/src/render/<id>.ts`

Implement `Renderer` (`client/src/render/types.ts`): `world` (coordinate box that is fitted to the screen), `background`, `draw(g, snapshot, info)`, optional `hud` and `event`.
Use `drawCritter` / `nameTag` for players and `info.fx` for particles, floating text and screen shake. Entities in arrays with an `id` and `x/y/a` fields are interpolated automatically.
Register it in `client/src/render/index.ts`. Optionally add an icon in `GameIcon` (`client/src/ui/common.tsx`) and a phone HUD line in `hudLine` (`client/src/pages/Join.tsx`).

## 4. Tests

Add a headless test in `tests/unit/games.test.ts` using `runGame(module, players, options, bot)` with a scripted bot that proves the game can be won and ends. `npm run check` must stay green — the catalog test fails if a playable game has no module.
