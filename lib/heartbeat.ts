// lib/heartbeat.ts
import { sql } from './db';

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
  created_at: string; // ISO
};

async function ensureTable() {
  // Safe to run on every call
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

/** Record the result of a cron run */
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

/** Summarize last run per source and whether it’s fresh within threshold_min */
export async function getCronStatus(thresholdMin = 120) {
  await ensureTable();

  const rows = await sql<HBRow[]>`
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
    const last = new Date(r.created_at);
    const ageMin = Math.max(
      0,
      Math.floor((now.getTime() - last.getTime()) / 60000)
    );
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
