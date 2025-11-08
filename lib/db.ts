// lib/db.ts
import { createPool } from '@vercel/postgres';

function getConnString(): string {
  const c =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRESQL_URL ||
    '';
  if (!c) throw new Error('No DATABASE_URL configured.');
  return c;
}

export const pool = createPool({ connectionString: getConnString() });
export const sql = pool.sql;

/** Run once at deploy or via /api/migrate */
export async function migrate() {
  // Core jobs table
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS jobs (
      fingerprint         text PRIMARY KEY,
      source              text,
      source_id           text,
      company             text,
      title               text,
      location            text,
      remote              text,
      employment_type     text,
      experience_hint     text,
      category            text,
      url                 text,
      posted_at           timestamptz,
      created_at          timestamptz DEFAULT NOW(),
      updated_at          timestamptz DEFAULT NOW()
    );
  `;

  // Helpful indexes
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC);`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs ((lower(coalesce(company,''))));`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_jobs_title   ON jobs ((lower(coalesce(title,''))));`;

  // ATS tenant sources
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS ats_sources (
      id            serial PRIMARY KEY,
      type          text NOT NULL,
      token         text NOT NULL,
      company_name  text NOT NULL,
      created_at    timestamptz DEFAULT NOW(),
      updated_at    timestamptz DEFAULT NOW(),
      UNIQUE (type, token)
    );
  `;

  // Cron heartbeat metrics
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS cron_heartbeats (
      id        serial PRIMARY KEY,
      source    text NOT NULL,
      ran_at    timestamptz NOT NULL DEFAULT NOW(),
      fetched   int,
      inserted  int
    );
  `;
}

export type UpsertJobInput = {
  fingerprint: string;
  source?: string | null;
  source_id?: string | null;
  company?: string | null;
  title?: string | null;
  location?: string | null;
  remote?: boolean | string | null;
  employment_type?: string | null;
  experience_hint?: string | null;
  category?: string | null;
  url?: string | null;
  posted_at?: string | null; // ISO string preferred
};

export async function upsertJob(j: UpsertJobInput) {
  // Convert posted_at to ISO string (Primitive) for @vercel/postgres
  const postedIso = j.posted_at ? new Date(j.posted_at).toISOString() : null;
  const remoteText =
    typeof j.remote === 'boolean' ? String(j.remote) : (j.remote ?? null);

  await sql/*sql*/`
    INSERT INTO jobs
      (fingerprint, source, source_id, company, title, location, remote, employment_type, experience_hint, category, url, posted_at, created_at, updated_at)
    VALUES
      (
        ${j.fingerprint},
        ${j.source ?? null},
        ${j.source_id ?? null},
        ${j.company ?? null},
        ${j.title ?? null},
        ${j.location ?? null},
        ${remoteText},
        ${j.employment_type ?? null},
        ${j.experience_hint ?? null},
        ${j.category ?? null},
        ${j.url ?? null},
        ${postedIso},
        NOW(), NOW()
      )
    ON CONFLICT (fingerprint) DO UPDATE SET
      source            = EXCLUDED.source,
      source_id         = EXCLUDED.source_id,
      company           = EXCLUDED.company,
      title             = EXCLUDED.title,
      location          = EXCLUDED.location,
      remote            = EXCLUDED.remote,
      employment_type   = EXCLUDED.employment_type,
      experience_hint   = EXCLUDED.experience_hint,
      category          = EXCLUDED.category,
      url               = EXCLUDED.url,
      posted_at         = EXCLUDED.posted_at,
      updated_at        = NOW();
  `;
}

export async function recordHeartbeat(source: string, fetched: number, inserted: number) {
  await sql/*sql*/`
    INSERT INTO cron_heartbeats (source, fetched, inserted)
    VALUES (${source}, ${fetched}, ${inserted});
  `;
}
