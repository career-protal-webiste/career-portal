// pages/api/cron/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCronStatus } from '../../../lib/heartbeat';

function toInt(v: any, def = 120) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const threshold = toInt((req.query as any)?.threshold_min, 120);
  const data = await getCronStatus(threshold);
  res.status(200).json(data);
}
