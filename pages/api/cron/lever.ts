import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob, ensureSchema } from '../../../lib/db';
import {
  createFingerprint,
  roleMatches,
  inferExperience,
  normalize,
} from '../../../lib/jobs';

// Edit this list freely.
const COMPANIES = ['databricks', 'snowflake', 'notion', 'hubspot'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // If you open /api/cron/lever?all=1 it will bypass filtering for debug.
  const insertAll = String(req.query.all || '') === '1';

  await ensureSchema();

  let scanned = 0;
  let matched = 0;
  let inserted = 0;

  for (const company of COMPANIES) {
    try {
      const response = await fetch(
        `https://api.lever.co/v0/postings/${company}?mode=json`
      );
      if (!response.ok) continue;

      const postings = (await response.json()) as any[];
      for (const posting of postings) {
        scanned++;

        const title = posting.text || posting.title || '';
        const description = posting.descriptionPlain || '';
        const isMatch = insertAll || roleMatches(title, description);
        if (!isMatch) continue;
        matched++;

        const fp = createFingerprint(
          posting.categories?.team || posting.company || company,
          title,
          posting.categories?.location,
          posting.hostedUrl
        );

        const job = {
          source: 'lever',
          source_id: String(posting.id),
          fingerprint: fp,
          company: posting.categories?.team || posting.company || company,
          title,
          location: posting.categories?.location ?? null,
          remote:
            /remote/i.test(posting.categories?.location || '') ||
            posting.workplaceType === 'remote',
          employment_type: posting.categories?.commitment ?? null,
          experience_hint: inferExperience(title, description),
          category: normalize(title).category,
          url: posting.hostedUrl,
          posted_at: posting.createdAt ? new Date(posting.createdAt) : null,
          scraped_at: new Date(),
          description: description ? description.slice(0, 1200) : null,
          salary_min: posting.salaryRange?.min ?? null,
          salary_max: posting.salaryRange?.max ?? null,
          currency: posting.salaryRange?.currency ?? null,
          visa_tags: Array.isArray(posting.tags)
            ? posting.tags.filter((t: string) => /visa/i.test(t)) ?? null
            : null,
        } as const;

        await upsertJob(job);
        inserted++;
      }
    } catch (error) {
      console.error(`Failed to fetch Lever postings for ${company}:`, error);
    }
  }

  res.status(200).json({ scanned, matched, inserted, debug_all: insertAll });
}
