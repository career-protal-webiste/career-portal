import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, roleMatches, inferExperience, normalize } from '../../../lib/jobs';

// Edit this list anytime
const companies = ['stripe','databricks','snowflake','hubspot','gusto','notion'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    let inserted = 0;

    for (const company of companies) {
      const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;

      const postings: any[] = await r.json();
      for (const p of postings) {
        const title = p?.text || p?.title || '';
        const desc = p?.descriptionPlain || '';
        if (!roleMatches(title, desc)) continue;

        const fp = createFingerprint(
          'lever',
          String(p?.id ?? ''),
          p?.categories?.team ?? company,
          p?.categories?.location ?? '',
          p?.hostedUrl ?? ''
        );

        await upsertJob({
          source: 'lever',
          source_id: String(p?.id ?? ''),
          fingerprint: fp,
          company: p?.categories?.team || company,
          title,
          location: p?.categories?.location ?? null,
          remote: /remote/i.test(p?.categories?.location ?? ''),
          employment_type: p?.categories?.commitment ?? null,
          experience_hint: inferExperience(title, desc),
          category: normalize(title).category,
          url: p?.hostedUrl ?? '',
          posted_at: new Date(p?.createdAt || Date.now()),
          description: desc?.slice(0, 1200) || null
        });

        inserted++;
      }
    }

    return res.status(200).json({ inserted });
  } catch (err: any) {
    console.error('Lever cron error:', err?.message || err);
    return res.status(500).json({ error: 'lever_cron_failed' });
  }
}
