import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

type WBJob = {
  id?: string;
  title?: string;
  department?: string | null;
  url?: string;                 // absolute
  short_url?: string;           // relative
  employment_type?: string | null;
  created_at?: string;          // ISO
  updated_at?: string;          // ISO
  location?: { city?: string; region?: string; country?: string };
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

  const rows = await listSourcesByType('workable');
  const SUBS = rows.map(r => ({ company: r.company_name, token: r.token }));

  let fetched=0, inserted=0;

  for (const s of SUBS) {
    try {
      // Public widget endpoint
      const url = `https://apply.workable.com/api/v1/widget/jobs?company=${encodeURIComponent(s.token)}&limit=1000`;
      const r = await fetch(url, { headers: { accept:'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const arr: WBJob[] = Array.isArray(j?.jobs) ? j.jobs : [];

      for (const p of arr) {
        fetched++;
        const title = (p.title || '').trim();
        const dep = p.department || null;
        const locParts = [p.location?.city, p.location?.region, p.location?.country].filter(Boolean);
        const location = locParts.length ? locParts.join(', ') : null;
        const url = p.url || (p.short_url ? `https://apply.workable.com${p.short_url}` : '');
        if (!title || !url) continue;
        if (FILTERED && !roleMatchesWide(title)) continue;

        const fingerprint = createFingerprint(s.token, title, location ?? undefined, url);

        await upsertJob({
          fingerprint,
          source: 'workable',
          source_id: p.id || null,
          company: s.company,
          title,
          location,
          remote: /remote/i.test(`${title} ${String(location)}`),
          employment_type: p.employment_type || null,
          experience_hint: inferExperience(title, undefined),
          category: normalize(dep),
          url,
          posted_at: p.updated_at || p.created_at || null,
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
      console.error('workable failed', s.token, e);
    }
  }

  if (debug) console.log(`[CRON] workable fetched=${fetched} inserted=${inserted} filtered=${FILTERED}`);
  await recordCronHeartbeat('workable', fetched, inserted);
  return res.status(200).json({ fetched, inserted, subs: SUBS.length, filtered: FILTERED });
}
