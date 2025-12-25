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
      const host    = u.host;                       // nvidia.wd5.myworkdayjobs.com
      const seg     = u.pathname.split('/').filter(Boolean)[0] || ''; // NVIDIA
      const tenant  = (seg || host.split('.')[0]).toLowerCase();      // nvidia
      const siteHint= seg || undefined;
      return { host, tenant, siteHint };
    }
    const parts = tk.split(':'); // host:tenant[:site]
    const host  = parts[0];
    const tenant= (parts[1] || host.split('.')[0]).toLowerCase();
    const siteHint = parts[2] || undefined;
    return { host, tenant, siteHint };
  } catch {
    return null;
  }
}

async function fetchSites(host: string, tenant: string): Promise<string[]> {
  try {
    const url = `https://${host}/wday/cxs/${tenant}/api/worker/v1/data/positions/sites`;
    const r   = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) return [];
    const j   = await r.json();
    const arr: any[] = Array.isArray(j?.data) ? j.data : [];
    const names = arr.map((s: any) => s.siteId).filter((v: any) => typeof v === 'string' && v);
    return names;
  } catch {
    return [];
  }
}

async function fetchJobs(host: string, tenant: string, site: string, offset: number, limit: number): Promise<any[]> {
  const body = JSON.stringify({ appliedFacets: {}, limit, offset, searchText: '' });
  const url  = `https://${host}/wday/cxs/${tenant}/${encodeURIComponent(site)}/jobs`;
  const r    = await fetch(url, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body });
  if (!r.ok) return [];
  const j    = await r.json();
  return Array.isArray(j?.data) ? j.data : [];
}

function getLocation(j: AnyObj): string | null {
  // attempt to read top-level property
  if (j.location) return String(j.location);
  // search nested subtitles for a Location label
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
  // Accept both x-cron-key and x-cron-secret headers and query params
  const incomingKey  =
    (req.headers['x-cron-key'] as string) ||
    (req.headers['x-cron-secret'] as string) ||
    (req.query?.key as string) ||
    (req.query?.secret as string) ||
    '';
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
      let offset  = 0;
      const limit = 50;
      const maxPages = 60; // safety cap (3k postings per site)

      for (let page = 0; page < maxPages; page++) {
        const data = await fetchJobs(host, tenant, site, offset, limit);
        if (!data.length) break;
        for (const j of data) {
          fetched++;

          const title    = j.title || '';
          const location = getLocation(j);
          const url      = pickUrl(host, j);
          const posted   = j.postedDate || j.postedOn || null;
          if (!title || !url) continue;

          // Only filter by role if ?filtered=1 is passed in query
          const filter   = isTrue((req.query as any)?.filtered);
          if (filter && !roleMatchesWide(title)) continue;

          const fingerprint = createFingerprint(host, title, location ?? undefined, url);

          await upsertJob({
            fingerprint,
            source: 'workday',
            source_id: String(j.id || j.uuid || ''),
            company: s.company,
            title,
            location,
            remote: Boolean(/remote/i.test(`${title} ${String(location)}`)),
            employment_type: null,
            experience_hint: inferExperience(title, undefined),
            category: normalize(j.category || null),
            url,
            posted_at: posted ? new Date(posted).toISOString() : null,
            scraped_at: new Date().toISOString(),
            description: null,
            salary_min: null,
            salary_max: null,
            currency: null,
            visa_tags: null,
          });
          inserted++;
        }
        offset += limit;
      }
    }
  }

  if (debug) console.log(`[CRON] workday fetched=${fetched} inserted=${inserted}`);
  await recordCronHeartbeat('workday', fetched, inserted);
  return res.status(200).json({ fetched, inserted, sources: SOURCES.length });
}
