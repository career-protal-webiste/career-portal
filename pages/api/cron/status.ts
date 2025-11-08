import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../lib/db';

/**
 * Cron status endpoint. Returns the last run time per source, along with
 * the number of items fetched and inserted within the past 24 hours. The
 * dashboard page polls this route every 30 seconds to show real‑time health.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await sql/*sql*/`
      SELECT source,
             MAX(ran_at) AS last_run,
             SUM(fetched) FILTER (WHERE ran_at > NOW() - INTERVAL '24 hours') AS fetched_24h,
             SUM(inserted) FILTER (WHERE ran_at > NOW() - INTERVAL '24 hours') AS inserted_24h
      FROM cron_heartbeats
      GROUP BY source
      ORDER BY source;
    `;
    res.status(200).json({ ok: true, rows });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message });
  }
}
