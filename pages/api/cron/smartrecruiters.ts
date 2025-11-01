import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

type SRPosting = {
  id?: string;
  name?: string; // title
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
  releasedDate?: string; // ISO
  ref?: string;         // url
  applyUrl?: string;    // url
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

  // DB-backed tenants (company slugs)
  const tenants = await listSourcesByType('smartrecruiters');
  const TENANTS = tenants.map(t => ({ company: t.company_name, token: t.token }));
  // Fallback seed (optional)
  if (TENANTS.length === 0) {
    TENANTS.push(
      { company:'NVIDIA', token:'nvidia' },
      { company:'Bosch', token:'boschgroup' }
    );
  }

  let fetched = 0, inserted = 0;

  for (const t of TENANTS) {
    try {
      let offset = 0;
      const limit = 200;
      for (let page=0; page<20; page++) { // up to 4k postings safety cap
        const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(t.token)}/postings?limit=${limit}&offset=${offset}`;
        const r = await fetch(url, { headers: { accept:'application/json' } });
        if (!r.ok) break;
        const j = await r.json();
        const arr: SRPosting[] = Array.isArray(j?.content) ? j.content : (Array.isArray(j?.data) ? j.data : []);

        if (!arr.length) break;

        for (const p of arr) {
          fetched++;
          const title = (p.name || '').trim();
          const locParts = [p.location?.city, p.location?.region, p.location?.country].filter(Boolean);
          const location = locParts.length ? locParts.join(', ') : null;
          const url = p.applyUrl || p.ref || (p.id ? `https://jobs.smartrecruiters.com/${t.token}/${p.id}` : '');
          if (!title || !url) continue;
          if (FILTERED && !roleMatchesWide(title)) continue;

          const fingerprint = createFingerprint(t.token, title, location ?? undefined, url);

          await upsertJob({
            fingerprint,
            source: 'smartrecruiters',
            source_id: p.id || null,
            company: t.company,
            title,
            location,
            remote: Boolean(p.location?.remote) || /remote/i.test(`${title} ${String(location)}`),
            employment_type: null,
            experience_hint: inferExperience(title, undefined),
            category: normalize(null),
            url,
            posted_at: p.releasedDate || null,
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
      console.error('smartrecruiters failed', t.token, e);
    }
  }

  if (debug) console.log(`[CRON] smartrecruiters fetched=${fetched} inserted=${inserted} filtered=${FILTERED}`);
  await recordCronHeartbeat('smartrecruiters', fetched, inserted);
  res.status(200).json({ fetched, inserted, tenants: TENANTS.length, filtered: FILTERED });
}
