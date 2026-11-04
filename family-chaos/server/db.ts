// Database access. One small interface, two engines:
//  * DATABASE_URL set  -> PostgreSQL over the network (e.g. a free Neon / Supabase Postgres)  [production]
//  * otherwise         -> PGlite: real Postgres compiled to WASM, inside this process
//                         (persisted to DATA_DIR, default ./data/db; or in memory for tests)
// Players never see or sign up to any of these services — they only use our website.
import { mkdirSync } from 'node:fs';

export interface Db {
  kind: 'postgres' | 'pglite-file' | 'pglite-memory';
  persistent: boolean;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

const SCHEMA = `
create table if not exists users (
  id bigserial primary key,
  email text unique not null,
  pass_hash text not null,
  nickname text not null,
  avatar int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists sessions (
  token_hash text primary key,
  user_id bigint not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists sessions_user on sessions(user_id);
create table if not exists plays (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  game text not null,
  place int not null,
  players int not null,
  stars int not null,
  at timestamptz not null default now()
);
create index if not exists plays_user on plays(user_id, at desc);
create table if not exists tournaments (
  id text primary key,
  owner_user bigint not null references users(id) on delete cascade,
  title text not null,
  mode text not null,
  status text not null default 'active',
  state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tournaments_owner on tournaments(owner_user, updated_at desc);
create table if not exists trophies (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  tournament_id text not null,
  title text not null,
  mode text not null,
  at timestamptz not null default now()
);
create index if not exists trophies_user on trophies(user_id);
alter table users add column if not exists role text not null default 'PLAYER';
`;

/**
 * Returns null when accounts should be OFF: on a small free host (RENDER) without an external database, the in-process
 * Postgres (PGlite, ~450-750 MB of RAM) would exceed the 512 MB limit and get the whole site killed (502).
 * Games never need accounts. Set DATABASE_URL (free Neon Postgres) to turn accounts on there.
 */
export async function openDb(opts: { memory?: boolean } = {}): Promise<Db | null> {
  const url = process.env.DATABASE_URL;
  if (!url && !opts.memory && process.env.RENDER && !process.env.DATA_DIR && process.env.ACCOUNTS_IN_MEMORY !== '1') return null;
  let db: Db;
  if (url && !opts.memory) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30_000 });
    db = {
      kind: 'postgres',
      persistent: true,
      query: async (sql, params) => (await pool.query(sql, params as unknown[])).rows,
      close: () => pool.end(),
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const memory = opts.memory || process.env.DATA_DIR === 'memory' || (!!process.env.RENDER && !process.env.DATA_DIR);
    let pgl: InstanceType<typeof PGlite>;
    if (memory) pgl = new PGlite();
    else {
      const dir = process.env.DATA_DIR ?? './data/db';
      mkdirSync(dir, { recursive: true });
      pgl = new PGlite(dir);
    }
    db = {
      kind: memory ? 'pglite-memory' : 'pglite-file',
      persistent: !memory,
      query: async (sql, params) => (await pgl.query(sql, params as unknown[])).rows as never,
      close: () => pgl.close(),
    };
  }
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
  return db;
}
