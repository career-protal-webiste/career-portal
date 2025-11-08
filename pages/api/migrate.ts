// pages/api/migrate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { migrate } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = req.query.key as string | undefined;
  if (!key || key !== process.env.MIGRATE_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    await migrate();
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e?.message || 'migrate failed' });
  }
}
