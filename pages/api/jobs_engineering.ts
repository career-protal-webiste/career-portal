// pages/api/jobs_engineering.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';

/**
 * Engineering streams covered:
 * - Software / Systems / Platform / SRE / DevOps / Cloud
 * - Data / Analytics / AI / ML / MLOps
 * - Cybersecurity / SOC / IAM / GRC
 * - QA / Test / SDET
 * - Embedded / Firmware / Hardware / ASIC / FPGA / RTL / Verification
 * - Electrical / Electronics / Power
 * - Mechanical / Industrial / Manufacturing / Process / Quality / CAD / FEA / CFD / Mechatronics
 * - Civil / Structural
 * - Robotics / Aerospace
 * - Chemical / Biomedical / Bioengineering / Materials
 */

const US_STATE_RE =
  '(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)';

const ROLE_KEYWORDS = [
  // Software / Systems / Cloud
  'software engineer','software developer','backend','frontend','full[- ]stack','mobile','ios','android',
  'platform engineer','systems engineer','site reliability','sre','devops','cloud engineer','aws','azure','gcp','kubernetes',
  // Data / AI
  'data engineer','analytics engineer','data analyst','business intelligence','bi developer','etl','sql',
  'machine learning','ml engineer','mlops','ai engineer','nlp','computer vision','data scientist',
  // Cyber / Security
  'security engineer','security analyst','soc analyst','iam','grc','application security','cloud security',
  // QA / Test
  'qa engineer','quality assurance','test automation','sdet','quality engineer',
  // Embedded / Hardware / EDA
  'embedded engineer','firmware','embedded systems','dsp','fpga','rtl','asic','verification','board design','hardware engineer',
  // Electrical / Electronics / Power
  'electrical engineer','electronics engineer','power electronics','analog','digital design',
  // Mechanical / Industrial / Manufacturing
  'mechanical engineer','industrial engineer','manufacturing engineer','mechatronics','process engineer',
  'quality engineer','reliability engineer','cad','solidworks','autocad','fe[am]','cfd',
  // Civil / Structural
  'civil engineer','structural engineer',
  // Robotics / Aero
  'robotics','aerospace engineer','controls engineer',
  // Chemical / Biomedical / Materials
  'chemical engineer','biomedical engineer','bioengineer','materials engineer','material science'
];

const EXCLUDE_SENIOR = [
  // We want roles up to ~5 years; exclude clearly senior/leadership titles
  'senior','sr\\.', 'staff','principal','lead','architect','manager','director','head of','vp','chief'
];

// Optionally use experience_hint if present to bias to <=5y (but don't hard require)
const EXP_HINT_ACCEPT = ['0-1','1-2','1-3','2-4','3-5','0-5','0–1','1–3','3–5','junior','associate','mid'];

function buildRegex(parts: string[]) {
  return `(${parts.join('|')})`;
}
function intClamp(v: any, def: number, min: number, max: number) {
  const n = parseInt(String(v ?? ''), 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Defaults: US-only, last 7 days, 25 per page
    const pageSize = intClamp(req.query.pageSize, 25, 1, 50);
    const page = intClamp(req.query.page, 1, 1, 100000);
    const q = (req.query.q as string) || '';
    const maxAgeDays = intClamp(req.query.maxAgeDays, 7, 1, 30); // broaden to 7 days by default
    const sourcesCsv = (req.query.sources as string) || '';
    const sources = sourcesCsv.split(',').map(s => s.trim()).filter(Boolean);

    const params: any[] = [];
    const where: string[] = [];

    // Recency: by posted_at or scraped_at
    params.push(maxAgeDays);
    where.push(`COALESCE(posted_at, scraped_at) >= NOW() - ($${params.length}::int || ' days')::interval`);

    // US-only (location/title mention US or a state code, or Remote+US mention)
    where.push(`(
      location ~* '\\m${US_STATE_RE}\\M'
      OR location ILIKE '%United States%'
      OR location ILIKE '%USA%'
      OR location ILIKE '% U.S.%'
      OR title ILIKE '%United States%'
      OR title ILIKE '% US %'
      OR (remote = true AND (title ILIKE '% US%' OR location ILIKE '%US%'))
    )`);

    // Exclude clearly senior/leadership titles
    const excludeRe = buildRegex(EXCLUDE_SENIOR);
    where.push(`NOT (title ~* '${excludeRe}')`);

    // Engineering role keywords
    const rolesRe = buildRegex(ROLE_KEYWORDS);
    where.push(`(title ~* '${rolesRe}')`);

    // If experience_hint exists, prefer <=5y; if null, still include (we rely on title filter above)
    const expRe = buildRegex(EXP_HINT_ACCEPT);
    where.push(`(experience_hint IS NULL OR experience_hint ~* '${expRe}')`);

    // Optional free-text query across title/company
    if (q) {
      params.push(`%${q}%`);
      where.push(`(title ILIKE $${params.length} OR company ILIKE $${params.length})`);
    }

    // Optional source filter
    if (sources.length > 0) {
      params.push(sources);
      where.push(`source = ANY($${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    // NOTE: change "jobs" if your table name differs
    const list = await sql/* sql */`
      SELECT
        fingerprint, source, company, title, location, remote,
        employment_type, experience_hint, category, url,
        posted_at, scraped_at, salary_min, salary_max, currency, visa_tags
      FROM jobs
      ${whereSql}
      ORDER BY COALESCE(posted_at, scraped_at) DESC
      LIMIT ${pageSize} OFFSET ${offset};
    `;

    const count = await sql/* sql */`
      SELECT COUNT(*)::int AS c
      FROM jobs
      ${whereSql};
    `;

    const total = count.rows?.[0]?.c ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    res.status(200).json({
      ok: true,
      page,
      pageSize,
      total,
      totalPages,
      maxAgeDays,
      items: list.rows ?? [],
    });
  } catch (err: any) {
    console.error('jobs_engineering error', err);
    res.status(500).json({ ok: false, error: err?.message || 'server error' });
  }
}
