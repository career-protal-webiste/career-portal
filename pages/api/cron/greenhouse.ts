import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

type GhJob = {
  id: number | string;
  title: string;
  location?: { name?: string };
  absolute_url: string;
  updated_at?: string;
  created_at?: string;
  content?: string;
};

type GhResponse = {
  jobs: GhJob[];
};

// ✅ Put real Greenhouse board tokens here (subdomain part of boards.greenhouse.io/<token>)
const boards: { company: string; token: string }[] = [
  { company: 'Stripe',     token: 'stripe' },
  { company: 'Databricks', token: 'databricks' },
  { company: 'Snowflake',  token: 'snowflake' },
  // add more companies any time
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    let inserted = 0;

    for (const b of boards) {
      const url = `https://boards-api.greenhouse.io/v1/boards/${b.token}/jobs`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;

      const data = (await r.json()) as GhResponse;
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];

      for (const j of jobs) {
        const title = j.title || '';
        if (!roleMatches(title)) continue;

        const locationName = j.location?.name || null;
        const fp = createFingerprint(
          'greenhouse',
          String(j.id),
          undefined,
          locationName || undefined,
          j.absolute_url
        );

        await upsertJob({
          source: 'greenhouse',
          source_id: String(j.id),
          fingerprint: fp,
          company: b.company,
          title,
          location: locationName,
          remote: /remote/i.test(locationName || ''),
          employment_type: null,
          experience_hint: inferExperience(title, j.content),
          category: normalize(title).category,
          url: j.absolute_url,
          posted_at: new Date(j.updated_at || j.created_at || Date.now()),
          description: (j.content || '').slice(0, 1200) || null,
          salary_min: null,
          salary_max: null,
          currency: null,
          visa_tags: null,
        });

        inserted++;
      }
    }

    return res.status(200).json({ inserted });
  } catch (err: any) {
    console.error('Greenhouse cron error:', err?.message || err);
    return res.status(500).json({ error: 'greenhouse_cron_failed' });
  }
}
