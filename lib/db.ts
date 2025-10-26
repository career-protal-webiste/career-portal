// lib/db.ts
import { sql } from '@vercel/postgres';

/** Shape we insert/upsert into the jobs table */
export type JobRecord = {
  fingerprint: string;
  source: 'lever' | 'greenhouse' | string;
  source_id: string | null;

  company: string;
  title: string;

  location?: string | null;
  remote?: boolean | null;
  employment_type?: string | null;
  experience_hint?: string | null;
  category?: string | null;

  url: string;

  posted_at?: string | Date | null;   // we will normalize to ISO string
  scraped_at?: string | Date | null;  // we will normalize to ISO string

  description?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  visa_tags?: string[] | null;        // stored as text[] in PG
};

/** Create the jobs table and indexes (idempotent). Run once via /api/migrate */
export async function migrate() {
  // 1) table
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      fingerprint     text PRIMARY KEY,
      source          text NOT NULL,
      source_id       text,
      company         text NOT NULL,
      title           text NOT NULL,
      location        text,
      remote          boolean,
      employment_type text,
      experience_hint text,
      category        text,
      url             text NOT NULL,
      posted_at       timestamptz,
      scraped_at      timestamptz NOT NULL,
      description     text,
      salary_min      numeric,
      salary_max      numeric,
      currency        text,
      visa_tags       text[]
    );
  `;

  // 2) helpful indexes (each statement must be called separately)
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_company   ON jobs (company);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC NULLS LAST);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_source    ON jobs (source, source_id);`;
}

/** Insert or update a job row by fingerprint (idempotent). */
export async function upsertJob(rec: JobRecord) {
  // Normalize dates to ISO strings so PG can cast to timestamptz
  const posted =
    rec.posted_at ? new Date(rec.posted_at as any).toISOString() : null;
  const scraped =
    rec.scraped_at
      ? new Date(rec.scraped_at as any).toISOString()
      : new Date().toISOString();

  // Turn visa_tags into a Postgres array (or null)
  const visaArray =
    rec.visa_tags && rec.visa_tags.length > 0 ? sql.array(rec.visa_tags) : null;

  const desc = rec.description ?? null;

  await sql`
    INSERT INTO jobs (
      fingerprint, source, source_id,
      company, title, location, remote, employment_type,
      experience_hint, category, url, posted_at, scraped_at,
      description, salary_min, salary_max, currency, visa_tags
    )
    VALUES (
      ${rec.fingerprint}, ${rec.source}, ${rec.source_id ?? null},
      ${rec.company}, ${rec.title}, ${rec.location ?? null}, ${rec.remote ?? null}, ${rec.employment_type ?? null},
      ${rec.experience_hint ?? null}, ${rec.category ?? null}, ${rec.url}, ${posted}, ${scraped},
      ${desc}, ${rec.salary_min ?? null}, ${rec.salary_max ?? null}, ${rec.currency ?? null}, ${visaArray}
    )
    ON CONFLICT (fingerprint) DO UPDATE SET
      source          = EXCLUDED.source,
      source_id       = EXCLUDED.source_id,
      company         = EXCLUDED.company,
      title           = EXCLUDED.title,
      location        = EXCLUDED.location,
      remote          = EXCLUDED.remote,
      employment_type = EXCLUDED.employment_type,
      experience_hint = EXCLUDED.experience_hint,
      category        = EXCLUDED.category,
      url             = EXCLUDED.url,
      posted_at       = COALESCE(EXCLUDED.posted_at, jobs.posted_at),
      scraped_at      = EXCLUDED.scraped_at,
      description     = EXCLUDED.description,
      salary_min      = EXCLUDED.salary_min,
      salary_max      = EXCLUDED.salary_max,
      currency        = EXCLUDED.currency,
      visa_tags       = EXCLUDED.visa_tags;
  `;
}
