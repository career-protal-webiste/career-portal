// pages/api/cron/workable.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

// Workable subdomains from https://apply.workable.com/<subdomain>/
const SUBDOMAINS = [
  'typeform','hotjar','grammarly','deliveroo','udemy','monday','babbel','camunda','bitpanda','unity'
];

type WorkableJob = {
  title?: string;
  application_url?: string;
  url?: string;
  location?: string;
  updated_at?: string;
  published_at?: string;
  state?: string;
};

type WorkableResp = { jobs?: WorkableJob[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const allowAll = 'all' in (req.query || {}); // /api/cron/workable?all=1 to skip role filtering
  let inserted = 0;

  for (const sub of SUBDOMAINS) {
    try {
      const url = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(sub)}`;
      const resp = await fetch(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;

      const data = (await resp.json()) as WorkableResp;
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

      for (const j of jobs) {
        if (j.state && j.state !== 'published') continue;
        const title = j.title?.trim() || '';
        const location = j.location || null;
        const jobUrl = j.url || j.application_url || '';
        if (!title || !jobUrl) continue;

        if (!allowAll && !roleMatches(title, undefined)) continue;

        const fingerprint = createFingerprint(sub, title, location ?? undefined, jobUrl);

        await upsertJob({
          fingerprint,
          source: 'workable',
          source_id: null,
          company: sub,
          title,
          location,
          remote: /remote/i.test(String(location)) || /remote/i.test(title),
          employment_type: null,
          experience_hint: inferExperience(title),
          category: normalize(null),
          url: jobUrl,
          posted_at: j.updated_at || j.published_at || null,
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
      console.error(`Workable subdomain failed: ${sub}`, err);
    }
  }

  res.status(200).json({ inserted });
}
