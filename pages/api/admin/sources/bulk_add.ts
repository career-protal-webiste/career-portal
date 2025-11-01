import type { NextApiRequest, NextApiResponse } from 'next';
import { bulkAddSources, ATSType } from '../../../../lib/sources';

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';
  if (process.env.ADMIN_KEY && key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  try {
    let items: any = req.body;
    if (typeof items === 'string') items = JSON.parse(items);
    if (items && !Array.isArray(items) && Array.isArray(items.items)) items = items.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'Body must be a non-empty JSON array' });
    }

    const bad = items.find((x: any) => !x || !x.type || !x.token || !x.company_name);
    if (bad) return res.status(400).json({ ok: false, error: 'Each item needs type, token, company_name' });

    const casted = items.map((x: any) => ({
      type: String(x.type) as ATSType,
      token: String(x.token),
      company_name: String(x.company_name),
      active: true,
    }));

    await bulkAddSources(casted);
    return res.status(200).json({ ok: true, added: casted.length });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'server error' });
  }
}
