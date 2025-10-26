// lib/queries.ts
import { sql } from '@vercel/postgres';

export type JobRow = {
  fingerprint: string;
  source: string | null;
  source_id: string | null;
  company: string | null;
  title: string | null;
  location: string | null;
  remote: string | boolean | null;
  employment_type: string | null;
  experience_hint: string | null;
  category: string | null;
  url: string;
  posted_at: string | null;     // ISO string in UTC
  scraped_at: string | null;    // ISO string in UTC
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  visa_tags: string[] | null;
};

export async function listJobs(limit = 200): Promise<JobRow[]> {
  // Return ISO strings to avoid Date typing issues in the build
  const { rows } = await sql<JobRow>`
    SELECT
      fingerprint, source, source_id, company, title, location, remote,
      employment_type, experience_hint, category, url,
      to_char(posted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')  AS posted_at,
      to_char(scraped_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS scraped_at,
      description, salary_min, salary_max, currency, visa_tags
    FROM jobs
    ORDER BY posted_at DESC NULLS LAST
    LIMIT ${limit};
  `;
  return rows;
}

export async function getJobByFingerprint(fingerprint: string): Promise<JobRow | null> {
  const { rows } = await sql<JobRow>`
    SELECT
      fingerprint, source, source_id, company, title, location, remote,
      employment_type, experience_hint, category, url,
      to_char(posted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')  AS posted_at,
      to_char(scraped_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS scraped_at,
      description, salary_min, salary_max, currency, visa_tags
    FROM jobs
    WHERE fingerprint = ${fingerprint}
    LIMIT 1;
  `;
  return rows[0] ?? null;
}
