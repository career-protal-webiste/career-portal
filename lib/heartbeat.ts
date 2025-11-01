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

export async function getCronStatus(thresholdMin: number) {
  await ensureTable();
  const nowRow = await sql/*sql*/`SELECT NOW()::timestamptz AS now`;
  const now: string = (nowRow.rows[0] as any).now;

  const r = await sql/*sql*/`
    SELECT source, last_run_at, fetched, inserted
    FROM cron_heartbeats
    ORDER BY source ASC
  `;

  const entries = r.rows.map((row: any) => {
    const last = new Date(row.last_run_at).getTime();
    const ageMin = Math.floor((Date.now() - last) / 60000);
    return {
      source: row.source as CronSource,
      last_run_at: row.last_run_at,
      fetched: Number(row.fetched) || 0,
      inserted: Number(row.inserted) || 0,
      age_min: ageMin,
      fresh: ageMin <= thresholdMin
    };
  });

  return { now, threshold_min: thresholdMin, entries };
}
