import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

// Fallback seeds if DB is empty
const FALLBACK: { company: string; token: string }[] = [
  { company: 'Stripe', token: 'stripe' },
  { company: 'Databricks', token: 'databricks' },
  { company: 'Snowflake', token: 'snowflakeinc' },
  { company: 'Notion', token: 'notion' },
  { company: 'Figma', token: 'figma' },
  { company: 'OpenAI', token: 'openai' },
  { company: 'Plaid', token: 'plaid' },
  { company: 'Cloudflare', token: 'cloudflare' },
  { company: 'Box', token: 'box' },
  { company: 'Atlassian', token: 'atlassian' },
  { company: 'Airbnb', token: 'airbnb' },
  { company: 'Shopify', token: 'shopify' },
  { company: 'Robinhood', token: 'robinhood' },
  { company: 'Dropbox', token: 'dropbox' },
  { company: 'Klaviyo', token: 'klaviyo' },
  { company: 'Datadog', token: 'datadog' }
];

type GHJob = {
  id?: number;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  location?: { name?: string };
  departments?: { name?: string }[];
};

function isTrue(v: any) {
  const s = String(v ?? '').toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const incomingKey = (req.headers['x-cron-key'] as string) || (req.query?.key as string) || '';
  if (!isVercelCron && process.env.CRON_SECRET && incomingKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const debug = isTrue((req.query as any)?.debug);
  // NEW: default ingest ALL; only filter if ?filtered=1
  const FILTERED = isTrue((req.query as any)?.filtered);

  // DB-backed sources, fallback if empty
  const dbBoards = await listSourcesByType('greenhouse');
  const BOARDS = (dbBoards.length ? dbBoards : FALLBACK).map(b => ({ company: b.company_name, token: b.token }));

  let fetched = 0;
  let inserted = 0;

  for (const b of BOARDS) {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.token)}/jobs`;
      const resp = await fetch(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;

      const json = await resp.json();
      const jobs: GHJob[] = Array.isArray(json?.jobs) ? json.jobs : [];

      for (const j of jobs) {
        fetched++;

        const title = (j.title || '').trim();
        const loc = j.location?.name || null;
        const jobUrl = j.absolute_url || '';
        if (!title || !jobUrl) continue;
        if (FILTERED && !roleMatchesWide(title)) continue;

        const fingerprint = createFingerprint(b.token, title, loc ?? undefined, jobUrl);

        await upsertJob({
          fingerprint,
          source: 'greenhouse',
          source_id: j.id ? String(j.id) : null,
          company: b.company,
          title,
          location: loc,
          remote: /remote/i.test(`${title} ${String(loc)}`),
          employment_type: null,
          experience_hint: inferExperience(title, undefined),
          category: normalize(j.departments?.[0]?.name || null),
          url: jobUrl,
          posted_at: j.updated_at || null,
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
      console.error(`Greenhouse failed: ${b.token}`, err);
    }
  }

  if (debug) console.log(`[CRON] greenhouse fetched=${fetched} inserted=${inserted} filtered=${FILTERED}`);
  await recordCronHeartbeat('greenhouse', fetched, inserted);
  return res.status(200).json({ fetched, inserted, boards: BOARDS.length, filtered: FILTERED });
}
