// pages/api/cron/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCronStatus } from '../../../lib/heartbeat';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const thresholdMin = Math.max(1, parseInt((req.query?.threshold_min as string) || '120', 10)); // default 120 min
  const now = Date.now();
  const rows = await getCronStatus();

  const entries = rows.map(r => {
    const ranAtMs = new Date(r.ran_at).getTime();
    const ageMin = Math.round((now - ranAtMs) / 60000);
    return {
      source: r.source,
      fetched: r.fetched,
      inserted: r.inserted,
      ran_at: r.ran_at,
      age_minutes: ageMin,
      ok: ageMin <= thresholdMin
    };
  });

  res.status(200).json({ now: new Date().toISOString(), threshold_min: thresholdMin, entries });
}
