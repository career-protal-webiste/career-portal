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

export async function recordCronHeartbeat(source: CronSource, fetched: number, inserted: number) {
  await sql`
    INSERT INTO cron_heartbeats (source, ran_at, fetched, inserted)
    VALUES (${source}, NOW(), ${fetched}, ${inserted})
  `;
}

/** Returns last run per source; API route can mark freshness client-side */
export async function getCronStatus() {
  const { rows } = await sql<{
    source: CronSource;
    last_run_at: string;
    fetched: number | null;
    inserted: number | null;
  }>`
    SELECT
      source,
      MAX(ran_at)        AS last_run_at,
      MAX(fetched)::int  AS fetched,
      MAX(inserted)::int AS inserted
    FROM cron_heartbeats
    GROUP BY source
    ORDER BY source
  `;
  return rows;
}
