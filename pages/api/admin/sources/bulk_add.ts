// pages/api/admin/sources/bulk_add.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { addSource, ATSType } from '../../../../lib/sources';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = (req.headers['x-admin-key'] as string) || (req.query?.key as string) || '';
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'use POST' });
  }

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || [];
    if (!Array.isArray(body)) {
      return res.status(400).json({ ok: false, error: 'Body must be an array' });
    }

    const added: any[] = [];
    const skipped: any[] = [];

    for (const item of body) {
      const { type, token, company_name } = item || {};
      if (!type || !token || !company_name) { skipped.push({ item, reason: 'missing' }); continue; }

      await addSource({
        type: type as ATSType,
        token: String(token),
        company_name: String(company_name),
      });
      added.push({ type, token, company_name });
    }

    return res.status(200).json({ ok: true, added, skipped });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'server error' });
  }
}
