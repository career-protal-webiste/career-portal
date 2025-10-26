// pages/api/migrate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { migrate } from '../../lib/db';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    await migrate();
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
}
