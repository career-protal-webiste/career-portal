import type { NextApiRequest, NextApiResponse } from 'next';
import { listSourcesByType } from '../../../../lib/sources';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';
  if (process.env.ADMIN_KEY && key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const greenhouse       = await listSourcesByType('greenhouse');
  const lever            = await listSourcesByType('lever');
  const ashby            = await listSourcesByType('ashby');
  const workable         = await listSourcesByType('workable');
  const recruitee        = await listSourcesByType('recruitee');
  const smartrecruiters  = await listSourcesByType('smartrecruiters');
  const workday          = await listSourcesByType('workday');

  res.status(200).json({
    ok: true,
    data: { greenhouse, lever, ashby, workable, recruitee, smartrecruiters, workday },
  });
}
