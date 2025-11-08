// pages/api/cron/adzuna.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '@/lib/db';
import { createFingerprint } from '@/lib/fingerprint';
import { inferExperience } from '@/lib/experience';
import { requireCronSecret, endWithHeartbeat } from './_utils';

const COUNTRY = 'us';
const MAX_PAGES = 10;
const RESULTS_PER_PAGE = 50;

async function fetchAdzuna(page: number) {
  const app_id = process.env.ADZUNA_APP_ID!;
  const app_key = process.env.ADZUNA_APP_KEY!;
  if (!app_id || !app_key) throw new Error('Missing ADZUNA creds');

  const what = encodeURIComponent('(new grad OR "new graduate" OR intern OR junior OR "early career" OR "0-5 years")');
  const url =
    `https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search/${page}?app_id=${app_id}&app_key=${app_key}` +
    `&results_per_page=${RESULTS_PER_PAGE}&what=${what}&content-type=application/json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Adzuna ${page} ${r.status}`);
  return r.json() as Promise<{ results: any[] }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireCronSecret(req, res)) return;
  let fetched = 0;
  let inserted = 0;

  try {
    for (let p = 1; p <= MAX_PAGES; p++) {
      const data = await fetchAdzuna(p);
      const rows = data.results || [];
      fetched += rows.length;

      for (const r of rows) {
        const title = r.title || '';
        const company = r.company?.display_name || r.company || '';
        const location = r.location?.display_name || r.location || 'United States';
        const url = r.redirect_url || r.adref || '';
        const posted =
          r.created || r.created_at || r.updated || null;
        const exp = inferExperience(`${title} ${r.description || ''}`);

        const fp = createFingerprint(company, title, location, url, r.id?.toString?.());
        await upsertJob({
          fingerprint: fp,
          source: 'adzuna',
          source_id: r.id?.toString?.() || null,
          company,
          title,
          location,
          remote: /remote/i.test(`${location} ${r.description || ''}`) ? 'true' : null,
          employment_type: r.contract_type || null,
          experience_hint: exp,
          category: r.category?.label || null,
          url,
          posted_at: posted ? new Date(posted).toISOString() : null,
        });
        inserted++;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return endWithHeartbeat(res, 'adzuna', fetched, inserted);
  } catch (e: any) {
    console.error('adzuna cron failed', e);
    return res.status(500).json({ ok: false, error: e?.message || 'adzuna failed', fetched, inserted });
  }
}
