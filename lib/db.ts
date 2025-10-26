import { sql } from '@vercel/postgres';

// Ensure the jobs table exists
export async function createJobsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      fingerprint TEXT UNIQUE NOT NULL,
      company TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT,
      remote BOOLEAN,
      employment_type TEXT,
      experience_hint TEXT,
      category TEXT,
      url TEXT NOT NULL,
      posted_at TIMESTAMP NOT NULL,
      scraped_at TIMESTAMP DEFAULT NOW(),
      description TEXT,
      salary_min INTEGER,
      salary_max INTEGER,
      currency TEXT,
      visa_tags TEXT[]
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_sourceid ON jobs(source, source_id);
  `;
}

// Insert a job if it doesn’t already exist
export async function upsertJob(job: any) {
  await createJobsTable();
  await sql`
    INSERT INTO jobs (
      source, source_id, fingerprint, company, title, location,
      remote, employment_type, experience_hint, category, url,
      posted_at, scraped_at, description, salary_min, salary_max,
      currency, visa_tags
    )
    VALUES (
      ${job.source}, ${job.source_id}, ${job.fingerprint}, ${job.company}, ${job.title},
      ${job.location ?? null}, ${job.remote ?? null}, ${job.employment_type ?? null},
      ${job.experience_hint ?? null}, ${job.category ?? null}, ${job.url},
      ${job.posted_at}, ${job.scraped_at ?? new Date()},
      ${job.description ?? null}, ${job.salary_min ?? null}, ${job.salary_max ?? null},
      ${job.currency ?? null}, ${job.visa_tags ?? null}
    )
    ON CONFLICT (fingerprint) DO NOTHING;
  `;
}

// Fetch jobs for homepage
export async function getJobs(limit: number = 50) {
  await createJobsTable();
  const { rows } = await sql`SELECT * FROM jobs ORDER BY posted_at DESC LIMIT ${limit}`;
  return rows;
}
