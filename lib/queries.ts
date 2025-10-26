// lib/queries.ts
import { sql } from '@vercel/postgres';

export type JobRow = {
  fingerprint: string;
  source: string | null;
  source_id: string | null;
  company: string | null;
  title: string | null;
  location: string | null;
  remote: boolean | string | null;
  employment_type: string | null;
  experience_hint: string | null;
  category: string | null;
  url: string | null;
  posted_at: string | null;   // ISO
  scraped_at: string | null;  // ISO
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  visa_tags: string[] | null;
};

// ---------- utils
function toISO(v: unknown) {
  if (v == null) return null;
  const d = typeof v === 'string' ? new Date(v) : (v as Date);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function normalizeDates<T extends { posted_at: any; scraped_at: any }>(r: T) {
  return { ...r, posted_at: toISO(r.posted_at), scraped_at: toISO(r.scraped_at) } as any;
}
const lc = (s?: string | null) => (s ?? '').toLowerCase();
const text = (j: JobRow) =>
  `${lc(j.title)} ${lc(j.company)} ${lc(j.location)} ${lc(j.category)} ${lc(j.description)}`.trim();

function postedWithin(job: JobRow, hours: number | null) {
  if (!hours) return true;
  if (!job.posted_at) return false;
  const now = Date.now();
  const ts = new Date(job.posted_at).getTime();
  return now - ts <= hours * 3600_000;
}

function isRemote(job: JobRow) {
  if (job.remote === true || lc(String(job.remote)) === 'true') return true;
  const t = text(job);
  return /\bremote\b/.test(t);
}

const US_HINTS = [
  'united states', 'usa', 'u.s.', 'u.s.a', 'us,', ', us', ' ny', ' ca,', ' ca)', // simple hints
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy'
];
function isUS(job: JobRow) {
  const L = lc(job.location);
  return !!US_HINTS.find(h => L.includes(` ${h}`) || L.startsWith(h) || L.endsWith(h));
}

function roleMatch(role: string, job: JobRow) {
  if (!role) return true;
  const t = text(job);

  const dict: Record<string, RegExp[]> = {
    analyst: [/\banalyst\b/, /\banalytics?\b/, /\bbi analyst\b/, /\boperations analyst\b/],
    sde: [
      /\bsoftware (engineer|developer)\b/, /\bfull[- ]?stack\b/, /\bbackend\b/, /\bfront[- ]?end\b/,
      /\bmobile\b/, /\bios\b/, /\bandroid\b/
    ],
    'data-scientist': [/\bdata scientist\b/, /\bml (engineer|scientist)\b/, /\bmachine learning\b/],
    'data-engineer': [/\bdata engineer\b/, /\betl\b/, /\bdata pipeline\b/, /\bdbt\b/, /\bwarehouse\b/],
    'product-manager': [/\bproduct manager\b/, /\bpm\b/, /\bproduct management\b/],
  };

  const rules = dict[role] || [];
  return rules.some(r => r.test(t));
}

function withinMaxYears(job: JobRow, maxYears: number | null) {
  if (!maxYears) return true;
  // Heuristic: exclude very senior titles for ≤5 yrs focus
  const t = text(job);
  const seniorish = /(principal|staff|lead|manager|director|sr\.?|senior)/i;
  return !seniorish.test(t);
}

// ---------- core queries
export async function listJobs(limit = 200): Promise<JobRow[]> {
  const { rows } = await sql<JobRow>`
    SELECT
      fingerprint, source, source_id, company, title, location, remote,
      employment_type, experience_hint, category, url,
      posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
    FROM jobs
    ORDER BY posted_at DESC NULLS LAST, scraped_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return rows.map(normalizeDates);
}

export async function getJobById(id: string): Promise<JobRow | null> {
  const { rows } = await sql<JobRow>`
    SELECT
      fingerprint, source, source_id, company, title, location, remote,
      employment_type, experience_hint, category, url,
      posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
    FROM jobs
    WHERE fingerprint = ${id}
    LIMIT 1
  `;
  return rows[0] ? normalizeDates(rows[0]) : null;
}

// alias kept for the detail page import
export async function getJobByFingerprint(fingerprint: string) {
  return getJobById(fingerprint);
}

export async function listSimilar(job: JobRow, limit = 6): Promise<JobRow[]> {
  if (job.company) {
    const r1 = await sql<JobRow>`
      SELECT fingerprint, source, source_id, company, title, location, remote,
             employment_type, experience_hint, category, url,
             posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
      FROM jobs
      WHERE company = ${job.company} AND fingerprint <> ${job.fingerprint}
      ORDER BY posted_at DESC NULLS LAST, scraped_at DESC NULLS LAST
      LIMIT ${limit}
    `;
    if (r1.rows.length) return r1.rows.map(normalizeDates);
  }
  const r2 = await sql<JobRow>`
    SELECT fingerprint, source, source_id, company, title, location, remote,
           employment_type, experience_hint, category, url,
           posted_at, scraped_at, description, salary_min, salary_max, currency, visa_tags
    FROM jobs
    WHERE fingerprint <> ${job.fingerprint}
    ORDER BY posted_at DESC NULLS LAST, scraped_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return r2.rows.map(normalizeDates);
}

// ---------- in-memory filtering (simple & safe)
export type FilterOptions = {
  q?: string;
  role?: 'analyst' | 'sde' | 'data-scientist' | 'data-engineer' | 'product-manager' | '';
  sinceHours?: number | null;   // e.g. 1, 24, 72
  remoteOnly?: boolean;
  usOnly?: boolean;
  maxYears?: number | null;     // e.g. 5
  limit?: number;               // cap after filtering
};

export async function listFilteredJobs(opts: FilterOptions): Promise<JobRow[]> {
  const { q = '', role = '', sinceHours = null, remoteOnly = false, usOnly = false, maxYears = null, limit = 120 } = opts;
  const seed = await listJobs(500);
  const qNorm = q.trim().toLowerCase();

  const out = seed.filter(j => {
    if (qNorm) {
      const hay = text(j);
      if (!hay.includes(qNorm)) return false;
    }
    if (!roleMatch(role, j)) return false;
    if (!postedWithin(j, sinceHours)) return false;
    if (remoteOnly && !isRemote(j)) return false;
    if (usOnly && !isUS(j)) return false;
    if (!withinMaxYears(j, maxYears)) return false;
    return true;
  });

  return out.slice(0, limit);
}
