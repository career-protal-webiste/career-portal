import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

const COMPANIES = [
  'databricks','snowflake','notion','hubspot','robinhood','niantic','scaleai','chime','doordash',
  'reddit','opendoor','discord','vercel','samsara','ramp','mercury','plaid','stripe','affirm','airtable'
];

type LeverJob = {
  id?: string;
  text?: string;                // title
  hostedUrl?: string;
  createdAt?: number;           // ms
  categories?: { location?: string; team?: string; commitment?: string };
  workplaceType?: string;
};

const isTrue = (v: any) => v === '1' || v === 'true' || v === 'yes' || v === 1 || v === true;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔐 shared secret (header or ?key=)
  const incomingKey =
    (req.headers['x-cron-key'] as string) ||
    (req.query?.key as string) ||
    '';
  if (process.env.CRON_SECRET && incomingKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const allowAll = 'all' in (req.query || {});
  const debug = isTrue((req.query as any)?.debug);

  let fetched = 0;
  let inserted = 0;

  for (const slug of COMPANIES) {
    try {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
      const resp = await fetch(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;

      const jobs = (await resp.json()) as LeverJob[];
      for (const j of jobs) {
        fetched++;

        const title = (j.text || '').trim();
        const loc = j.categories?.location || null;
        const jobUrl = j.hostedUrl || (j.id ? `https://jobs.lever.co/${slug}/${j.id}` : '');
        if (!title || !jobUrl) continue;
        if (!allowAll && !roleMatches(title, undefined)) continue;

        const fingerprint = createFingerprint(slug, title, loc ?? undefined, jobUrl);

        await upsertJob({
          fingerprint,
          source: 'lever',
          source_id: j.id || null,
          company: slug,
          title,
          location: loc,
          remote: (j.workplaceType === 'remote') || /remote/i.test(String(loc)) || /remote/i.test(title),
          employment_type: j.categories?.commitment || null,
          experience_hint: inferExperience(title, undefined),
          category: normalize(j.categories?.team || null),
          url: jobUrl,
          posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
          scraped_at: new Date().toISOString(),
          description: null,
          salary_min: null,
          salary_max: null,
          currency: null,
          visa_tags: null,
        });

        inserted++;
      }
    } catch (err) {
      console.error(`Lever failed: ${slug}`, err);
    }
  }

  if (debug) console.log(`[CRON] lever fetched=${fetched} inserted=${inserted}`);
  return res.status(200).json({ fetched, inserted });
}
