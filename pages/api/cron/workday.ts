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
  externalPath?: string;   // /en-US/.../job/...
  id?: string;
};

const truthy = (v:any)=> String(v ?? '').match(/^(1|true|yes)$/i) !== null;
const CANDIDATE_SITES = [
  'External','ExternalCareerSite','Careers','ExternalCareer','External_Career',
  'External-Job-Posting','ExternalSite','USA','US','NorthAmerica','en-US','en-GB'
];

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

  let fetched=0, inserted=0;

  for (const b of BOARDS) {
    try {
      const [host, tenant, siteOrStar] = (b.token || '').split(':');
      if (!host || !tenant) continue;

      const candidates = siteOrStar && siteOrStar !== '*' ? [siteOrStar] : CANDIDATE_SITES;
      let foundAny = false;

      for (const site of candidates) {
        try {
          let offset = 0;
          const limit = 50;
          let localFetched = 0;

          for (let page=0; page<80; page++) { // up to 4k jobs
            const endpoint = `https://${host}/wday/cxs/${encodeURIComponent(tenant)}/${encodeURIComponent(site)}/jobs`;
            const payload = { appliedFacets: {}, limit, offset, searchText: '' };
            const r = await fetch(endpoint, {
              method: 'POST',
              headers: { 'accept':'application/json, text/plain, */*', 'content-type':'application/json' },
              body: JSON.stringify(payload)
            });
            if (!r.ok) break;
            const j = await r.json();
            const arr: WDJob[] = Array.isArray(j?.jobPostings) ? j.jobPostings : [];
            if (!arr.length) break;

            for (const p of arr) {
              fetched++; localFetched++;
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

          if (localFetched > 0) { foundAny = true; break; } // stop trying other sites
        } catch { /* try next candidate */ }
      }
      if (!foundAny && debug) console.log(`workday: no jobs for ${b.token}`);
    } catch (e) {
      console.error('workday failed', b.token, e);
    }
  }

  if (debug) console.log(`[CRON] workday fetched=${fetched} inserted=${inserted} filtered=${FILTERED}`);
  await recordCronHeartbeat('workday', fetched, inserted);
  res.status(200).json({ fetched, inserted, boards: BOARDS.length, filtered: FILTERED });
}
