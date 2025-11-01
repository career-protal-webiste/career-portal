// pages/api/cron/usajobs.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';

type USAJobsItem = {
  MatchedObjectId: string;
  MatchedObjectDescriptor: {
    PositionTitle: string;
    OrganizationName: string;
    PositionLocationDisplay?: string;
    PositionLocation?: { LocationName?: string }[];
    PositionURI: string;
    PublicationStartDate?: string; // ISO
    UserArea?: { Details?: { RemoteIndicator?: boolean } };
    PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; RateIntervalCode?: string; }[];
    QualificationSummary?: string;
    MajorDuties?: string[];
    PositionSchedule?: { Name?: string }[];
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ADMIN_KEY = process.env.ADMIN_KEY || '';
  const providedKey = String(req.query.key ?? req.headers['x-admin-key'] ?? '');
  if (ADMIN_KEY && providedKey !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const email = process.env.USAJOBS_EMAIL;
  const apiKey = process.env.USAJOBS_KEY;
  if (!email || !apiKey) {
    return res.status(400).json({ ok: false, error: 'missing USAJOBS_EMAIL/USAJOBS_KEY' });
  }

  // Filter for early-career SWE/DS/DA roles across the US, last 14 days
  const q = encodeURIComponent('software OR data OR analytics OR engineer OR developer');
  const url = `https://data.usajobs.gov/api/search?Keyword=${q}&DatePosted=14`;

  let fetched = 0, inserted = 0;

  try {
    const r = await fetch(url, {
      headers: {
        'Host': 'data.usajobs.gov',
        'User-Agent': email,
        'Authorization-Key': apiKey,
        'Accept': 'application/json'
      }
    });
    if (!r.ok) throw new Error(`USAJOBS HTTP ${r.status}`);
    const data = await r.json();

    const items: USAJobsItem[] = data?.SearchResult?.SearchResultItems ?? [];
    fetched = items.length;

    for (const it of items) {
      const d = it.MatchedObjectDescriptor;
      const company = (d.OrganizationName ?? 'US Federal').trim();
      const title = (d.PositionTitle ?? 'Job').trim();
      const location =
        d.PositionLocationDisplay ||
        d.PositionLocation?.[0]?.LocationName || 'United States';
      const remote =
        Boolean(d.UserArea?.Details?.RemoteIndicator) ||
        /remote/i.test(`${location} ${d.MajorDuties?.join(' ') || ''}`);

      const employment_type = d.PositionSchedule?.[0]?.Name ?? null;
      const experience_hint = /student|recent\s*grad|intern|trainee|entry/i.test(
        `${d.QualificationSummary || ''} ${title}`
      ) ? '0-1' : null;

      const urlJob = d.PositionURI;
      const posted_at = d.PublicationStartDate ? new Date(d.PublicationStartDate).toISOString() : null;
      const scraped_at = new Date().toISOString();
      const description = d.QualificationSummary || null;

      const salary = d.PositionRemuneration?.[0];
      const salary_min = salary?.MinimumRange ? Number(salary.MinimumRange) : null;
      const salary_max = salary?.MaximumRange ? Number(salary.MaximumRange) : null;
      const currency = 'USD';
      const visa_tags = null;
      const category = 'Government';

      const fingerprint = `${company}|${title}|${location}|${urlJob}`.toLowerCase();

      await upsertJob({
        fingerprint,
        source: 'workday', // re-using enum; gov feed
        source_id: it.MatchedObjectId ?? null,
        company, title, location, remote,
        employment_type, experience_hint, category,
        url: urlJob, posted_at, scraped_at,
        description, salary_min, salary_max, currency,
        visa_tags
      });
      inserted++;
    }

    res.status(200).json({ ok: true, fetched, inserted });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'usajobs fetch error', fetched, inserted });
  }
}
