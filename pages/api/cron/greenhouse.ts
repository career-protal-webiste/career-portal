import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import {
  createFingerprint,
  roleMatches,
  inferExperience,
  normalize,
} from '../../../lib/jobs';

// Use the subdomain of the Greenhouse board (boards.greenhouse.io/<token>)
const BOARDS: { company: string; token: string }[] = [
  { company: 'Stripe',     token: 'stripe' },
  { company: 'Databricks', token: 'databricks' },
  { company: 'Snowflake',  token: 'snowflake' },
  // Add more boards here
];

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  let inserted = 0;

  for (const board of BOARDS) {
    try {
      const response = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs`
      );
      if (!response.ok) continue;

      const data = (await response.json()) as { jobs: any[] };
      for (const job of data.jobs) {
        const title: string = job.title || '';
        const description: string = job.content || '';

        // Check if this job matches one of our role patterns
        if (!roleMatches(title, description)) continue;

        // New fingerprint uses company+title+location+url
        const fingerprint = createFingerprint(
          board.company,
          title,
          job.location?.name,
          job.absolute_url
        );

        const record = {
          source: 'greenhouse',
          source_id: String(job.id),
          fingerprint,
          company: board.company,
          title,
          location: job.location?.name ?? null,
          remote: /remote/i.test(job.location?.name || ''),
          employment_type: null,
          experience_hint: inferExperience(title, description),
          category: normalize(title).category,
          url: job.absolute_url,
          posted_at: new Date(job.updated_at || job.created_at || Date.now()),
          scraped_at: new Date(),
          description: description?.slice(0, 1200) || null,
          salary_min: null,
          salary_max: null,
          currency: null,
          visa_tags: null,
        };

        await upsertJob(record);
        inserted += 1;
      }
    } catch (error) {
      console.error(`Failed to fetch Greenhouse board ${board.token}:`, error);
    }
  }

  res.status(200).json({ inserted });
}
