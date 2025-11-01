// pages/api/admin/sources/auto_add.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { detectATS } from '../../../../lib/ats_detect';
import { addSource, ATSType } from '../../../../lib/sources';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = (req.headers['x-admin-key'] as string) || (req.query?.key as string) || '';
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
    const urls: string[] = Array.isArray(body?.urls) ? body.urls : [];

    const added: any[] = [];
    const skipped: any[] = [];

    for (const u of urls) {
      const det = detectATS(u);
      if (!det) { skipped.push({ url: u, reason: 'unrecognized' }); continue; }

      // ✅ addSource expects a single object, not 3 args
      await addSource({
        type: det.type as ATSType,
        token: det.token,
        company_name: det.company_name,
      });

      added.push({ url: u, ...det });
    }

    res.status(200).json({ ok: true, added, skipped });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'server error' });
  }
}
