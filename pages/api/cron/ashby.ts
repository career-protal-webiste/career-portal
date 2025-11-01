import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { roleMatchesWide } from '../../../lib/filters';
import { listSourcesByType } from '../../../lib/sources';

// Fallback boards (Ashby uses the display name as board token)
const FALLBACK = [
  { company: 'Anthropic', token: 'Anthropic' },
  { company: 'Perplexity', token: 'Perplexity' },
  { company: 'Ramp', token: 'Ramp' },
  { company: 'Mercury', token: 'Mercury' },
  { company: 'Retool', token: 'Retool' },
  { company: 'Linear', token: 'Linear' },
  { company: 'dbt Labs', token: 'dbt Labs' },
  { company: 'Vercel', token: 'Vercel' },
  { company: 'Quora', token: 'Quora' },
  { company: 'Replit', token: 'Replit' },
  { company: 'OpenAI', token: 'OpenAI' },
  { company: 'Glean', token: 'Glean' }
];

type AshbyResp = {
  jobs?: Array<{
    title?: string;
    location?: string;
    isRemote?: boolean;
    publishedAt?: string;
    jobUrl?: string;
    applyUrl?: string;
  }>;
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
  const FILTERED = isTrue((req.query as any)?.filtered);

  const dbBoards = await listSourcesByType('ashby');
  const BOARDS = (dbBoards.length ? dbBoards : FALLBACK).map(b => ({ company: b.company_name, token: b.token }));

  let fetched = 0;
  let inserted = 0;

  for (const b of BOARDS) {
    try {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b.token)}`;
      const resp = await fetch(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;

      const data = (await resp.json()) as AshbyResp;
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

      for (const j of jobs) {
        fetched++;

        const title = (j?.title || '').trim();
        const location = j?.location || null;
        const jobUrl = j?.jobUrl || j?.applyUrl || '';
        if (!title || !jobUrl) continue;
        if (FILTERED && !roleMatchesWide(title)) continue;

        const fingerprint = createFingerprint(b.token, title, location ?? undefined, jobUrl);

        await upsertJob({
          fingerprint,
          source: 'ashby',
          source_id: null,
          company: b.company,
          title,
          location,
          remote: (location || '').toLowerCase().includes('remote') || /remote/i.test(title) || !!j?.isRemote,
          employment_type: null,
          experience_hint: inferExperience(title, undefined),
          category: normalize(null),
          url: jobUrl,
          posted_at: j?.publishedAt ?? null,
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
      console.error(`Ashby failed: ${b.token}`, err);
    }
  }

  if (debug) console.log(`[CRON] ashby fetched=${fetched} inserted=${inserted} filtered=${FILTERED}`);
  await recordCronHeartbeat('ashby', fetched, inserted);
  return res.status(200).json({ fetched, inserted, boards: BOARDS.length, filtered: FILTERED });
}
