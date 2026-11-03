import { boardRenderer } from './board';
import { bumperRenderer } from './bumper';
import { flagWarsRenderer } from './flagwars';
import { hockeyRenderer } from './hockey';
import { kartRenderer } from './kart';
import { potatoRenderer } from './potato';
import { rushRenderer } from './rush';
import { soccerRenderer } from './soccer';
import { trapBuildersRenderer } from './trapbuilders';
import { vanishRenderer } from './vanish';
import type { Renderer } from './types';

// Register client renderers here (one per playable game id).
export const RENDERERS: Record<string, Renderer> = {
  kart: kartRenderer, rush: rushRenderer, soccer: soccerRenderer, hockey: hockeyRenderer, flagwars: flagWarsRenderer, board: boardRenderer,
  trapbuilders: trapBuildersRenderer, bumper: bumperRenderer, vanish: vanishRenderer, potato: potatoRenderer,
};

const LERP_KEYS = ['x', 'y', 'a'];

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/**
 * Generic snapshot interpolation: arrays of entities with `id` get x/y/a smoothed,
 * plus a top-level `R`. Everything else uses the newest frame.
 */
export function interpolate(prev: any, cur: any, t: number): any {
  if (!prev || t >= 1) return cur;
  const out: any = { ...cur };
  for (const key of Object.keys(cur)) {
    const a = prev[key], b = cur[key];
    if (key === 'R' && typeof a === 'number') out.R = a + (b - a) * t;
    if (!Array.isArray(b) || !Array.isArray(a) || !b.length || typeof b[0] !== 'object' || b[0] === null || !('id' in b[0])) continue;
    const old = new Map(a.map((e: any) => [e.id, e]));
    out[key] = b.map((e: any) => {
      const o: any = old.get(e.id);
      if (!o) return e;
      const n = { ...e };
      for (const k of LERP_KEYS) {
        if (typeof e[k] !== 'number' || typeof o[k] !== 'number') continue;
        if (k === 'a') n.a = lerpAngle(o.a, e.a, t);
        else if (Math.abs(e[k] - o[k]) < 200) n[k] = o[k] + (e[k] - o[k]) * t; // no smoothing across teleports
      }
      return n;
    });
  }
  return out;
}
