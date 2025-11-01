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
