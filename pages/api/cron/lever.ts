import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import {
  createFingerprint,
  roleMatches,
  inferExperience,
  normalize,
} from '../../../lib/jobs';

// Add or remove companies as needed.
const COMPANIES = ['databricks', 'snowflake', 'notion', 'hubspot'];

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  let inserted = 0;

  for (const company of COMPANIES) {
    try {
      const response = await fetch(
        `https://api.lever.co/v0/postings/${company}?mode=json`
      );
      if (!response.ok) continue;

      const postings = (await response.json()) as any[];
      for (const posting of postings) {
        const title = posting.text || posting.title || '';
        const description = posting.descriptionPlain || '';
        // Check if this is a role we care about
        if (!roleMatches(title, description)) continue;

        // Use company+title+location+url for deduplication
        const fingerprint = createFingerprint(
          posting.categories?.team || posting.company || company,
          title,
          posting.categories?.location,
          posting.hostedUrl
        );

        const job = {
          source: 'lever',
          source_id: String(posting.id),
          fingerprint,
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
          posted_at: new Date(posting.createdAt),
          scraped_at: new Date(),
          description: description?.slice(0, 1200) || null,
          salary_min: posting.salaryRange?.min ?? null,
          salary_max: posting.salaryRange?.max ?? null,
          currency: posting.salaryRange?.currency ?? null,
          visa_tags: posting.tags?.filter((t: string) => /visa/i.test(t)) ?? null,
        };

        await upsertJob(job);
        inserted += 1;
      }
    } catch (error) {
      console.error(`Failed to fetch Lever postings for ${company}:`, error);
    }
  }

  res.status(200).json({ inserted });
}
