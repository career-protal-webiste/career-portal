// pages/api/jobs_feed.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';

function toInt(v: any, def: number) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}
function toBool(v: any) {
  const s = String(v ?? '').toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const page       = Math.max(1, toInt((req.query as any).page, 1));
  const pageSize   = Math.min(200, toInt((req.query as any).pageSize, 50)); // cap 200
  const maxAgeDays = Math.max(1, toInt((req.query as any).maxAgeDays, 60)); // widen default to 60d
  const usOnly     = toBool((req.query as any).usOnly);                     // default off unless caller sets 1
  const q          = ((req.query as any).q ?? '').toString().trim();
  const roles      = ((req.query as any).roles ?? '').toString().trim();    // "" or "popular"

  // STEM-heavy query terms (toggleable)
  const POPULAR = [
    // Software
    'software engineer','backend','front end','frontend','full stack','full-stack','android','ios','platform','distributed',
    // Data
    'data engineer','analytics engineer','etl','elt','snowflake','databricks','airflow','dbt','spark',
    // AI/ML
    'ml engineer','applied scientist','mlops','nlp','computer vision','llm',
    // Cloud/DevOps/SRE
    'devops','sre','site reliability','kubernetes','terraform','aws','azure','gcp','cloud engineer',
    // Security
    'security','soc analyst','iam','grc','threat',
    // QA/Automation
    'qa','sdet','test automation',
    // Analyst / PM
    'business analyst','product manager','technical product manager','salesforce','sap',
    // Robotics/EE/ME
    'robotics','controls','automation','vlsi','asic','fpga','rtl','uvm'
  ];

  const offset = (page - 1) * pageSize;

  // Build WHERE with parameters
  const clauses: string[] = [];
  const params: any[] = [];

  // Recency window (use posted_at if present, otherwise scraped_at)
  params.push(maxAgeDays);
  clauses.push(`COALESCE(posted_at, scraped_at) >= NOW() - ($${params.length} || ' days')::interval`);

  // US-only heuristic:
  //   - remote=true
  //   - "United States"/"USA"/", US"/", USA"
  //   - ends with ", <STATE_ABBR>"
  if (usOnly) {
    clauses.push(`(
      remote = TRUE
      OR location ILIKE '%United States%'
      OR location ILIKE '%USA%'
      OR location ILIKE '%, US%'
      OR location ILIKE '%, USA%'
      OR location ~* ',\\s*(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV)(\\s|$)'
    )`);
  }

  // Free-text title/company search
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(title ILIKE $${params.length} OR company ILIKE $${params.length})`);
  }

  // Popular roles toggle
  if (roles === 'popular') {
    const likeParts: string[] = [];
    for (const k of POPULAR) {
      params.push(`%${k}%`);
      likeParts.push(`title ILIKE $${params.length}`);
    }
    clauses.push(`(${likeParts.join(' OR ')})`);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*)::int AS total FROM jobs ${whereSql}`;
  const listSql =
    `SELECT company, title, source, url, location,
            COALESCE(posted_at, scraped_at) AS when_time
     FROM jobs
     ${whereSql}
     ORDER BY COALESCE(posted_at, scraped_at) DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  const totalRow = await sql.query(countSql, params);
  const total = totalRow.rows[0]?.total ?? 0;

  const listParams = [...params, pageSize, offset];
  const rows = await sql.query(listSql, listParams);

  res.status(200).json({
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    maxAgeDays,
    usOnly,
    q,
    roles,
    results: rows.rows,
  });
}
