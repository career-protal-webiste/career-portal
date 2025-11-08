import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint } from '../../../lib/fingerprint';
import { inferExperience } from '../../../lib/experience';
import { requireCronSecret, endWithHeartbeat } from './_utils';

/**
 * Remotive is a free public API for remote jobs. We query it once per run
 * without credentials and filter results to U.S. friendly postings. Only
 * early‑career roles are ingested.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireCronSecret(req, res)) return;
  let fetched = 0;
  let inserted = 0;

  try {
    const r = await fetch('https://remotive.com/api/remote-jobs');
    if (!r.ok) throw new Error(`remotive ${r.status}`);
    const data = (await r.json()) as { jobs?: any[] };
    const rows = data.jobs || [];
    fetched = rows.length;

    for (const j of rows) {
      const title = j.title || '';
      const company = j.company_name || j.company || '';
      const location = j.candidate_required_location || 'Remote';
      // Limit to jobs that explicitly mention the US or North America
      const locLower = location.toLowerCase();
      const isUS = /usa|us\sonly|united states|north america/.test(locLower);
      if (!isUS) continue;
      const url = j.url || j.job_url || '';
      const posted = j.publication_date || j.created_at || null;
      const description = j.description || '';
      const exp = inferExperience(`${title} ${description}`);

      const fp = createFingerprint(company, title, location, url, j.id?.toString?.());
      await upsertJob({
        fingerprint: fp,
        source: 'remotive',
        source_id: j.id?.toString?.() || null,
        company,
        title,
        location,
        remote: 'true',
        employment_type: j.job_type || null,
        experience_hint: exp,
        category: j.category || null,
        url,
        posted_at: posted ? new Date(posted).toISOString() : null,
      });
      inserted++;
    }
    return endWithHeartbeat(res, 'remotive', fetched, inserted);
  } catch (e: any) {
    console.error('remotive cron failed', e);
    return res.status(500).json({ ok: false, error: e?.message || 'remotive failed', fetched, inserted });
  }
}
