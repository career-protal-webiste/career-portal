// lib/db.ts
import { sql } from '@vercel/postgres';

/**
 * Creates the jobs table (and indexes) if it does not exist.
 * Safe to call on every request.
 */
export async function ensureSchema() {
  await sql/* sql */`
    CREATE TABLE IF NOT EXISTS jobs (
      fingerprint TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT,
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT,
      remote BOOLEAN,
      employment_type TEXT,
      experience_hint TEXT,
      category TEXT,
      url TEXT NOT NULL,
      posted_at TIMESTAMPTZ,
      scraped_at TIMESTAMPTZ NOT NULL,
      description TEXT,
      salary_min NUMERIC,
      salary_max NUMERIC,
      currency TEXT,
      visa_tags TEXT[]
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC NULLS LAST);
    CREATE INDEX IF NOT EXISTS idx_jobs_category  ON jobs (category);
  `;
}

export type JobRow = {
  fingerprint: string;
  source: string;
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
  scraped_at: Date;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  visa_tags: string[] | null;
};

export async function getJobs(limit = 50): Promise<JobRow[]> {
  const { rows } = await sql<JobRow>`
    SELECT *
    FROM jobs
    ORDER BY posted_at DESC NULLS LAST, scraped_at DESC
    LIMIT ${limit};
  `;
  return rows;
}

/**
 * Insert or update a job by fingerprint.
 * Pass only known columns from the table above.
 */
export async function upsertJob(job: Partial<JobRow> & Pick<JobRow,
  'fingerprint' | 'source' | 'company' | 'title' | 'url' | 'scraped_at'
>) {
  const {
    fingerprint,
    source,
    source_id = null,
    company,
    title,
    location = null,
    remote = null,
    employment_type = null,
    experience_hint = null,
    category = null,
    url,
    posted_at = null,
    scraped_at,
    description = null,
    salary_min = null,
    salary_max = null,
    currency = null,
    visa_tags = null,
  } = job;

  await sql/* sql */`
    INSERT INTO jobs (
      fingerprint, source, source_id, company, title, location, remote,
      employment_type, experience_hint, category, url, posted_at, scraped_at,
      description, salary_min, salary_max, currency, visa_tags
    ) VALUES (
      ${fingerprint}, ${source}, ${source_id}, ${company}, ${title}, ${location}, ${remote},
      ${employment_type}, ${experience_hint}, ${category}, ${url}, ${posted_at}, ${scraped_at},
      ${description}, ${salary_min}, ${salary_max}, ${currency}, ${visa_tags}
    )
    ON CONFLICT (fingerprint)
    DO UPDATE SET
      source_id = EXCLUDED.source_id,
      company = EXCLUDED.company,
      title = EXCLUDED.title,
      location = EXCLUDED.location,
      remote = EXCLUDED.remote,
      employment_type = EXCLUDED.employment_type,
      experience_hint = EXCLUDED.experience_hint,
      category = EXCLUDED.category,
      url = EXCLUDED.url,
      posted_at = COALESCE(EXCLUDED.posted_at, jobs.posted_at),
      scraped_at = EXCLUDED.scraped_at,
      description = EXCLUDED.description,
      salary_min = EXCLUDED.salary_min,
      salary_max = EXCLUDED.salary_max,
      currency = EXCLUDED.currency,
      visa_tags = EXCLUDED.visa_tags;
  `;
}
