import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

// Fallback Workable subdomains
const FALLBACK = [
  { company: 'Typeform', token: 'typeform' },
  { company: 'Hotjar', token: 'hotjar' },
  { company: 'Grammarly', token: 'grammarly' },
  { company: 'Monday', token: 'monday' },
  { company: 'Babbel', token: 'babbel' },
  { company: 'Camunda', token: 'camunda' },
  { company: 'Bitpanda', token: 'bitpanda' },
  { company: 'Unity', token: 'unity' },
  { company: 'Aircall', token: 'aircall' },
  { company: 'Preply', token: 'preply' },
  { company: 'Klarna', token: 'klarna' },
  { company: 'Snyk', token: 'snyk' }
];

type WorkableJob = {
  title?: string;
  application_url?: string;
  url?: string;
  location?: string;
  updated_at?: string;
  published_at?: string;
  state?: string;
};
type WorkableResp = { jobs?: WorkableJob[] };

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
  const dbSubs = await listSourcesByType('workable');
  const SUBS = (dbSubs.length ? dbSubs : FALLBACK).map(b => ({ company: b.company_name, token: b.token }));

  let fetched = 0;
  let inserted = 0;

  for (const s of SUBS) {
    try {
      const url = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(s.token)}`;
      const resp = await fetch(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;

      const data = (await resp.json()) as WorkableResp;
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

      for (const j of jobs) {
        fetched++;
        if (j.state && j.state !== 'published') continue;

        const title = (j.title || '').trim();
        const location = j.location || null;
        const jobUrl = j.url || j.application_url || '';
        if (!title || !jobUrl) continue;
        if (!allowAll && !roleMatchesWide(title)) continue;

        const fingerprint = createFingerprint(s.token, title, location ?? undefined, jobUrl);

        await upsertJob({
          fingerprint,
          source: 'workable',
          source_id: null,
          company: s.company,
          title,
          location,
          remote: /remote/i.test(`${title} ${String(location)}`),
          employment_type: null,
          experience_hint: inferExperience(title, undefined),
          category: normalize(null),
          url: jobUrl,
          posted_at: j.updated_at || j.published_at || null,
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
      console.error(`Workable failed: ${s.token}`, err);
    }
  }

  if (debug) console.log(`[CRON] workable fetched=${fetched} inserted=${inserted}`);
  await recordCronHeartbeat('workable', fetched, inserted);
  return res.status(200).json({ fetched, inserted, subs: SUBS.length });
}
