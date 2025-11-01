// pages/api/jobs.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { listJobs, type JobRow } from '../../lib/queries';

// Normalize a job to a lowercased searchable string
function haystack(j: JobRow): string {
  const parts = [
    j.company ?? '',
    j.title ?? '',
    j.location ?? '',
    j.description ?? '',
    j.category ?? '',
    String(j.remote ?? ''),
    j.employment_type ?? '',
    j.experience_hint ?? ''
  ];
  return parts.join(' | ').toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { q, company, limit } = req.query;

    // Base list from DB (server-side ordered by recency)
    let jobs: JobRow[] = await listJobs();

    // Company filter (substring, case-insensitive)
    if (company && typeof company === 'string') {
      const c = company.toLowerCase();
      jobs = jobs.filter(j => (j.company ?? '').toLowerCase().includes(c));
    }

    // Simple free-text filter across common fields
    if (q && typeof q === 'string' && q.trim()) {
      const needle = q.toLowerCase().trim();
      jobs = jobs.filter(j => haystack(j).includes(needle));
    }

    // Optional limit (defaults to all; caps at 500)
    let out = jobs;
    if (limit && typeof limit === 'string' && !Number.isNaN(+limit)) {
      const n = Math.max(0, Math.min(500, +limit));
      out = jobs.slice(0, n);
    }

    res.status(200).json({ count: out.length, jobs: out });
  } catch (e: any) {
    console.error('/api/jobs error', e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
}
