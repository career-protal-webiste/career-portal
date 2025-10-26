// lib/db.ts
import { sql } from '@vercel/postgres';

export type JobSource = 'lever' | 'greenhouse';

export type JobUpsertInput = {
  fingerprint: string;
  source: JobSource;
  source_id: string;

  company: string;
  title: string;

  location?: string | null;
  remote?: boolean | null;
  employment_type?: string | null;
  experience_hint?: string | null;
  category?: string | null;

  url: string;

  // Dates can be Date or string; we coerce to ISO
  posted_at?: Date | string | null;
  scraped_at: Date | string;

  description?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;

  // Accept array or string; we will store text (comma-separated)
  visa_tags?: string[] | string | null;
};

function asIso(d?: Date | string | null): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d.toISOString();
}

function asVisaText(v?: string[] | string | null): string | null {
  if (!v) return null;
  return Array.isArray(v) ? (v.length ? v.join(',') : null) : v;
}

/**
 * Create the jobs table if it doesn't exist.
 * Also normalize visa_tags to TEXT for simpler inserts (no array typing issues).
 */
export async function migrate(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id              SERIAL PRIMARY KEY,
      fingerprint     TEXT UNIQUE NOT NULL,
      source          TEXT NOT NULL CHECK (source IN ('lever','greenhouse')),
      source_id       TEXT NOT NULL,

      company         TEXT NOT NULL,
      title           TEXT NOT NULL,

      location        TEXT,
      remote          BOOLEAN,
      employment_type TEXT,
      experience_hint TEXT,
      category        TEXT,

      url             TEXT NOT NULL,

      posted_at       TIMESTAMPTZ,
      scraped_at      TIMESTAMPTZ NOT NULL,

      description     TEXT,
      salary_min      NUMERIC,
      salary_max      NUMERIC,
      currency        TEXT,
      visa_tags       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_company   ON jobs(company);
    CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC NULLS LAST);
  `;

  // If a previous run created visa_tags as TEXT[], quietly convert it to TEXT.
  try {
    await sql`ALTER TABLE jobs
              ALTER COLUMN visa_tags TYPE TEXT
              USING CASE
                     WHEN visa_tags IS NULL THEN NULL
                     ELSE array_to_string(visa_tags, ',')
                   END`;
  } catch (_e) {
    // ignore if it's already TEXT or column doesn't exist yet
  }
}

export async function upsertJob(rec: JobUpsertInput): Promise<void> {
  const posted = asIso(rec.posted_at);
  const scraped = asIso(rec.scraped_at) ?? new Date().toISOString();
  const desc = (rec.description ?? '').slice(0, 1200);
  const visaText = asVisaText(rec.visa_tags);

  await sql`
    INSERT INTO jobs (
      fingerprint, source, source_id,
      company, title, location, remote, employment_type, experience_hint, category,
      url, posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
    )
    VALUES (
      ${rec.fingerprint}, ${rec.source}, ${rec.source_id},
      ${rec.company}, ${rec.title}, ${rec.location ?? null}, ${rec.remote ?? null},
      ${rec.employment_type ?? null}, ${rec.experience_hint ?? null}, ${rec.category ?? null},
      ${rec.url}, ${posted}, ${scraped}, ${desc || null},
      ${rec.salary_min ?? null}, ${rec.salary_max ?? null}, ${rec.currency ?? null}, ${visaText}
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
      posted_at       = EXCLUDED.posted_at,
      scraped_at      = EXCLUDED.scraped_at,
      description     = EXCLUDED.description,
      salary_min      = EXCLUDED.salary_min,
      salary_max      = EXCLUDED.salary_max,
      currency        = EXCLUDED.currency,
      visa_tags       = EXCLUDED.visa_tags;
  `;
}

export type JobRow = {
  id: number;
  company: string;
  title: string;
  location: string | null;
  remote: boolean | null;
  url: string;
  posted_at: string | null;
  scraped_at: string;
  source: JobSource;
  category: string | null;
};

export async function listJobs(limit = 50): Promise<JobRow[]> {
  const { rows } = await sql<JobRow>`
    SELECT id, company, title, location, remote, url, posted_at, scraped_at, source, category
    FROM jobs
    ORDER BY posted_at DESC NULLS LAST, id DESC
    LIMIT ${limit};
  `;
  return rows;
}
