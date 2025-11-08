import { sql as vercelSql } from '@vercel/postgres';

// Re-export the sql tagged template from @vercel/postgres. This automatically
// picks up your configured database URL from Vercel environment variables
// (POSTGRES_URL, DATABASE_URL, etc.) without manually creating a pool.
export const sql = vercelSql;

/**
 * Run database migrations to ensure necessary tables and indexes exist.
 * Invoke this via the `/api/migrate` route after deploying, and whenever you
 * make schema changes. The jobs table stores a de-duplicated feed of jobs,
 * the ats_sources table stores tenant information for ATS boards, and
 * cron_heartbeats tracks ingestion runs for monitoring.
 */
export async function migrate() {
  // Jobs table: keyed by fingerprint to avoid duplicates. Minimal columns
  // allow ingestion from multiple sources with varying fields.
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS jobs (
      fingerprint       text PRIMARY KEY,
      source            text,
      source_id         text,
      company           text,
      title             text,
      location          text,
      remote            text,
      employment_type   text,
      experience_hint   text,
      category          text,
      url               text,
      posted_at         timestamptz,
      created_at        timestamptz DEFAULT NOW(),
      updated_at        timestamptz DEFAULT NOW()
    );
  `;
  // Indexes speed up common queries (e.g. sorting by posting date or searching by company/title)
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC);`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs ((lower(coalesce(company,''))));`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_jobs_title ON jobs ((lower(coalesce(title,''))));`;

  // ATS sources table: each row represents a tenant on an ATS provider. Useful for bulk
  // ingestion of jobs from Greenhouse, Lever, Ashby, etc.
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

  // Cron heartbeats table: track when each ingestion job ran, and how many items
  // were fetched and inserted. This powers the /cron-status dashboard.
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

// Define the shape of a job record accepted by upsertJob(). All fields are optional
// except for the fingerprint (the unique key).
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

/**
 * Insert or update a job in the database. If a row with the same fingerprint
 * already exists, update its fields and bump updated_at. Remote values are
 * stored as 'true' or 'false' strings for simplicity when querying.
 */
export async function upsertJob(j: UpsertJobInput) {
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

/**
 * Record a cron heartbeat. This should be called at the end of a cron handler
 * with the total number of items fetched and inserted. The dashboard uses
 * these rows to compute freshness and volume.
 */
export async function recordHeartbeat(source: string, fetched: number, inserted: number) {
  await sql/*sql*/`
    INSERT INTO cron_heartbeats (source, fetched, inserted)
    VALUES (${source}, ${fetched}, ${inserted});
  `;
}
