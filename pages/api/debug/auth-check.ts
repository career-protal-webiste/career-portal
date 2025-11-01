// pages/api/debug/auth-check.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expected = process.env.ADMIN_KEY || process.env.CRON_SECRET || '';
  const provided = String(req.query.key ?? req.headers['x-admin-key'] ?? '');
  const expectsKey = Boolean(expected);

  res.status(200).json({
    ok: true,
    expectsKey,
    provided_present: Boolean(provided),
    matched: expectsKey ? provided === expected : true,
    via: req.query.key ? 'query' : (req.headers['x-admin-key'] ? 'header' : 'none'),
  });
}
