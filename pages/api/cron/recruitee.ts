import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

type RCOffer = {
  id?: number;
  title?: string;
  slug?: string;
  city?: string;
  country?: string;
  updated_at?: string;  // ISO
  created_at?: string;  // ISO
  department?: { name?: string } | null;
  state?: string;       // 'published' etc
};

const isTrue = (v:any)=> String(v ?? '').match(/^(1|true|yes)$/i) !== null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const incomingKey = (req.headers['x-cron-key'] as string) || (req.query?.key as string) || '';
  if (!isVercelCron && process.env.CRON_SECRET && incomingKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok:false, error:'unauthorized' });
  }
  const FILTERED = isTrue((req.query as any)?.filtered);
  const debug    = isTrue((req.query as any)?.debug);

  const subs = await listSourcesByType('recruitee');
  const SUBS = subs.map(s => ({ company: s.company_name, token: s.token }));

  let fetched=0, inserted=0;

  for (const s of SUBS) {
    try {
      const base = `https://${s.token}.recruitee.com/api/offers/`;
      const url = `${base}?limit=1000`;
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const arr: RCOffer[] = Array.isArray(j?.offers) ? j.offers : (Array.isArray(j) ? j : []);

      for (const o of arr) {
        if (o?.state && o.state !== 'published') continue;
        fetched++;
        const title = (o.title || '').trim();
        const city = o.city || '';
        const country = o.country || '';
        const location = [city, country].filter(Boolean).join(', ') || null;
        const slug = o.slug ? o.slug.replace(/^\/+/, '') : '';
        const url = slug ? `https://${s.token}.recruitee.com/o/${slug}` : '';
        if (!title || !url) continue;
        if (FILTERED && !roleMatchesWide(title)) continue;

        const fingerprint = createFingerprint(s.token, title, location ?? undefined, url);

        await upsertJob({
          fingerprint,
          source: 'recruitee',
          source_id: o.id ? String(o.id) : null,
          company: s.company,
          title,
          location,
          remote: /remote/i.test(`${title} ${String(location)}`),
          employment_type: null,
          experience_hint: inferExperience(title, undefined),
          category: normalize(o.department?.name || null),
          url,
          posted_at: o.updated_at || o.created_at || null,
          scraped_at: new Date().toISOString(),
          description: null,
          salary_min: null,
          salary_max: null,
          currency: null,
          visa_tags: null,
        });
        inserted++;
      }
    } catch (e) {
      console.error('recruitee failed', s.token, e);
    }
  }

  if (debug) console.log(`[CRON] recruitee fetched=${fetched} inserted=${inserted} filtered=${FILTERED}`);
  await recordCronHeartbeat('recruitee', fetched, inserted);
  return res.status(200).json({ fetched, inserted, subs: SUBS.length, filtered: FILTERED });
}
