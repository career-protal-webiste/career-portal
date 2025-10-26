// pages/api/jobs.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { listJobs, type JobRow } from '../../lib/db';

// Very simple JSON API. Optional filters are applied in memory
// to avoid depending on a particular DB signature.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { q, company, limit } = req.query;

    let jobs: JobRow[] = await listJobs();

    if (company && typeof company === 'string') {
      const c = company.toLowerCase();
      jobs = jobs.filter(j => (j.company ?? '').toLowerCase().includes(c));
    }

    if (q && typeof q === 'string') {
      const needle = q.toLowerCase();
      jobs = jobs.filter(j =>
        (j.title ?? '').toLowerCase().includes(needle) ||
        (j.location ?? '').toLowerCase().includes(needle) ||
        (j.company ?? '').toLowerCase().includes(needle)
      );
    }

    let out = jobs;
    if (limit && typeof limit === 'string' && !Number.isNaN(+limit)) {
      out = jobs.slice(0, Math.max(0, Math.min(500, +limit)));
    }

    res.status(200).json({ count: out.length, jobs: out });
  } catch (e: any) {
    console.error('/api/jobs error', e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
}
