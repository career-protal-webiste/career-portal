// pages/api/migrate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { migrate } from '../../lib/db';

/**
 * Protect this route with a secret.
 * Add MIGRATE_KEY in Vercel → Project → Settings → Environment Variables.
 * Then call:  /api/migrate?key=YOUR_SECRET
 * (or send the secret in header: x-migrate-key)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expected = process.env.MIGRATE_KEY;
  const fromQuery = req.query.key;
  const fromHeader = req.headers['x-migrate-key'];

  // Normalize possible values (string | string[] | undefined)
  const provided =
    typeof fromQuery === 'string' ? fromQuery :
    Array.isArray(fromQuery) ? fromQuery[0] :
    typeof fromHeader === 'string' ? fromHeader : undefined;

  if (expected && provided !== expected) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  try {
    await migrate();
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('migrate error', e);
    return res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
}
