// pages/api/admin/sources/auto_add.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { detectATS } from '../../../lib/ats_detect';
import { addSource, ATSType } from '../../../lib/sources';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok:false, error: 'unauthorized' });
  }

  const body = Array.isArray(req.body) ? req.body : (req.body?.urls || []);
  if (!Array.isArray(body) || body.length === 0) {
    return res.status(400).json({ ok:false, error:'send JSON array under body or { "urls": [] }' });
  }

  const added: any[] = [], skipped: any[] = [];
  for (const raw of body) {
    const url = String(raw?.url || raw);
    const name = raw?.company_name ? String(raw.company_name) : undefined;
    const d = detectATS(url);
    if (!d) { skipped.push({ url, reason:'unrecognized' }); continue; }
    await addSource(d.type as ATSType, d.token, name || d.token);
    added.push({ url, type:d.type, token:d.token, company_name:name || d.token });
  }

  res.status(200).json({ ok:true, added, skipped });
}
