// pages/api/admin/migrate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureSchema } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureSchema();
    res.status(200).json({ ok: true, created: true });
  } catch (e: any) {
    console.error('Migration error:', e);
    res.status(500).json({ ok: false, error: e?.message || 'unknown' });
  }
}
