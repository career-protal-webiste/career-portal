import type { NextApiRequest, NextApiResponse } from 'next';
import { recordHeartbeat } from '../../../lib/db';

/**
 * Enforce a shared secret for cron endpoints. Accepts the secret from
 * either x‑cron-secret or x‑cron-key header, or via a secret/key query
 * parameter. Returns false and responds with 401 if missing or mismatched.
 */
export function requireCronSecret(req: NextApiRequest, res: NextApiResponse): boolean {
  // Accept both x-cron-secret and x-cron-key headers for backwards compatibility
  const headerSecret = req.headers['x-cron-secret'] as string | undefined;
  const headerKey    = req.headers['x-cron-key']    as string | undefined;
  const qsSecret     = (req.query?.secret as string | undefined) || undefined;
  const qsKey        = (req.query?.key    as string | undefined) || undefined;
  const provided     = headerSecret || headerKey || qsSecret || qsKey;
  if (!provided || (process.env.CRON_SECRET && provided !== process.env.CRON_SECRET)) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

/**
 * Record a cron heartbeat and send a JSON response summarizing the run.
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
