// lib/queries.ts
import { sql } from '@vercel/postgres';

export type JobRow = {
  fingerprint: string;
  source: string | null;
  source_id: string | null;
  company: string | null;
  title: string | null;
  location: string | null;
  remote: boolean | string | null;
  employment_type: string | null;
  experience_hint: string | null;
  category: string | null;
  url: string | null;
  posted_at: string | null;
  scraped_at: string | null;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  visa_tags: string[] | null;
};

// Convert Date | string | null → ISO string | null
function toISO(v: unknown) {
  if (v == null) return null;
  const d = typeof v === 'string' ? new Date(v) : (v as Date);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function normalizeDates<T extends { posted_at: any; scraped_at: any }>(r: T) {
  return { ...r, posted_at: toISO(r.posted_at), scraped_at: toISO(r.scraped_at) } as any;
}

export async function listJobs(limit = 100): Promise<JobRow[]> {
  const { rows } = await sql<JobRow>`
    SELECT
      fingerprint, source, source_id, company, title, location, remote,
      employment_type, experience_hint, category, url,
      posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
    FROM jobs
    ORDER BY posted_at DESC NULLS LAST, scraped_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return rows.map(normalizeDates);
}

export async function getJobById(id: string): Promise<JobRow | null> {
  const { rows } = await sql<JobRow>`
    SELECT
      fingerprint, source, source_id, company, title, location, remote,
      employment_type, experience_hint, category, url,
      posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
    FROM jobs
    WHERE fingerprint = ${id}
    LIMIT 1
  `;
  return rows[0] ? normalizeDates(rows[0]) : null;
}

// Alias for your detail page imports
export async function getJobByFingerprint(fingerprint: string) {
  return getJobById(fingerprint);
}

export async function listSimilar(job: JobRow, limit = 6): Promise<JobRow[]> {
  // Prefer same company
  if (job.company) {
    const r1 = await sql<JobRow>`
      SELECT
        fingerprint, source, source_id, company, title, location, remote,
        employment_type, experience_hint, category, url,
        posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
      FROM jobs
      WHERE company = ${job.company} AND fingerprint <> ${job.fingerprint}
      ORDER BY posted_at DESC NULLS LAST, scraped_at DESC NULLS LAST
      LIMIT ${limit}
    `;
    if (r1.rows.length) return r1.rows.map(normalizeDates);
  }
  // Then same category
  if (job.category) {
    const r2 = await sql<JobRow>`
      SELECT
        fingerprint, source, source_id, company, title, location, remote,
        employment_type, experience_hint, category, url,
        posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
      FROM jobs
      WHERE category = ${job.category} AND fingerprint <> ${job.fingerprint}
      ORDER BY posted_at DESC NULLS LAST, scraped_at DESC NULLS LAST
      LIMIT ${limit}
    `;
    if (r2.rows.length) return r2.rows.map(normalizeDates);
  }
  // Fallback: latest others
  const r3 = await sql<JobRow>`
    SELECT
      fingerprint, source, source_id, company, title, location, remote,
      employment_type, experience_hint, category, url,
      posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
    FROM jobs
    WHERE fingerprint <> ${job.fingerprint}
    ORDER BY posted_at DESC NULLS LAST, scraped_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return r3.rows.map(normalizeDates);
}
