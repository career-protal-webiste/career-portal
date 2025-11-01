// lib/db.ts
import { createPool } from '@vercel/postgres';

export const pool = createPool({
  connectionString: process.env.DATABASE_URL,
});

// Use the tagged template everywhere: sql`SELECT ...`
export const sql = pool.sql;

export type JobInsert = {
  fingerprint: string;
  source: 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'recruitee' | 'smartrecruiters' | 'workday';
  source_id: string | null;
  company: string;
  title: string;
  location: string | null;
  remote: boolean;
  employment_type: string | null;
  experience_hint: string | null;
  category: string | null;
  url: string;
  posted_at: string | null;         // ISO string or null
  scraped_at: string;               // ISO string (NOW at fetch)
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  visa_tags: string | null;
};

/**
 * Insert or update a job row based on a stable unique fingerprint.
 * Keeps posted_at if new is null; always refreshes scraped_at/title/url/etc.
 */
export async function upsertJob(j: JobInsert): Promise<void> {
  await sql`
    INSERT INTO jobs (
      fingerprint, source, source_id, company, title, location, remote,
      employment_type, experience_hint, category, url, posted_at, scraped_at,
      description, salary_min, salary_max, currency, visa_tags
    )
    VALUES (
      ${j.fingerprint}, ${j.source}, ${j.source_id}, ${j.company}, ${j.title}, ${j.location}, ${j.remote},
      ${j.employment_type}, ${j.experience_hint}, ${j.category}, ${j.url}, ${j.posted_at}, ${j.scraped_at},
      ${j.description}, ${j.salary_min}, ${j.salary_max}, ${j.currency}, ${j.visa_tags}
    )
    ON CONFLICT (fingerprint) DO UPDATE SET
      source_id       = COALESCE(EXCLUDED.source_id, jobs.source_id),
      title           = EXCLUDED.title,
      location        = EXCLUDED.location,
      remote          = EXCLUDED.remote,
      employment_type = EXCLUDED.employment_type,
      experience_hint = EXCLUDED.experience_hint,
      category        = EXCLUDED.category,
      url             = EXCLUDED.url,
      posted_at       = COALESCE(EXCLUDED.posted_at, jobs.posted_at),
      scraped_at      = EXCLUDED.scraped_at,
      description     = COALESCE(EXCLUDED.description, jobs.description),
      salary_min      = COALESCE(EXCLUDED.salary_min, jobs.salary_min),
      salary_max      = COALESCE(EXCLUDED.salary_max, jobs.salary_max),
      currency        = COALESCE(EXCLUDED.currency, jobs.currency),
      visa_tags       = COALESCE(EXCLUDED.visa_tags, jobs.visa_tags)
  `;
}

/**
 * Creates required tables and indexes if they don't exist.
 * Safe to run repeatedly.
 */
export async function migrate(): Promise<void> {
  // jobs table
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      fingerprint      TEXT PRIMARY KEY,
      source           TEXT NOT NULL,                 -- greenhouse | lever | ashby | workable | recruitee | smartrecruiters | workday
      source_id        TEXT,
      company          TEXT NOT NULL,
      title            TEXT NOT NULL,
      location         TEXT,
      remote           BOOLEAN NOT NULL DEFAULT false,
      employment_type  TEXT,
      experience_hint  TEXT,
      category         TEXT,
      url              TEXT NOT NULL,
      posted_at        TIMESTAMPTZ,
      scraped_at       TIMESTAMPTZ NOT NULL,
      description      TEXT,
      salary_min       INTEGER,
      salary_max       INTEGER,
      currency         TEXT,
      visa_tags        TEXT
    );
  `;

  // helpful indexes for feeds/filters
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC NULLS LAST);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_company   ON jobs (company);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_source    ON jobs (source);`;

  // ats_sources table (company → ATS token)
  await sql`
    CREATE TABLE IF NOT EXISTS ats_sources (
      id           SERIAL PRIMARY KEY,
      type         TEXT NOT NULL,      -- same set as jobs.source
      token        TEXT NOT NULL,
      company_name TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (type, token)
    );
  `;

  // cron_heartbeats table (ingestion monitoring)
  await sql`
    CREATE TABLE IF NOT EXISTS cron_heartbeats (
      id       SERIAL PRIMARY KEY,
      source   TEXT NOT NULL,          -- same set as jobs.source
      ran_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fetched  INTEGER,
      inserted INTEGER
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_cron_source_time ON cron_heartbeats (source, ran_at DESC);`;
}
