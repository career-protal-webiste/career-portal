// pages/api/stats/sources.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../lib/db'; // <-- correct path

type Row = { source: string; count: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // counts by source (last 60d window; adjust if you want)
    const bySource = await sql<Row>`
      SELECT source, COUNT(*)::int AS count
      FROM jobs
      WHERE COALESCE(posted_at, scraped_at) >= NOW() - INTERVAL '60 days'
      GROUP BY source
      ORDER BY count DESC
    `;

    // optional: new in last 24h
    const last24h = await sql<Row>`
      SELECT source, COUNT(*)::int AS count
      FROM jobs
      WHERE scraped_at >= NOW() - INTERVAL '24 hours'
      GROUP BY source
      ORDER BY count DESC
    `;

    const total = bySource.rows.reduce((a, r) => a + r.count, 0);

    res.status(200).json({
      ok: true,
      total,
      by_source: bySource.rows,
      last24h: last24h.rows,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'server error' });
  }
}
