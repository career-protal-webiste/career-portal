// pages/api/cron/recruitee.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

// Recruitee companies from https://<subdomain>.recruitee.com/
const SUBDOMAINS = [
  'mollie','bunq','messagebird','celonis','klarna','backbase','getyourguide','wefox','treatwell','cm.com'
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const allowAll = 'all' in (req.query || {}); // /api/cron/recruitee?all=1
  let inserted = 0;

  for (const sub of SUBDOMAINS) {
    try {
      const url = `https://${encodeURIComponent(sub)}.recruitee.com/api/offers/`;
      const resp = await fetch(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;

      const data = (await resp.json()) as OffersResp;
      const offers = Array.isArray(data?.offers) ? data.offers : [];

      for (const o of offers) {
        if (o.state && o.state !== 'published') continue;

        const title = (o.title || '').trim();
        const city = o.location?.city || o.city || '';
        const country = o.location?.country || o.country || '';
        const location = [city, country].filter(Boolean).join(', ') || null;
        const jobUrl = buildUrl(sub, o.slug, o.url);
        if (!title || !jobUrl) continue;

        if (!allowAll && !roleMatches(title, undefined)) continue;

        const fingerprint = createFingerprint(sub, title, location ?? undefined, jobUrl);

        await upsertJob({
          fingerprint,
          source: 'recruitee',
          source_id: o.slug || null,
          company: sub,
          title,
          location,
          remote: /remote/i.test(String(location)) || /remote/i.test(title),
          employment_type: null,
          // ✅ pass 2nd arg
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

        inserted += 1;
      }
    } catch (err) {
      console.error(`Recruitee company failed: ${sub}`, err);
    }
  }

  res.status(200).json({ inserted });
}
