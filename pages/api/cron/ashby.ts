// pages/api/cron/ashby.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

// Ashby job-board names (final path segment from https://jobs.ashbyhq.com/<BoardName>)
const BOARDS = [
  'Anthropic','Perplexity','Ramp','Mercury','Retool','OpenPhone','Hex','Linear','Tome','dbt Labs','Zip',
  'Sourcegraph','Vercel','Quora','Replit','Pilot','Mux','PostHog','OpenAI'
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

const isTrue = (v: any) => v === '1' || v === 'true' || v === 'yes' || v === 1 || v === true;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const allowAll = 'all' in (req.query || {});
  const debug = isTrue((req.query as any)?.debug);
  let fetched = 0;
  let inserted = 0;

  for (const board of BOARDS) {
    try {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`;
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
        if (!allowAll && !roleMatches(title, undefined)) continue;

        const fingerprint = createFingerprint(board, title, location ?? undefined, jobUrl);

        await upsertJob({
          fingerprint,
          source: 'ashby',
          source_id: null,
          company: board,
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
      console.error(`Ashby board failed: ${board}`, err);
    }
  }

  if (debug) console.log(`[CRON] ashby fetched=${fetched} inserted=${inserted}`);
  return res.status(200).json({ fetched, inserted });
}
