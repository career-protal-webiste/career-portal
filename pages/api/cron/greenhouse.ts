// pages/api/cron/greenhouse.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

// Subdomain tokens from https://boards.greenhouse.io/<token>
const BOARDS: { company: string; token: string }[] = [
  { company: 'Stripe', token: 'stripe' },
  { company: 'Databricks', token: 'databricks' },
  { company: 'Snowflake', token: 'snowflake' },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const allowAll = 'all' in (req.query || {}); // /api/cron/greenhouse?all=1
  let inserted = 0;

  for (const board of BOARDS) {
    try {
      const response = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs`
      );
      if (!response.ok) continue;

      const data = (await response.json()) as { jobs: any[] };
      for (const job of data.jobs) {
        const title = job.title || '';
        const description = ''; // lightweight pass (detail endpoint is separate)
        if (!allowAll && !roleMatches(title, description)) continue;

        const locationName: string | null = job.location?.name ?? null;

        const fingerprint = createFingerprint(
          board.company,
          title,
          locationName ?? undefined,
          job.absolute_url || ''
        );

        await upsertJob({
          fingerprint,
          source: 'greenhouse',
          source_id: String(job.id),
          company: board.company,
          title,
          location: locationName,
          remote: /remote/i.test(locationName || ''),
          employment_type: null,
          experience_hint: inferExperience(title, description),
          category: normalize(job?.metadata?.category ?? job?.department?.name ?? null),
          url: job.absolute_url,
          posted_at: job.updated_at ? new Date(job.updated_at) : job.created_at ? new Date(job.created_at) : null,
          scraped_at: new Date(),
          description: null,
          salary_min: null,
          salary_max: null,
          currency: null,
          visa_tags: null,
        });

        inserted += 1;
      }
    } catch (error) {
      console.error(`Failed to fetch Greenhouse board ${board.token}:`, error);
    }
  }

  res.status(200).json({ inserted });
}
