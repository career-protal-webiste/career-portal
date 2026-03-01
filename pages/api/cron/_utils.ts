import type { NextApiRequest, NextApiResponse } from 'next';
import { recordHeartbeat } from '../../../lib/db';

/**
 * Enforce a shared secret for cron endpoints.
 * - Vercel cron invocations send x-vercel-cron: 1 — always allow these.
 * - Otherwise, if CRON_SECRET is set, the request must supply a matching
 *   secret via x-cron-secret / x-cron-key header or secret/key query param.
 * - If CRON_SECRET is not set, all requests are allowed (dev/open mode).
 */
export function requireCronSecret(req: NextApiRequest, res: NextApiResponse): boolean {
  // Vercel platform cron — always trusted
  if (req.headers['x-vercel-cron']) return true;

  const headerSecret = req.headers['x-cron-secret'] as string | undefined;
  const headerKey    = req.headers['x-cron-key']    as string | undefined;
  const qsSecret     = (req.query?.secret as string | undefined) || undefined;
  const qsKey        = (req.query?.key    as string | undefined) || undefined;
  const provided     = headerSecret || headerKey || qsSecret || qsKey;

  // If no CRON_SECRET is configured, allow all (open / dev mode)
  if (!process.env.CRON_SECRET) return true;

  if (!provided || provided !== process.env.CRON_SECRET) {
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
