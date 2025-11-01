import type { NextApiRequest, NextApiResponse } from 'next';
import { bulkAddSources } from '../../../../lib/sources';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';
  if (process.env.ADMIN_KEY && key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  try {
    const items = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || [];
    // items: [{type:'greenhouse', token:'stripe', company_name:'Stripe'}, ...]
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ ok: false, error: 'Empty body' });
    await bulkAddSources(items as any);
    res.status(200).json({ ok: true, added: items.length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'server error' });
  }
}
