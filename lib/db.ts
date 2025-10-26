// lib/db.ts
import { sql } from '@vercel/postgres';

/**
 * Shape we store in the database.
 * Dates are accepted here, but we'll convert them to ISO strings
 * before sending to SQL so TypeScript doesn't complain.
 */
export type JobRecord = {
  fingerprint: string;
  source: 'lever' | 'greenhouse';
  source_id: string;

  company: string;
  title: string;

  location?: string | null;
  remote?: boolean | null;
  employment_type?: string | null;
  experience_hint?: string | null;
  category?: string | null;
  url?: string | null;

  posted_at?: Date | string | null;
  scraped_at?: Date | string | null;

  description?: string | null;

  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;

  // store tags as JSON text
  visa_tags?: string[] | null;
};

function toISO(val?: Date | string | null): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  try {
    return val.toISOString();
  } catch {
    return null;
  }
}

/**
 * One-time table setup. Safe to call multiple times.
 */
export async function migrate() {
  await sql/* sql */`
    CREATE TABLE IF NOT EXISTS jobs (
      fingerprint TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,

      company TEXT NOT NULL,
      title TEXT NOT NULL,

      location TEXT,
      remote BOOLEAN,
      employment_type TEXT,
      experience_hint TEXT,
      category TEXT,
      url TEXT,

      posted_at TIMESTAMPTZ,
      scraped_at TIMESTAMPTZ,

      description TEXT,

      salary_min NUMERIC,
      salary_max NUMERIC,
      currency TEXT,

      visa_tags TEXT
    );
  `;

  // helpful index for recent lists
  await sql/* sql */`
    CREATE INDEX IF NOT EXISTS jobs_scraped_at_idx ON jobs (scraped_at DESC);
  `;
}

/**
 * Insert or update by fingerprint.
 */
export async function upsertJob(rec: JobRecord) {
  // Make sure table exists (cheap if it already does)
  await migrate();

  const postedISO = toISO(rec.posted_at);
  const scrapedISO = toISO(rec.scraped_at);

  const visaTagsText =
    rec.visa_tags && rec.visa_tags.length > 0 ? JSON.stringify(rec.visa_tags) : null;

  await sql/* sql */`
    INSERT INTO jobs (
      fingerprint, source, source_id,
      company, title,
      location, remote, employment_type, experience_hint, category, url,
      posted_at, scraped_at,
      description,
      salary_min, salary_max, currency,
      visa_tags
    )
    VALUES (
      ${rec.fingerprint}, ${rec.source}, ${rec.source_id},
      ${rec.company}, ${rec.title},
      ${rec.location ?? null}, ${rec.remote ?? null}, ${rec.employment_type ?? null},
      ${rec.experience_hint ?? null}, ${rec.category ?? null}, ${rec.url ?? null},
      ${postedISO}, ${scrapedISO},
      ${rec.description ?? null},
      ${rec.salary_min ?? null}, ${rec.salary_max ?? null}, ${rec.currency ?? null},
      ${visaTagsText}
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
      visa_tags       = EXCLUDED.visa_tags
  `;
}

/**
 * Fetch recent jobs for the homepage.
 */
export async function getRecentJobs(limit = 50) {
  await migrate();
  const { rows } = await sql/* sql */`
    SELECT
      fingerprint, source, source_id,
      company, title, location, remote, employment_type,
      experience_hint, category, url,
      posted_at, scraped_at, description,
      salary_min, salary_max, currency, visa_tags
    FROM jobs
    ORDER BY scraped_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  // Parse visa_tags back from JSON text if present
  return rows.map((r: any) => ({
    ...r,
    visa_tags: r.visa_tags ? JSON.parse(r.visa_tags) : null,
  }));
}
