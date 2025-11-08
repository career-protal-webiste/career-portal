// pages/api/cron/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await sql/*sql*/`
      SELECT source, MAX(ran_at) as last_run,
             SUM(fetched) FILTER (WHERE ran_at > NOW() - INTERVAL '24 hours') as fetched_24h,
             SUM(inserted) FILTER (WHERE ran_at > NOW() - INTERVAL '24 hours') as inserted_24h
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
