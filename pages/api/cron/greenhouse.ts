import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

const BOARDS: { company: string; token: string }[] = [
  { company: 'Stripe', token: 'stripe' },
  { company: 'Databricks', token: 'databricks' },
  { company: 'Snowflake', token: 'snowflakeinc' },
  { company: 'Notion', token: 'notion' },
  { company: 'Figma', token: 'figma' },
  { company: 'OpenAI', token: 'openai' },
  { company: 'Plaid', token: 'plaid' },
  { company: 'Cloudflare', token: 'cloudflare' },
  { company: 'Box', token: 'box' },
  { company: 'Atlassian', token: 'atlassian' }
];

type GHJob = {
  id?: number;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  location?: { name?: string };
  departments?: { name?: string }[];
};

const isTrue = (v: any) => v === '1' || v === 'true' || v === 'yes' || v === 1 || v === true;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔐 shared secret (header or ?key=)
  const incomingKey =
    (req.headers['x-cron-key'] as string) ||
    (req.query?.key as string) ||
    '';
  if (process.env.CRON_SECRET && incomingKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const allowAll = 'all' in (req.query || {});
  const debug = isTrue((req.query as any)?.debug);

  let fetched = 0;
  let inserted = 0;

  for (const b of BOARDS) {
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.token)}/jobs`;
      const resp = await fetch(url, { headers: { accept: 'application/json' } });
      if (!resp.ok) continue;

      const json = await resp.json();
      const jobs: GHJob[] = Array.isArray(json?.jobs) ? json.jobs : [];

      for (const j of jobs) {
        fetched++;

        const title = (j.title || '').trim();
        const loc = j.location?.name || null;
        const jobUrl = j.absolute_url || '';
        if (!title || !jobUrl) continue;
        if (!allowAll && !roleMatches(title, undefined)) continue;

        const fingerprint = createFingerprint(b.token, title, loc ?? undefined, jobUrl);

        await upsertJob({
          fingerprint,
          source: 'greenhouse',
          source_id: j.id ? String(j.id) : null,
          company: b.company,
          title,
          location: loc,
          remote: /remote/i.test(String(loc)) || /remote/i.test(title),
          employment_type: null,
          experience_hint: inferExperience(title, undefined),
          category: normalize(j.departments?.[0]?.name || null),
          url: jobUrl,
          posted_at: j.updated_at || null,
          scraped_at: new Date().toISOString(),
          description: null,
          salary_min: null,
          salary_max: null,
          currency: null,
          visa_tags: null,
        });

        inserted++;
      }
    } catch (err) {
      console.error(`Greenhouse failed: ${b.token}`, err);
    }
  }

  if (debug) console.log(`[CRON] greenhouse fetched=${fetched} inserted=${inserted}`);
  return res.status(200).json({ fetched, inserted });
}
