import type { NextApiRequest, NextApiResponse } from 'next';
import { recordHeartbeat } from '../../../lib/db'; // <— update this path

export function requireCronSecret(req: NextApiRequest, res: NextApiResponse): boolean {
  const header = req.headers['x-cron-secret'] as string | undefined;
  const qs = (req.query?.secret as string | undefined) || undefined;
  const provided = header || qs;
  if (!provided || provided !== process.env.CRON_SECRET) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

export async function endWithHeartbeat(
  res: NextApiResponse,
  source: string,
  fetched: number,
  inserted: number
) {
  try {
    await recordHeartbeat(source, fetched, inserted);
  } catch (e) {
    console.error('heartbeat error', e);
  }
  res.status(200).json({ ok: true, source, fetched, inserted });
}
