// pages/api/cron/workday.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertJob } from '../../../lib/db';
import { createFingerprint, inferExperience, normalize } from '../../../lib/jobs';
import { recordCronHeartbeat } from '../../../lib/heartbeat';
import { listSourcesByType } from '../../../lib/sources';

type AnyObj = Record<string, any>;

const FALLBACK = [
  // used only if DB has no workday sources yet
  { company: 'NVIDIA', token: 'https://nvidia.wd5.myworkdayjobs.com/NVIDIA/' },
  { company: 'Adobe',  token: 'https://adobe.wd5.myworkdayjobs.com/Adobe/'  },
];

const isTrue = (v: any) => v === '1' || v === 'true' || v === 'yes' || v === 1 || v === true;

/** Accepts:
 *  - Full URL: https://nvidia.wd5.myworkdayjobs.com/NVIDIA/
 *  - Compact:  nvidia.wd5.myworkdayjobs.com:nvidia[:NVIDIA]
 */
function parseToken(tk: string): { host: string; tenant: string; siteHint?: string } | null {
  try {
    if (/^https?:\/\//i.test(tk)) {
      const u = new URL(tk);
      const host = u.host;                       // nvidia.wd5.myworkdayjobs.com
      const seg  = u.pathname.split('/').filter(Boolean)[0] || ''; // NVIDIA
      const tenant = (seg || host.split('.')[0]).toLowerCase();     // nvidia
      const siteHint = seg || undefined;
      return { host, tenant, siteHint };
    }
    const parts = tk.split(':'); // host:tenant[:site]
    const host = parts[0];
    const tenant = (parts[1] || host.split('.')[0]).toLowerCase();
    const siteHint = parts[2] || undefined;
    return { host, tenant, siteHint };
  } catch {
    return null;
  }
}

async function tryJson(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const r = await fetch(url, init);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchSites(host: string, tenant: string): Promise<string[]> {
  // workday exposes sites here (varies by tenant). Try both shapes.
  const a = await tryJson(`https://${host}/wday/cxs/${tenant}/sites`);
  let sites: string[] = [];
  if (a && Array.isArray(a.sites)) {
    sites = a.sites
      .map((s: any) => (typeof s === 'string' ? s : s?.site || s?.name))
      .filter(Boolean);
  }
  if (sites.length === 0) {
    const b = await tryJson(`https://${host}/wday/cxs/${tenant}/config/sites`);
    if (b && Array.isArray(b.sites)) {
      sites = b.sites
        .map((s: any) => (typeof s === 'string' ? s : s?.site || s?.name))
        .filter(Boolean);
    }
  }
  return [...new Set(sites)];
}

function toIso(x: any): string | null {
  if (!x) return null;
  if (typeof x === 'number') return new Date(x).toISOString();
  const d = new Date(x);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function pickTitle(j: AnyObj): string {
  return j.title?.label || j.title || j.displayJobTitle || j.workerSubType || j.positionTitle || '';
}

function pickLocation(j: AnyObj): string | null {
  if (typeof j.locationsText === 'string' && j.locationsText.trim()) return j.locationsText.trim();
  if (Array.isArray(j.locations)) {
    const t = j.locations.map((x: any) => (x?.label || x)).filter(Boolean).join(', ');
    if (t) return t;
  }
  if (Array.isArray(j.subtitles)) {
    const loc = j.subtitles.find((s: any) => /location/i.test(String(s?.label || '')));
    if (loc?.text) return String(loc.text);
  }
  return null;
}

function pickUrl(host: string, j: AnyObj): string {
  if (j.externalUrl) return j.externalUrl;
  if (j.externalPath) return `https://${host}${j.externalPath}`;
  if (j.postingUrl)   return j.postingUrl;
  return '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const incomingKey  = (req.headers['x-cron-key'] as string) || (req.query?.key as string) || '';
  if (!isVercelCron && process.env.CRON_SECRET && incomingKey !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const debug = isTrue((req.query as any)?.debug);

  // dynamic list from DB
  const dbSources = await listSourcesByType('workday');
  const SOURCES = (dbSources.length ? dbSources : FALLBACK).map(s => ({ company: s.company_name, token: s.token }));

  let fetched = 0;
  let inserted = 0;

  for (const s of SOURCES) {
    const parsed = parseToken(String(s.token));
    if (!parsed) continue;

    const { host, tenant, siteHint } = parsed;
    let sites: string[] = [];

    if (siteHint) sites = [siteHint];
    else sites = await fetchSites(host, tenant);

    // if still empty, try common default (tenant with proper case) and '*' wildcard behavior
    if (sites.length === 0) sites = [tenant.toUpperCase()];

    for (const site of sites) {
      let offset = 0;
      const limit = 50;
      const maxPages = 60; // safety cap (3k/job postings per site)

      for (let page = 0; page < maxPages; page++) {
        const url = `https://${host}/wday/cxs/${tenant}/${encodeURIComponent(site)}/jobs`;
        const body = JSON.stringify({ appliedFacets: {}, limit, offset, searchText: '' });
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'accept': 'application/json' },
          body
        });

        if (!resp.ok) break;
        const json: AnyObj = await resp.json();

        // Newer WD returns `jobPostings`; older sometimes uses `items`
        const rows: AnyObj[] = Array.isArray(json?.jobPostings)
          ? json.jobPostings
          : (Array.isArray(json?.items) ? json.items : []);

        if (!rows.length) break;

        for (const j of rows) {
          const title = String(pickTitle(j) || '').trim();
          const loc   = pickLocation(j);
          const url   = pickUrl(host, j);

          if (!title || !url) continue;

          fetched++;

          const fingerprint = createFingerprint(s.company, title, loc ?? undefined, url);

          await upsertJob({
            fingerprint,
            source: 'workday',
            source_id: j.id ? String(j.id) : null,
            company: s.company,
            title,
            location: loc,
            remote: /remote|anywhere/i.test(`${title} ${loc || ''}`),
            employment_type: null,
            experience_hint: inferExperience(title, undefined),
            category: normalize(j.category || null),
            url,
            posted_at: toIso(j.timePosted) || toIso(j.postedOn) || toIso(j.postedDate) || null,
            scraped_at: new Date().toISOString(),
            description: null,
            salary_min: null,
            salary_max: null,
            currency: null,
            visa_tags: null,
          });

          inserted++;
        }

        if (rows.length < limit) break; // last page
        offset += limit;
      }
    }
  }

  if (debug) console.log(`[CRON] workday fetched=${fetched} inserted=${inserted}`);

  // If your lib/heartbeat CronSource type doesn’t include "workday", the cast avoids a TS error.
  await (recordCronHeartbeat as any)('workday', fetched, inserted);

  res.status(200).json({ fetched, inserted, boards: SOURCES.length, filtered: false });
}
