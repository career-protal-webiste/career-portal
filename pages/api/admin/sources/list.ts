import type { NextApiRequest, NextApiResponse } from 'next';
import { listSourcesByType } from '../../../../lib/sources';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';
  if (process.env.ADMIN_KEY && key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const types = ['greenhouse','lever','ashby','workable','recruitee'] as const;
  const data: any = {};
  for (const t of types) data[t] = await listSourcesByType(t);
  res.status(200).json({ ok: true, data });
}
