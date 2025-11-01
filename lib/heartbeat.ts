// lib/heartbeat.ts
import { sql } from '@vercel/postgres';

export type CronSource = 'lever'|'greenhouse'|'ashby'|'workable'|'recruitee';

async function ensureTable() {
  await sql/* sql */`
    CREATE TABLE IF NOT EXISTS cron_heartbeat (
      id        BIGSERIAL PRIMARY KEY,
      source    TEXT        NOT NULL,
      fetched   INTEGER     NOT NULL,
      inserted  INTEGER     NOT NULL,
      ran_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}

export async function recordCronHeartbeat(source: CronSource, fetched: number, inserted: number) {
  await ensureTable();
  await sql/* sql */`
    INSERT INTO cron_heartbeat (source, fetched, inserted)
    VALUES (${source}, ${fetched}, ${inserted});
  `;
}

export type CronRow = { source: string; fetched: number; inserted: number; ran_at: string };

export async function getCronStatus(): Promise<CronRow[]> {
  await ensureTable();
  const { rows } = await sql/* sql */`
    SELECT ch.source, ch.fetched, ch.inserted, ch.ran_at
    FROM cron_heartbeat ch
    JOIN (
      SELECT source, MAX(ran_at) AS max_ran
      FROM cron_heartbeat
      GROUP BY source
    ) t ON t.source = ch.source AND t.max_ran = ch.ran_at
    ORDER BY ch.source;
  `;
  return rows as CronRow[];
}
