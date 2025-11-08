import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint } from '../../../lib/fingerprint';
import { inferExperience } from '../../../lib/experience';
import { requireCronSecret, endWithHeartbeat } from './_utils';

// Country code for Adzuna API. Using 'us' restricts results to US postings.
const COUNTRY = 'us';
// Number of pages to fetch per run. Each page contains RESULTS_PER_PAGE items.
const MAX_PAGES = 10;
const RESULTS_PER_PAGE = 50;

/**
 * Fetch a single page of results from the Adzuna API. Throws on non‑200 responses.
 */
async function fetchAdzuna(page: number) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) throw new Error('Missing ADZUNA creds');

  // Target roles for interns, new grads and early career. See Adzuna docs for query syntax.
  const what = encodeURIComponent('(new grad OR "new graduate" OR intern OR junior OR "early career" OR "0-5 years")');
  const url =
    `https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search/${page}?app_id=${appId}&app_key=${appKey}` +
    `&results_per_page=${RESULTS_PER_PAGE}&what=${what}&content-type=application/json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Adzuna ${page} ${r.status}`);
  return r.json() as Promise<{ results: any[] }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Authenticate using the cron secret. Abort early on failure.
  if (!requireCronSecret(req, res)) return;
  let fetched = 0;
  let inserted = 0;

  try {
    for (let p = 1; p <= MAX_PAGES; p++) {
      const data = await fetchAdzuna(p);
      const rows = data.results || [];
      fetched += rows.length;

      for (const j of rows) {
        const title = j.title || '';
        const company = j.company?.display_name || j.company || '';
        const location = j.location?.display_name || j.location || 'United States';
        const urlJob = j.redirect_url || j.adref || '';
        const posted = j.created || j.created_at || j.updated || null;
        const description = j.description || '';
        const exp = inferExperience(`${title} ${description}`);

        const fp = createFingerprint(company, title, location, urlJob, j.id?.toString?.());
        await upsertJob({
          fingerprint: fp,
          source: 'adzuna',
          source_id: j.id?.toString?.() || null,
          company,
          title,
          location,
          remote: /remote/i.test(`${location} ${description}`) ? 'true' : null,
          employment_type: j.contract_type || null,
          experience_hint: exp,
          category: j.category?.label || null,
          url: urlJob,
          posted_at: posted ? new Date(posted).toISOString() : null,
        });
        inserted++;
      }
      // Throttle requests to respect API limits
      await new Promise((r) => setTimeout(r, 400));
    }
    return endWithHeartbeat(res, 'adzuna', fetched, inserted);
  } catch (e: any) {
    console.error('adzuna cron failed', e);
    return res.status(500).json({ ok: false, error: e?.message || 'adzuna failed', fetched, inserted });
  }
}
