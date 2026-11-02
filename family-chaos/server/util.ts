import { randomBytes, timingSafeEqual } from 'node:crypto';
import { NAME_MAX } from '../shared/protocol';

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const r1 = (v: number) => Math.round(v * 10) / 10;

export function token(bytes = 18): string {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Deterministic PRNG (mulberry32) so games can be replayed/tested. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Token bucket rate limiter. */
export class Bucket {
  private tokens: number;
  private last = -1;
  constructor(private rate: number, private burst: number) {
    this.tokens = burst;
  }
  take(n = 1, now = Date.now()): boolean {
    if (this.last < 0) this.last = now;
    this.tokens = Math.min(this.burst, this.tokens + (Math.max(0, now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

// Small blocklist (EN + HE). Not exhaustive: reporting + host kick cover the rest.
const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'nigg', 'fag', 'whore', 'slut', 'rape', 'nazi', 'hitler',
  'זונה', 'שרמוטה', 'כוס', 'זין', 'מניאק', 'בן זונה', 'הומו', 'קוקסינל', 'נאצי', 'היטלר', 'מזדיין',
];

export function isOffensive(name: string): boolean {
  const n = name.toLowerCase().replace(/[\s._\-*0-9]/g, '');
  return BLOCKED.some((w) => n.includes(w.replace(/\s/g, '')));
}

/** Normalises a display name. Returns null when unusable. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // strip control chars, bidi overrides and zero-width chars
  const s = raw
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
  if (!s || isOffensive(s)) return null;
  return s;
}
