// pages/api/admin/sources/auto_detect.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { detectATS } from '../../../../lib/ats_detect';
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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const urls: string[] = Array.isArray(body?.urls)
      ? body.urls
      : body?.url
        ? [String(body.url)]
        : [];

    if (!urls.length) {
      return res.status(400).json({ ok: false, error: 'missing urls[] or url' });
    }

    const added: any[] = [];
    const skipped: any[] = [];

    for (const raw of urls) {
      const u = String(raw).trim();
      const det = detectATS(u);
      if (!det) { skipped.push({ url: u, reason: 'unrecognized' }); continue; }

      // ✅ DO NOT pass `active`
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
