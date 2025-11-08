import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../../lib/db'; // <— update this path

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { type, token, company_name } = req.body || {};
  if (!type || !token || !company_name) return res.status(400).json({ ok: false, error: 'Missing fields' });

  try {
    await sql/*sql*/`
      INSERT INTO ats_sources (type, token, company_name)
      VALUES (${type}, ${token}, ${company_name})
      ON CONFLICT (type, token) DO UPDATE
        SET company_name = EXCLUDED.company_name, updated_at = NOW();
    `;
    res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message });
  }
}
