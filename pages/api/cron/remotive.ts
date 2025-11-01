// pages/api/cron/remotive.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';

type RemotiveJob = {
  id: number;
  title: string;
  company_name: string;
  category: string;
  url: string;
  publication_date: string; // ISO
  candidate_required_location: string; // e.g. "USA Only", "Worldwide"
  job_type?: string; // full_time, contract, etc.
  description?: string;
  salary?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ADMIN_KEY = process.env.ADMIN_KEY || '';
  const providedKey = String(req.query.key ?? req.headers['x-admin-key'] ?? '');
  if (ADMIN_KEY && providedKey !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const url = 'https://remotive.com/api/remote-jobs?category=software-dev';
  let fetched = 0, inserted = 0;

  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`Remotive HTTP ${r.status}`);
    const data = await r.json();
    const jobs: RemotiveJob[] = data?.jobs ?? [];
    fetched = jobs.length;

    for (const j of jobs) {
      // Focus US-only (or US-friendly) roles
      const loc = (j.candidate_required_location || '').toLowerCase();
      const isUS =
        /usa|us only|united states|north america/.test(loc);

      if (!isUS) continue;

      const company = j.company_name?.trim() || 'Unknown';
      const title = j.title?.trim() || 'Job';
      const location = j.candidate_required_location || 'Remote (US)';
      const remote = true;
      const employment_type = j.job_type ?? null;
      const experience_hint = /junior|entry\s*level|0-1|0-2|0-3/i.test(`${j.title} ${j.description}`) ? '0-1' : null;
      const category = j.category || 'Software';
      const urlJob = j.url;
      const posted_at = j.publication_date ? new Date(j.publication_date).toISOString() : null;
      const scraped_at = new Date().toISOString();
      const description = j.description || null;

      let salary_min: number | null = null, salary_max: number | null = null, currency: string | null = null;
      if (j.salary) {
        const m = j.salary.match(/(\$|usd)?\s?(\d{2,3},?\d{0,3})\D+(\d{2,3},?\d{0,3})/i);
        if (m) {
          currency = 'USD';
          salary_min = Number(m[2].replace(/,/g, ''));
          salary_max = Number(m[3].replace(/,/g, ''));
        }
      }

      const visa_tags = null;
      const fingerprint = `${company}|${title}|${location}|${urlJob}`.toLowerCase();

      await upsertJob({
        fingerprint,
        source: 'lever', // reuse existing enum
        source_id: String(j.id),
        company, title, location, remote,
        employment_type, experience_hint, category,
        url: urlJob, posted_at, scraped_at,
        description, salary_min, salary_max, currency,
        visa_tags
      });
      inserted++;
    }

    res.status(200).json({ ok: true, fetched, inserted });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'remotive fetch error', fetched, inserted });
  }
}
