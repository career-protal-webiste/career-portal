// pages/api/health.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../lib/db';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const { rows } = await sql`SELECT NOW() as now LIMIT 1`;
    res.status(200).json({ ok: true, now: rows[0]?.now ?? null });
  } catch (e: any) {
    console.error('health error', e);
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}
