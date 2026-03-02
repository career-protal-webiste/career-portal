// pages/api/cron/muse.ts
//
// Scrapes The Muse public jobs API (no API key required).
// Focuses on tech/software roles at US companies.
// Docs: https://www.themuse.com/developers/api/v2
//
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint } from '../../../lib/fingerprint';
import { inferExperience } from '../../../lib/experience';
import { requireCronSecret, endWithHeartbeat } from './_utils';

const BASE = 'https://www.themuse.com/api/public/jobs';
// Categories that map to software/data/ML roles
const CATEGORIES = [
  'Software Engineer',
  'Data Science',
  'Engineering',
  'Data and Analytics',
];
const MAX_PAGES = 5; // 20 results/page → up to 100 per category

type MuseJob = {
  id?: number;
  name?: string;       // title
  short_name?: string;
  contents?: string;   // HTML description
  refs?: { landing_page?: string };
  company?: { name?: string };
  locations?: { name?: string }[];
  levels?: { name?: string; short_name?: string }[];
  categories?: { name?: string }[];
  publication_date?: string;  // ISO8601
};

function pickLevel(levels?: { name?: string; short_name?: string }[]): string | null {
  if (!levels?.length) return null;
  const n = (levels[0]?.name || '').toLowerCase();
  if (/intern/i.test(n))        return 'intern';
  if (/entry|junior|new grad/i.test(n)) return '0-2';
  if (/mid/i.test(n))           return 'junior';
  if (/senior|staff|lead/i.test(n)) return 'senior';
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireCronSecret(req, res)) return;

  let fetched  = 0;
  let inserted = 0;

  try {
    for (const category of CATEGORIES) {
      for (let page = 0; page < MAX_PAGES; page++) {
        const url = `${BASE}?category=${encodeURIComponent(category)}&level=&location=United%20States&page=${page}&descending=true`;
        const r   = await fetch(url, {
          headers: { accept: 'application/json' },
        });
        if (!r.ok) break;

        const data = await r.json() as { results?: MuseJob[]; page_count?: number };
        const jobs: MuseJob[] = data.results ?? [];
        if (!jobs.length) break;

        for (const j of jobs) {
          fetched++;

          const title   = (j.name || '').trim();
          const company = j.company?.name || '';
          const location = j.locations?.[0]?.name || 'United States';
          const url     = j.refs?.landing_page || '';
          const posted  = j.publication_date || null;
          if (!title || !company || !url) continue;
          // Skip jobs with clearly non-US locations
          const locLower = location.toLowerCase();
          if (/\b(uk|united kingdom|canada|australia|india|germany|france|ireland|singapore|japan|europe|apac|emea)\b/.test(locLower)) continue;

          const fp = createFingerprint(company, title, location, url, String(j.id ?? ''));
          await upsertJob({
            fingerprint:     fp,
            source:          'muse',
            source_id:       j.id ? String(j.id) : null,
            company,
            title,
            location,
            remote:          /remote/i.test(location) ? 'true' : null,
            employment_type: null,
            experience_hint: pickLevel(j.levels) ?? inferExperience(title, j.contents),
            category:        j.categories?.[0]?.name ?? null,
            url,
            posted_at:       posted ? new Date(posted).toISOString() : null,
            scraped_at:      new Date().toISOString(),
            description:     null,
            salary_min:      null,
            salary_max:      null,
            currency:        null,
            visa_tags:       null,
          });
          inserted++;
        }

        // Respect rate limit
        await new Promise(r => setTimeout(r, 300));
        if (page >= (data.page_count ?? 0) - 1) break;
      }
    }

    return endWithHeartbeat(res, 'muse', fetched, inserted);
  } catch (e: any) {
    console.error('[CRON] muse failed', e);
    return res.status(500).json({ ok: false, error: e?.message ?? 'muse failed', fetched, inserted });
  }
}
