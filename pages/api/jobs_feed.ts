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
  const maxAgeDays = Math.max(1, toInt((req.query as any).maxAgeDays, 14));
  const usOnly     = toBool((req.query as any).usOnly);
  const q          = ((req.query as any).q ?? '').toString().trim();
  const roles      = ((req.query as any).roles ?? '').toString().trim(); // "popular" or empty

  // Popular STEM roles (India → USA focus)
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
    // Analyst / PM (tech)
    'business analyst','product manager','technical product manager','salesforce','sap',
    // Robotics/EE/ME
    'robotics','controls','automation','vlsi','asic','fpga','rtl','uvm'
  ];

  const offset = (page - 1) * pageSize;

  // Build WHERE pieces
  const clauses: string[] = [];
  const params: any[] = [];
  // Time window
  params.push(maxAgeDays);
  clauses.push(`COALESCE(posted_at, scraped_at) >= NOW() - ($${params.length} || ' days')::interval`);
  // US only (best-effort via location string)
  if (usOnly) {
    clauses.push(`(location ILIKE '%United States%' OR location ILIKE '%, US%' OR location ILIKE '%, USA%' OR location ILIKE '%, United States%')`);
  }
  // Free text
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(title ILIKE $${params.length} OR company ILIKE $${params.length})`);
  }
  // Popular roles
  if (roles === 'popular') {
    const likeParts = POPULAR.map((k, i) => `title ILIKE $${params.length + i + 1}`);
    for (const k of POPULAR) params.push(`%${k}%`);
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

  const totalRow = await sql.unsafe(countSql, params);
  const total = totalRow.rows[0]?.total ?? 0;

  const listParams = [...params, pageSize, offset];
  const rows = await sql.unsafe(listSql, listParams);

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
