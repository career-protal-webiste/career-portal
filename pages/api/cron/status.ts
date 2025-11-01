// pages/api/cron/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCronStatus } from '../../../lib/heartbeat';

function toInt(v: any, def = 120) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

type RawStatusRow = {
  source: string;
  last_run_at: string | Date | null;
  fetched: number | null;
  inserted: number | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const threshold = toInt((req.query as any)?.threshold_min, 120); // minutes
    const rows = (await getCronStatus()) as RawStatusRow[];

    const now = Date.now();
    const results = rows.map(r => {
      const ts = r.last_run_at ? new Date(r.last_run_at).getTime() : null;
      const age_min = ts && Number.isFinite(ts) ? Math.max(0, Math.round((now - ts) / 60000)) : null;
      return {
        source: r.source,
        last_run_at: r.last_run_at,
        fetched: r.fetched ?? 0,
        inserted: r.inserted ?? 0,
        age_min,
        late: age_min == null ? true : age_min > threshold,
        threshold_min: threshold,
      };
    });

    res.status(200).json({ ok: true, results });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'server error' });
  }
}
