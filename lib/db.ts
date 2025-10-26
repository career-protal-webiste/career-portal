// lib/db.ts
import { sql } from '@vercel/postgres';

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
  posted_at: string | null;   // timestamptz -> ISO string (nullable)
  scraped_at: string;         // timestamptz -> ISO string
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  visa_tags: string[] | null; // text[]
};

export type JobRecord = {
  fingerprint: string;
  source: 'lever' | 'greenhouse' | string;
  source_id?: string | null;
  company: string;
  title: string;
  location?: string | null;
  remote?: boolean | null;
  employment_type?: string | null;
  experience_hint?: string | null;
  category?: string | null;
  url: string;
  posted_at?: string | Date | null;
  scraped_at?: string | Date | null;
  description?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  visa_tags?: string[] | null; // will be stored as text[]
};

// Convert string[] -> Postgres text[] literal (e.g. {"a","b"})
function toPgArrayLiteral(values?: string[] | null): string | null {
  if (!values || values.length === 0) return null;
  const items = values.map(v => `"${String(v).replace(/"/g, '\\"')}"`);
  return `{${items.join(',')}}`;
}

// CREATE TABLE + indexes (each in its own statement)
export async function migrate() {
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
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_company   ON jobs (company);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC NULLS LAST);`;
}

// Insert/update one job row
export async function upsertJob(rec: JobRecord) {
  const posted  = rec.posted_at  ? new Date(rec.posted_at as any).toISOString()  : null;
  const scraped = rec.scraped_at ? new Date(rec.scraped_at as any).toISOString() : new Date().toISOString();
  const visaLit = toPgArrayLiteral(rec.visa_tags);

  await sql`
    INSERT INTO jobs (
      fingerprint, source, source_id, company, title,
      location, remote, employment_type, experience_hint, category,
      url, posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
    )
    VALUES (
      ${rec.fingerprint},
      ${rec.source},
      ${rec.source_id ?? null},
      ${rec.company},
      ${rec.title},
      ${rec.location ?? null},
      ${rec.remote ?? null},
      ${rec.employment_type ?? null},
      ${rec.experience_hint ?? null},
      ${rec.category ?? null},
      ${rec.url},
      ${posted},
      ${scraped},
      ${rec.description ?? null},
      ${rec.salary_min ?? null},
      ${rec.salary_max ?? null},
      ${rec.currency ?? null},
      ${visaLit}::text[]
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

// Read latest jobs (safe even if empty). Throws if table missing.
export async function listJobs(limit = 50): Promise<JobRow[]> {
  try {
    const { rows } = await sql<JobRow>`
      SELECT
        fingerprint, source, source_id, company, title,
        location, remote, employment_type, experience_hint, category,
        url, posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
      FROM jobs
      ORDER BY COALESCE(posted_at, scraped_at) DESC
      LIMIT ${limit};
    `;
    return rows;
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes('relation "jobs" does not exist')) {
      // surface a clean message for the homepage to display
      throw new Error('relation "jobs" does not exist');
    }
    throw e;
  }
}
