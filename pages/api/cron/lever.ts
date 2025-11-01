import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

type LeverJob = {
  id?: string;
  text?: string;                 // title
  hostedUrl?: string;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
  };
  createdAt?: number;            // ms
  updatedAt?: number;            // ms
};

const isTrue = (v: any) => String(v ?? '').match(/^(1|true|yes)$/i) !== null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const incomingKey = (req.headers['x-cron-key'] as string) || (req.query?.key as string) || '';
  if (!isVercelCron && process.env.CRON_SECRET && incomingKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const FILTERED = isTrue((req.query as any)?.filtered);
  const debug    = isTrue((req.query as any)?.debug);

  const rows = await listSourcesByType('lever');
  const TENANTS = rows.map(r => ({ company: r.company_name, token: r.token }));
  let fetched = 0, inserted = 0;

  for (const t of TENANTS) {
    try {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(t.token)}?mode=json`;
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (!r.ok) continue;
      const arr: LeverJob[] = await r.json();
      if (!Array.isArray(arr) || arr.length === 0) continue;

      for (const j of arr) {
        fetched++;
        const title = (j.text || '').trim();
        const location = j.categories?.location || null;
        const url = j.hostedUrl || '';
        if (!title || !url) continue;
        if (FILTERED && !roleMatchesWide(title)) continue;

        const fingerprint = createFingerprint(t.token, title, location ?? undefined, url);

        await upsertJob({
          fingerprint,
          source: 'lever',
          source_id: j.id || null,
          company: t.company,
          title,
          location,
          remote: /remote/i.test(`${title} ${String(location)}`),
          employment_type: j.categories?.commitment || null,
          experience_hint: inferExperience(title, undefined),
          category: normalize(j.categories?.team || null),
          url,
          posted_at: (j.updatedAt || j.createdAt) ? new Date((j.updatedAt || j.createdAt)!).toISOString() : null,
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
      console.error('lever failed', t.token, e);
    }
  }

  if (debug) console.log(`[CRON] lever fetched=${fetched} inserted=${inserted} filtered=${FILTERED}`);
  await recordCronHeartbeat('lever', fetched, inserted);
  return res.status(200).json({ fetched, inserted, tenants: TENANTS.length, filtered: FILTERED });
}
