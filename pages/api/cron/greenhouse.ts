import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob, ensureSchema } from '../../../lib/db';
import {
  createFingerprint,
  roleMatches,
  inferExperience,
  normalize,
} from '../../../lib/jobs';

// boards.greenhouse.io/<token>
const BOARDS: { company: string; token: string }[] = [
  { company: 'Stripe',     token: 'stripe' },
  { company: 'Databricks', token: 'databricks' },
  { company: 'Snowflake',  token: 'snowflake' },
  // add more here
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const insertAll = String(req.query.all || '') === '1';

  await ensureSchema();

  let scanned = 0;
  let matched = 0;
  let inserted = 0;

  for (const board of BOARDS) {
    try {
      const response = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs`
      );
      if (!response.ok) continue;

      const data = (await response.json()) as { jobs: any[] };
      for (const job of data.jobs || []) {
        scanned++;

        const title = job.title || '';
        const description = job.content || '';
        const locationName =
          job.location?.name ||
          job.locations?.[0]?.name ||
          job.offices?.[0]?.name ||
          null;

        const isMatch = insertAll || roleMatches(title, description);
        if (!isMatch) continue;
        matched++;

        const fp = createFingerprint(
          board.company,
          title,
          locationName || undefined,
          job.absolute_url || ''
        );

        const record = {
          source: 'greenhouse',
          source_id: String(job.id),
          fingerprint: fp,
          company: board.company,
          title,
          location: locationName,
          remote: /remote/i.test(locationName || ''),
          employment_type: null,
          experience_hint: inferExperience(title, description),
          category: normalize(title).category,
          url: job.absolute_url,
          posted_at: job.updated_at ? new Date(job.updated_at) : null,
          scraped_at: new Date(),
          description: description ? description.slice(0, 1200) : null,
          salary_min: null,
          salary_max: null,
          currency: null,
          visa_tags: null,
        } as const;

        await upsertJob(record);
        inserted++;
      }
    } catch (error) {
      console.error(
        `Failed to fetch Greenhouse board ${board.token}:`,
        error
      );
    }
  }

  res.status(200).json({ scanned, matched, inserted, debug_all: insertAll });
}
