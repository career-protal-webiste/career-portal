import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

type WDJob = {
  title?: string;
  locationsText?: string;
  postedOn?: string;       // ISO
  externalPath?: string;   // /en-US/xxx/job/...
  id?: string;
};

function truthy(v:any){ const s=String(v??'').toLowerCase(); return s==='1'||s==='true'||s==='yes'; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const incomingKey = (req.headers['x-cron-key'] as string) || (req.query?.key as string) || '';
  if (!isVercelCron && process.env.CRON_SECRET && incomingKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok:false, error:'unauthorized' });
  }

  const debug     = truthy((req.query as any)?.debug);
  const FILTERED  = truthy((req.query as any)?.filtered);

  const rows = await listSourcesByType('workday');
  const BOARDS = rows.map(r => ({ company: r.company_name, token: r.token }));

  // Fallback example (you can delete later)
  if (BOARDS.length === 0) {
    BOARDS.push({ company:'Stripe', token:'stripe.wd5.myworkdayjobs.com:stripe:Stripe' });
  }

  let fetched = 0, inserted = 0;

  for (const b of BOARDS) {
    try {
      const [host, tenant, site] = b.token.split(':');
      if (!host || !tenant || !site) continue;

      let offset = 0;
      const limit = 50;

      for (let page=0; page<60; page++) { // up to 3000 roles
        const endpoint = `https://${host}/wday/cxs/${encodeURIComponent(tenant)}/${encodeURIComponent(site)}/jobs`;
        const payload = {
          appliedFacets: {},
          limit,
          offset,
          searchText: ''
        };
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'accept': 'application/json, text/plain, */*',
            'content-type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!r.ok) break;
        const j = await r.json();
        const arr: WDJob[] = Array.isArray(j?.jobPostings) ? j.jobPostings : [];

        if (!arr.length) break;

        for (const p of arr) {
          fetched++;
          const title = (p.title || '').trim();
          const location = p.locationsText || null;
          const url = p.externalPath ? `https://${host}${p.externalPath}` : '';
          if (!title || !url) continue;
          if (FILTERED && !roleMatchesWide(title)) continue;

          const fingerprint = createFingerprint(tenant, title, location ?? undefined, url);

          await upsertJob({
            fingerprint,
            source: 'workday',
            source_id: p.id || null,
            company: b.company,
            title,
            location,
            remote: /remote/i.test(`${title} ${String(location)}`),
            employment_type: null,
            experience_hint: inferExperience(title, undefined),
            category: normalize(null),
            url,
            posted_at: p.postedOn || null,
            scraped_at: new Date().toISOString(),
            description: null,
            salary_min: null,
            salary_max: null,
            currency: null,
            visa_tags: null,
          });
          inserted++;
        }
        offset += limit;
      }
    } catch (e) {
      console.error('workday failed', b.token, e);
    }
  }

  if (debug) console.log(`[CRON] workday fetched=${fetched} inserted=${inserted} filtered=${FILTERED}`);
  await recordCronHeartbeat('workday', fetched, inserted);
  res.status(200).json({ fetched, inserted, boards: BOARDS.length, filtered: FILTERED });
}
