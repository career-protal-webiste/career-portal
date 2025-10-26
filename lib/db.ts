// lib/db.ts
import { sql } from '@vercel/postgres';

export type JobRecord = {
  fingerprint: string;         // unique per company+title+location+url
  source: 'lever' | 'greenhouse';
  source_id: string | null;
  company: string;
  title: string;
  location: string | null;
  remote: boolean | null;
  employment_type: string | null;
  experience_hint: string | null;
  category: string | null;
  url: string;
  posted_at: Date | null;
  scraped_at: Date | null;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  visa_tags: string[] | null;
};

export async function ensureSchema() {
  // Create table + indexes if they don't exist
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id             BIGSERIAL PRIMARY KEY,
      fingerprint    TEXT NOT NULL UNIQUE,
      source         TEXT NOT NULL,
      source_id      TEXT,
      company        TEXT NOT NULL,
      title          TEXT NOT NULL,
      location       TEXT,
      remote         BOOLEAN,
      employment_type TEXT,
      experience_hint TEXT,
      category       TEXT,
      url            TEXT NOT NULL,
      posted_at      TIMESTAMPTZ,
      scraped_at     TIMESTAMPTZ DEFAULT NOW(),
      description    TEXT,
      salary_min     INTEGER,
      salary_max     INTEGER,
      currency       TEXT,
      visa_tags      TEXT[]
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_fingerprint ON jobs(fingerprint);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC NULLS LAST, scraped_at DESC);`;
}

export async function upsertJob(rec: JobRecord) {
  await ensureSchema();
  await sql`
    INSERT INTO jobs (
      fingerprint, source, source_id, company, title, location, remote,
      employment_type, experience_hint, category, url, posted_at, scraped_at,
      description, salary_min, salary_max, currency, visa_tags
    ) VALUES (
      ${rec.fingerprint}, ${rec.source}, ${rec.source_id}, ${rec.company}, ${rec.title},
      ${rec.location}, ${rec.remote}, ${rec.employment_type}, ${rec.experience_hint},
      ${rec.category}, ${rec.url}, ${rec.posted_at}, ${rec.scraped_at},
      ${rec.description}, ${rec.salary_min}, ${rec.salary_max}, ${rec.currency}, ${rec.visa_tags}
    )
    ON CONFLICT (fingerprint) DO UPDATE SET
      source_id       = EXCLUDED.source_id,
      location        = EXCLUDED.location,
      remote          = EXCLUDED.remote,
      employment_type = EXCLUDED.employment_type,
      experience_hint = EXCLUDED.experience_hint,
      category        = EXCLUDED.category,
      url             = EXCLUDED.url,
      posted_at       = COALESCE(EXCLUDED.posted_at, jobs.posted_at),
      scraped_at      = COALESCE(EXCLUDED.scraped_at, jobs.scraped_at),
      description     = COALESCE(EXCLUDED.description, jobs.description),
      salary_min      = COALESCE(EXCLUDED.salary_min, jobs.salary_min),
      salary_max      = COALESCE(EXCLUDED.salary_max, jobs.salary_max),
      currency        = COALESCE(EXCLUDED.currency, jobs.currency),
      visa_tags       = COALESCE(EXCLUDED.visa_tags, jobs.visa_tags);
  `;
}

export async function getLatestJobs(limit = 50) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT *
    FROM jobs
    ORDER BY posted_at DESC NULLS LAST, scraped_at DESC
    LIMIT ${limit};
  `;
  return rows as JobRecord[];
}
