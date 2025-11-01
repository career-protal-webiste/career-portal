// pages/api/cron/adzuna.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';

type AdzunaJob = {
  id: string;
  title: string;
  description: string;
  created: string; // ISO
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  contract_type?: string; // full_time, part_time, etc.
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ADMIN_KEY = process.env.ADMIN_KEY || '';
  const providedKey = String(req.query.key ?? req.headers['x-admin-key'] ?? '');
  if (ADMIN_KEY && providedKey !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    return res.status(400).json({ ok: false, error: 'missing ADZUNA_APP_ID/ADZUNA_APP_KEY' });
  }

  // Target: US, tech roles, recent, junior-friendly keywords
  const pages = 3; // pull ~150 per run (3 * 50)
  const results_per_page = 50;
  const what = encodeURIComponent('software OR data OR analytics OR devops OR backend OR frontend OR qa OR test ("entry level" OR junior OR "0-3 years")');

  let fetched = 0, inserted = 0;

  try {
    for (let page = 1; page <= pages; page++) {
      const url = `https://api.adzuna.com/v1/api/jobs/us/search/${page}?app_id=${appId}&app_key=${appKey}&results_per_page=${results_per_page}&content-type=application/json&what=${what}&max_days_old=14`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) throw new Error(`Adzuna HTTP ${r.status}`);
      const data = await r.json();
      const jobs: AdzunaJob[] = data?.results ?? [];
      fetched += jobs.length;

      for (const j of jobs) {
        const company = (j.company?.display_name ?? '').trim() || 'Unknown';
        const title = j.title?.trim() || 'Job';
        const location = j.location?.display_name ?? null;
        const remote = /remote|anywhere/i.test(`${j.title} ${j.description}` || '');
        const employment_type = j.contract_type ?? null;
        const experience_hint = /entry\s*level|junior|0-1|0-2|0-3/i.test(`${j.title} ${j.description}`) ? '0-1' : null;
        const category = null;
        const url = j.redirect_url;
        const posted_at = j.created ? new Date(j.created).toISOString() : null;
        const scraped_at = new Date().toISOString();
        const description = j.description || null;
        const salary_min = j.salary_min ?? null;
        const salary_max = j.salary_max ?? null;
        const currency = null;
        const visa_tags = null;

        const fingerprint = `${company}|${title}|${location ?? ''}|${url}`.toLowerCase();

        await upsertJob({
          fingerprint,
          source: 'workable', // use any existing enum; treat as external feed
          source_id: j.id ?? null,
          company, title, location, remote,
          employment_type, experience_hint, category,
          url, posted_at, scraped_at,
          description, salary_min, salary_max, currency,
          visa_tags
        });
        inserted++;
      }
    }

    return res.status(200).json({ ok: true, fetched, inserted });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'adzuna fetch error', fetched, inserted });
  }
}
