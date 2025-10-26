// pages/api/cron/lever.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

const COMPANIES = ['databricks', 'snowflake', 'notion', 'hubspot']; // edit as you like

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const allowAll = 'all' in (_req.query || {}); // /api/cron/lever?all=1 to skip filtering
  let inserted = 0;

  for (const company of COMPANIES) {
    try {
      const response = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`);
      if (!response.ok) continue;

      const postings = (await response.json()) as any[];

      for (const posting of postings) {
        const title = posting.text || '';
        const description = posting.descriptionPlain || '';

        if (!allowAll && !roleMatches(title, description)) continue;

        const companyName = posting.categories?.team || posting.company || company;
        const locationName = posting.categories?.location ?? null;

        const fingerprint = createFingerprint(
          companyName,
          title,
          locationName ?? undefined,
          posting.hostedUrl
        );

        await upsertJob({
          fingerprint,
          source: 'lever',
          source_id: String(posting.id),
          company: companyName,
          title,
          location: locationName,
          remote:
            /remote/i.test(posting.categories?.location || '') ||
            posting.workplaceType === 'remote',
          employment_type: posting.categories?.commitment ?? null,
          experience_hint: inferExperience(title, description),
          category: normalize(posting.categories?.team),
          url: posting.hostedUrl,
          posted_at: posting.createdAt ? new Date(posting.createdAt) : null,
          scraped_at: new Date(),
          description,
          salary_min: posting.salaryRange2?.min ?? null,
          salary_max: posting.salaryRange2?.max ?? null,
          currency: posting.salaryRange2?.currency ?? null,
          visa_tags: posting.tags?.filter((t: string) => /visa/i.test(t)) ?? null,
        });

        inserted += 1;
      }
    } catch (error) {
      console.error(`Failed to fetch Lever postings for ${company}:`, error);
    }
  }

  res.status(200).json({ inserted });
}
