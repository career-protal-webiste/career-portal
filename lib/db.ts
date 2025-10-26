// lib/db.ts
import { sql } from '@vercel/postgres';

export type JobRecord = {
  fingerprint: string;
  source: string;              // 'lever' | 'greenhouse' | etc
  source_id: string | null;
  company: string;
  title: string;
  location: string | null;
  remote: boolean | null;
  employment_type: string | null;
  experience_hint: string | null;
  category: string | null;
  url: string;
  posted_at: Date | string | null;
  scraped_at: Date | string;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  visa_tags: string[] | null;  // we’ll store as JSON text
};

// Run once to create the table & indexes
export async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      fingerprint     TEXT PRIMARY KEY,
      source          TEXT NOT NULL,
      source_id       TEXT,
      company         TEXT NOT NULL,
      title           TEXT NOT NULL,
      location        TEXT,
      remote          BOOLEAN,
      employment_type TEXT,
      experience_hint TEXT,
      category        TEXT,
      url             TEXT NOT NULL,
      posted_at       TIMESTAMPTZ,
      scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      description     TEXT,
      salary_min      INT,
      salary_max      INT,
      currency        TEXT,
      -- store array as JSON text to keep inserts simple
      visa_tags       TEXT
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_company    ON jobs (company);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON jobs (scraped_at DESC);`;
}

// Insert or update one job
export async function upsertJob(rec: JobRecord) {
  const postedAtISO  = rec.posted_at ? new Date(rec.posted_at).toISOString() : null;
  const scrapedAtISO = rec.scraped_at ? new Date(rec.scraped_at).toISOString() : new Date().toISOString();
  const visaJson     = rec.visa_tags ? JSON.stringify(rec.visa_tags) : null;

  await sql`
    INSERT INTO jobs (
      fingerprint, source, source_id, company, title,
      location, remote, employment_type, experience_hint,
      category, url, posted_at, scraped_at,
      description, salary_min, salary_max, currency, visa_tags
    ) VALUES (
      ${rec.fingerprint}, ${rec.source}, ${rec.source_id}, ${rec.company}, ${rec.title},
      ${rec.location}, ${rec.remote}, ${rec.employment_type}, ${rec.experience_hint},
      ${rec.category}, ${rec.url}, ${postedAtISO}, ${scrapedAtISO},
      ${rec.description}, ${rec.salary_min}, ${rec.salary_max}, ${rec.currency}, ${visaJson}
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
