// lib/heartbeat.ts
import { sql } from '@vercel/postgres';

export type CronSource =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'recruitee'
  | 'smartrecruiters'
  | 'workday';

type HBRow = {
  source: string;
  fetched: number | null;
  inserted: number | null;
  created_at: string | Date;
};

async function ensureTable() {
  // Safe to run every call
  await sql`
    CREATE TABLE IF NOT EXISTS cron_heartbeats (
      id         BIGSERIAL PRIMARY KEY,
      source     TEXT NOT NULL,
      fetched    INT  DEFAULT 0,
      inserted   INT  DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cron_heartbeats_source_time
      ON cron_heartbeats (source, created_at DESC);
  `;
}

/** Record a cron run result */
export async function recordCronHeartbeat(
  source: CronSource,
  fetched: number,
  inserted: number
) {
  await ensureTable();
  await sql`
    INSERT INTO cron_heartbeats (source, fetched, inserted)
    VALUES (${source}, ${fetched}, ${inserted});
  `;
}

/** Latest status per source + freshness */
export async function getCronStatus(thresholdMin = 120) {
  await ensureTable();

  const { rows } = await sql<HBRow>`
    WITH latest AS (
      SELECT DISTINCT ON (source)
        source, fetched, inserted, created_at
      FROM cron_heartbeats
      ORDER BY source, created_at DESC
    )
    SELECT * FROM latest
    ORDER BY source ASC;
  `;

  const now = new Date();
  const entries = rows.map((r) => {
    const last = new Date(r.created_at as any);
    const ageMin = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 60000));
    return {
      source: r.source,
      last_run_at: last.toISOString(),
      fetched: r.fetched ?? 0,
      inserted: r.inserted ?? 0,
      age_min: ageMin,
      fresh: ageMin <= thresholdMin,
    };
  });

  return {
    now: now.toISOString(),
    threshold_min: thresholdMin,
    entries,
  };
}
