import { sql as vercelSql } from '@vercel/postgres';

// Re-export the sql tagged template from @vercel/postgres. This automatically
// picks up your configured database URL from Vercel environment variables
// (POSTGRES_URL, DATABASE_URL, etc.) without manually creating a pool.
export const sql = vercelSql;

/**
 * Run database migrations to ensure necessary tables and indexes exist.
 * Invoke this via the `/api/migrate` route after deploying, and whenever you
 * make schema changes. The jobs table stores a de-duplicated feed of jobs,
 * the ats_sources table stores tenant information for ATS boards, and
 * cron_heartbeats tracks ingestion runs for monitoring.
 */
export async function migrate() {
  // Jobs table: keyed by fingerprint to avoid duplicates. This definition
  // includes fields for scraped_at, description, salary, currency and visa_tags
  // which are used throughout the application. Older deployments that lack
  // these columns will have them added via ALTER TABLE statements below.
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS jobs (
      fingerprint       text PRIMARY KEY,
      source            text,
      source_id         text,
      company           text,
      title             text,
      location          text,
      remote            text,
      employment_type   text,
      experience_hint   text,
      category          text,
      url               text,
      posted_at         timestamptz,
      scraped_at        timestamptz,
      description       text,
      salary_min        numeric,
      salary_max        numeric,
      currency          text,
      visa_tags         text,
      created_at        timestamptz DEFAULT NOW(),
      updated_at        timestamptz DEFAULT NOW()
    );
  `;

  // Ensure missing columns are added when migrating an older schema. These
  // operations are idempotent thanks to IF NOT EXISTS checks.
  await sql/*sql*/`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scraped_at  timestamptz;`;
  await sql/*sql*/`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description text;`;
  await sql/*sql*/`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_min numeric;`;
  await sql/*sql*/`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_max numeric;`;
  await sql/*sql*/`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS currency   text;`;
  await sql/*sql*/`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS visa_tags  text;`;
  await sql/*sql*/`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT NOW();`;
  await sql/*sql*/`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();`;

  // Indexes speed up common queries (e.g. sorting by posting date or
  // searching by company/title). Index on scraped_at helps ordering when
  // posted_at is null.
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC);`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON jobs (scraped_at DESC);`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs ((lower(coalesce(company,''))));`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_jobs_title ON jobs ((lower(coalesce(title,''))));`;

  // ATS sources table: each row represents a tenant on an ATS provider. Useful for bulk
  // ingestion of jobs from Greenhouse, Lever, Ashby, etc.
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS ats_sources (
      id            serial PRIMARY KEY,
      type          text NOT NULL,
      token         text NOT NULL,
      company_name  text NOT NULL,
      created_at    timestamptz DEFAULT NOW(),
      updated_at    timestamptz DEFAULT NOW(),
      UNIQUE (type, token)
    );
  `;

  // Cron heartbeats table: track when each ingestion job ran, and how many items
  // were fetched and inserted. This powers the /cron-status dashboard.
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS cron_heartbeats (
      id        serial PRIMARY KEY,
      source    text NOT NULL,
      ran_at    timestamptz NOT NULL DEFAULT NOW(),
      fetched   int,
      inserted  int
    );
  `;
}

// Define the shape of a job record accepted by upsertJob(). All fields are optional
// except for the fingerprint (the unique key).
export type UpsertJobInput = {
  /**
   * Unique fingerprint for the job posting. This should be stable across
   * scrapes so repeated runs can update an existing record rather than
   * inserting duplicates. Typically constructed from company+title+location+url.
   */
  fingerprint: string;
  /**
   * The source from which this job was ingested (greenhouse, lever, ashby, etc.).
   */
  source?: string | null;
  /**
   * The provider-specific ID for the posting, if available.
   */
  source_id?: string | null;
  /**
   * Company name. Nullable so fallback seeds and poorly-formatted posts can still be stored.
   */
  company?: string | null;
  /**
   * Job title.
   */
  title?: string | null;
  /**
   * Location (city, region, country).
   */
  location?: string | null;
  /**
   * Whether the job is remote. Stored as a boolean or string to simplify SQL comparisons.
   */
  remote?: boolean | string | null;
  /**
   * Employment type (full‑time, contract, internship, etc.).
   */
  employment_type?: string | null;
  /**
   * Short experience hint derived from the title/description (e.g. "junior", "senior", "0-5", etc.).
   */
  experience_hint?: string | null;
  /**
   * Normalized category (e.g. "data", "ml").
   */
  category?: string | null;
  /**
   * Absolute URL to the job posting.
   */
  url?: string | null;
  /**
   * When the job was posted, if available. ISO date string preferred.
   */
  posted_at?: string | null;
  /**
   * When the job was scraped. Used to order jobs by recency when posted_at is missing.
   */
  scraped_at?: string | null;
  /**
   * Free‑form description or summary of the role, if provided by the source.
   */
  description?: string | null;
  /**
   * Minimum salary extracted from the posting, if any.
   */
  salary_min?: number | null;
  /**
   * Maximum salary extracted from the posting, if any.
   */
  salary_max?: number | null;
  /**
   * Currency code for salary values (e.g. "USD").
   */
  currency?: string | null;
  /**
   * Visa tags or eligibility hints (e.g. "H1B", "OPT").
   */
  visa_tags?: string | null;
};

/**
 * Insert or update a job in the database. If a row with the same fingerprint
 * already exists, update its fields and bump updated_at. Remote values are
 * stored as 'true' or 'false' strings for simplicity when querying.
 */
export async function upsertJob(j: UpsertJobInput) {
  const postedIso = j.posted_at ? new Date(j.posted_at).toISOString() : null;
  const remoteText =
    typeof j.remote === 'boolean' ? String(j.remote) : (j.remote ?? null);

  const scrapedIso = j.scraped_at ? new Date(j.scraped_at).toISOString() : null;

  await sql/*sql*/`
    INSERT INTO jobs
      (
        fingerprint,
        source,
        source_id,
        company,
        title,
        location,
        remote,
        employment_type,
        experience_hint,
        category,
        url,
        posted_at,
        scraped_at,
        description,
        salary_min,
        salary_max,
        currency,
        visa_tags
      )
    VALUES (
        ${j.fingerprint},
        ${j.source ?? null},
        ${j.source_id ?? null},
        ${j.company ?? null},
        ${j.title ?? null},
        ${j.location ?? null},
        ${remoteText},
        ${j.employment_type ?? null},
        ${j.experience_hint ?? null},
        ${j.category ?? null},
        ${j.url ?? null},
        ${postedIso},
        ${scrapedIso},
        ${j.description ?? null},
        ${j.salary_min ?? null},
        ${j.salary_max ?? null},
        ${j.currency ?? null},
        ${j.visa_tags ?? null}
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

/**
 * Record a cron heartbeat. This should be called at the end of a cron handler
 * with the total number of items fetched and inserted. The dashboard uses
 * these rows to compute freshness and volume.
 */
export async function recordHeartbeat(source: string, fetched: number, inserted: number) {
  await sql/*sql*/`
    INSERT INTO cron_heartbeats (source, fetched, inserted)
    VALUES (${source}, ${fetched}, ${inserted});
  `;
}
