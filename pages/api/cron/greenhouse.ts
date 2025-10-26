import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const boards: { company: string; token: string }[] = [
    { company: 'Example Co', token: 'example' },
  ];

  let inserted = 0;
  for (const board of boards) {
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs`);
    if (!response.ok) continue;

    const data = await response.json();
    for (const job of data.jobs) {
      const title: string = job.title;
      if (!roleMatches(title)) continue;

      const fingerprint = createFingerprint('greenhouse', String(job.id), undefined, job.location?.name, job.absolute_url);
      const record = {
        source: 'greenhouse',
        source_id: String(job.id),
        fingerprint,
        company: board.company,
        title,
        location: job.location?.name,
        remote: /remote/i.test(job.location?.name || ''),
        employment_type: undefined,
        experience_hint: inferExperience(title),
        category: normalize(title).category,
        url: job.absolute_url,
        posted_at: new Date(job.updated_at),
        description: undefined,
      };

      await upsertJob(record);
      inserted++;
    }
  }

  res.status(200).json({ inserted });
}
