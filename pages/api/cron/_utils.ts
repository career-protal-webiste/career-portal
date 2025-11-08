import type { NextApiRequest, NextApiResponse } from 'next';
import { recordHeartbeat } from '../../../lib/db';

/**
 * Enforce a shared secret for cron endpoints. Accepts the secret either via
 * the `x-cron-secret` header or as a `?secret=` query parameter. If the
 * secret is missing or incorrect, the handler immediately responds with
 * status 401 and returns false so the caller can exit early.
 */
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

/**
 * Record a cron heartbeat and send a JSON response summarizing the run. This
 * helper ensures the heartbeat is written even if the handler does not
 * explicitly call recordHeartbeat().
 */
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
