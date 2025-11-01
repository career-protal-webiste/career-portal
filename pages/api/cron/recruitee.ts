import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

// Fallback Recruitee subdomains
const FALLBACK = [
  { company: 'Mollie', token: 'mollie' },
  { company: 'Bunq', token: 'bunq' },
  { company: 'MessageBird', token: 'messagebird' },
  { company: 'Celonis', token: 'celonis' },
  { company: 'Klarna', token: 'klarna' },
  { company: 'Backbase', token: 'backbase' },
  { company: 'GetYourGuide', token: 'getyourguide' },
  { company: 'Wefox', token: 'wefox' },
  { company: 'Treatwell', token: 'treatwell' },
  { company: 'CM.com', token: 'cm.com' }
];

type Offer = {
  title?: string;
  slug?: string;
  created_at?: string;
  updated_at?: string;
  state?: string;
  city?: string;
  country?: string;
  location?: { city?: string; country?: string };
  url?: string;
};
type OffersResp = { offers?: Offer[] };

function buildUrl(sub: string, slug?: string, fallback?: string) {
  if (slug) return `https://${sub}.recruitee.com/o/${slug}`;
  return fallback || `https://${sub}.recruitee.com/`;
}

const isTrue = (v: any) => v === '1' || v === 'true' || v === 'yes' || v === 1 || v === true;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const incomingKey = (req.headers['x-cron-key'] as string) || (req.query?.key as string) || '';
  if (!isVercelCron && process.env.CRON_SECRET && incomingKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const allowAll = 'all' in (req.query || {});
  const debug = isTrue((req.query as any)?.debug);

  // DB-backed subs, fallback if empty
  const dbSubs = await listSourcesByType('recruitee');
  const SUBS = (dbSubs.length ? dbSubs : FALLBACK).map(b => ({ company: b.company_name, token: b.token }));

  let fetched = 0;
  let inserted = 0;

  for (const s of SUBS) {
    try {
      const url = `https://${encodeURIComponent(s.token)}.recruitee.com/api/offers/`;
      const resp = await fetch(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;

      const data = (await resp.json()) as OffersResp;
      const offers = Array.isArray(data?.offers) ? data.offers : [];

      for (const o of offers) {
        fetched++;
        if (o.state && o.state !== 'published') continue;

        const title = (o.title || '').trim();
        const city = o.location?.city || o.city || '';
        const country = o.location?.country || o.country || '';
        const location = [city, country].filter(Boolean).join(', ') || null;
        const jobUrl = buildUrl(s.token, o.slug, o.url);
        if (!title || !jobUrl) continue;
        if (!allowAll && !roleMatchesWide(title)) continue;

        const fingerprint = createFingerprint(s.token, title, location ?? undefined, jobUrl);

        await upsertJob({
          fingerprint,
          source: 'recruitee',
          source_id: o.slug || null,
          company: s.company,
          title,
          location,
          remote: /remote/i.test(`${title} ${String(location)}`),
          employment_type: null,
          experience_hint: inferExperience(title, undefined),
          category: normalize(null),
          url: jobUrl,
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
    } catch (err) {
      console.error(`Recruitee failed: ${s.token}`, err);
    }
  }

  if (debug) console.log(`[CRON] recruitee fetched=${fetched} inserted=${inserted}`);
  await recordCronHeartbeat('recruitee', fetched, inserted);
  return res.status(200).json({ fetched, inserted, subs: SUBS.length });
}
