import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

// Fallback Lever tenants (safe to keep; non-existent slugs are skipped)
const FALLBACK = [
  { company: 'Databricks', token: 'databricks' },
  { company: 'Scale AI', token: 'scaleai' },
  { company: 'Ramp', token: 'ramp' },
  { company: 'Mercury', token: 'mercury' },
  { company: 'Brex', token: 'brex' },
  { company: 'Samsara', token: 'samsara' },
  { company: 'Airtable', token: 'airtable' },
  { company: 'Figma', token: 'figma' },
  { company: 'Mixpanel', token: 'mixpanel' },
  { company: 'PostHog', token: 'posthog' },
  { company: 'Pilot', token: 'pilot' },
  { company: 'Mux', token: 'mux' },
  { company: 'Retool', token: 'retool' },
  { company: 'Sourcegraph', token: 'sourcegraph' },
  { company: 'OpenPhone', token: 'openphone' },
  { company: 'Linear', token: 'linear' },
  { company: 'Hex', token: 'hex' },
  { company: 'Vercel', token: 'vercel' },
  { company: 'Quora', token: 'quora' },
  { company: 'Replit', token: 'replit' },
  { company: 'Stripe', token: 'stripe' }
];

type LeverJob = {
  id?: string;
  text?: string; // title
  hostedUrl?: string;
  createdAt?: number; // ms
  categories?: { location?: string; team?: string; commitment?: string };
  workplaceType?: string;
};

const isTrue = (v: any) => v === '1' || v === 'true' || v === 'yes' || v === 1 || v === true;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const incomingKey = (req.headers['x-cron-key'] as string) || (req.query?.key as string) || '';
  if (!isVercelCron && process.env.CRON_SECRET && incomingKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const allowAll = 'all' in (req.query || {});
  const debug = isTrue((req.query as any)?.debug);

  // DB-backed sources, fallback if empty
  const dbTenants = await listSourcesByType('lever');
  const TENANTS = (dbTenants.length ? dbTenants : FALLBACK).map(b => ({ company: b.company_name, token: b.token }));

  let fetched = 0;
  let inserted = 0;

  for (const t of TENANTS) {
    try {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(t.token)}?mode=json`;
      const resp = await fetch(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;

      const jobs = (await resp.json()) as LeverJob[];
      for (const j of jobs) {
        fetched++;

        const title = (j.text || '').trim();
        const loc = j.categories?.location || null;
        const jobUrl = j.hostedUrl || (j.id ? `https://jobs.lever.co/${t.token}/${j.id}` : '');
        if (!title || !jobUrl) continue;
        if (!allowAll && !roleMatchesWide(title)) continue;

        const fingerprint = createFingerprint(t.token, title, loc ?? undefined, jobUrl);

        await upsertJob({
          fingerprint,
          source: 'lever',
          source_id: j.id || null,
          company: t.company,
          title,
          location: loc,
          remote: (j.workplaceType === 'remote') || /remote/i.test(`${title} ${String(loc)}`),
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
      console.error(`Lever failed: ${t.token}`, err);
    }
  }

  if (debug) console.log(`[CRON] lever fetched=${fetched} inserted=${inserted}`);
  await recordCronHeartbeat('lever', fetched, inserted);
  return res.status(200).json({ fetched, inserted, tenants: TENANTS.length });
}
