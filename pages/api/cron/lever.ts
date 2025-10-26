import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const companies = ['databricks','snowflake','notion','hubspot']; // add more
  let inserted = 0;

  for (const company of companies) {
    const response = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`);
    if (!response.ok) continue;

    const postings = await response.json();
    for (const p of postings) {
      const title = p.text || p.title || '';
      if (!roleMatches(title)) continue;

      const fingerprint = createFingerprint('lever', p.id, p.categories?.team, p.categories?.location, p.hostedUrl);
      const job = {
        source: 'lever',
        source_id: p.id,
        fingerprint,
        company: p.categories?.team || p.company || company,
        title,
        location: p.categories?.location,
        remote: /remote/i.test(p.categories?.location || '') || p.workplaceType === 'remote',
        employment_type: p.categories?.commitment,
        experience_hint: inferExperience(title, p.descriptionPlain),
        category: normalize(title).category,
        url: p.hostedUrl,
        posted_at: new Date(p.createdAt),
        description: p.descriptionPlain?.slice(0, 1200),
      };

      await upsertJob(job);
      inserted++;
    }
  }

  res.status(200).json({ inserted });
}
