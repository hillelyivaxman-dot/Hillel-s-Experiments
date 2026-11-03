import { useCallback, useEffect, useState } from 'react';

export interface Me {
  signedIn: boolean;
  persistent: boolean;
  user?: { nickname: string; avatar: number; email: string; role?: string };
  stats?: { games: number; wins: number; stars: number; perGame: Record<string, { plays: number; wins: number }> };
  achievements?: { id: string; done: boolean }[];
  favorites?: string[];
  history?: { game: string; place: number; players: number; stars: number; at: string }[];
}

/** Calls our own account API (same origin, session in an HttpOnly cookie). */
export async function api(path: string, body?: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
  try {
    const r = await fetch(path, body === undefined
      ? { credentials: 'same-origin' }
      : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, data } : { ok: false, error: data.error ?? 'generic' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

export function useMe(): [Me | null, () => void] {
  const [me, setMe] = useState<Me | null>(null);
  const load = useCallback(() => {
    api('/api/me').then((r) => setMe(r.ok ? r.data : { signedIn: false, persistent: false }));
  }, []);
  useEffect(load, [load]);
  return [me, load];
}
