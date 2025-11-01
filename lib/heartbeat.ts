// lib/heartbeat.ts
import { sql } from '@vercel/postgres';

/**
 * Add any new cron source types here.
 */
export type CronSource =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'recruitee'
  | 'smartrecruiters'
  | 'workday';

async function ensureTable() {
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS cron_heartbeats (
      source       TEXT PRIMARY KEY,
      last_run_at  TIMESTAMPTZ NOT NULL,
      fetched      INTEGER NOT NULL DEFAULT 0,
      inserted     INTEGER NOT NULL DEFAULT 0,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}

export async function recordCronHeartbeat(
  source: CronSource,
  fetched: number,
  inserted: number
) {
  await ensureTable();
  await sql/*sql*/`
    INSERT INTO cron_heartbeats (source, last_run_at, fetched, inserted, updated_at)
    VALUES (${source}, NOW(), ${fetched}, ${inserted}, NOW())
    ON CONFLICT (source) DO UPDATE
      SET last_run_at = EXCLUDED.last_run_at,
          fetched     = EXCLUDED.fetched,
          inserted    = EXCLUDED.inserted,
          updated_at  = NOW();
  `;
}
