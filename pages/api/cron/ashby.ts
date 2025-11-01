// pages/api/cron/ashby.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

// Ashby job-board names (final path segment from https://jobs.ashbyhq.com/<BoardName>)
const BOARDS = [
  'Anthropic','Perplexity','Ramp','Mercury','Retool','OpenPhone','Hex','Linear','Tome','dbt Labs','Zip',
  'Sourcegraph','Vercel','Quora','MosaicML','Replit','Pilot','Mux','PostHog','Mux','OpenAI'
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const allowAll = 'all' in (req.query || {}); // /api/cron/ashby?all=1 to skip role filtering
  let inserted = 0;

  for (const board of BOARDS) {
    try {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`;
      const resp = await fetch(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;

      const data = await resp.json();
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

      for (const j of jobs) {
        const title: string = j?.title ?? '';
        const location: string | null = j?.location ?? null;
        const url: string = j?.jobUrl || j?.applyUrl || '';
        if (!title || !url) continue;

        // Basic filtering: keep only relevant roles unless `all=1`
        if (!allowAll && !roleMatches(title, undefined)) continue;

        const fingerprint = createFingerprint(board, title, location ?? undefined, url);

        await upsertJob({
          fingerprint,
          source: 'ashby',
          source_id: null,
          company: board,
          title,
          location,
          remote: (location || '').toLowerCase().includes('remote') || /remote/i.test(title),
          employment_type: null,
          experience_hint: inferExperience(title),
          category: normalize(null),
          url,
          posted_at: j?.publishedAt ?? null,
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
      console.error(`Ashby board failed: ${board}`, err);
    }
  }

  res.status(200).json({ inserted });
}
