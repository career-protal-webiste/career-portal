// pages/api/jobs_feed.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';
import { patternsForRolesCsv } from '../../lib/filters';

type JobRow = {
  company: string;
  title: string;
  source: string;
  url: string;
  location: string | null;
  when_time: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const pageSize = Math.min(100, Math.max(10, parseInt((req.query.pageSize as string) || '100', 10)));
    const offset = (page - 1) * pageSize;

    const q = (req.query.q as string) || '';
    const usOnly = String(req.query.usOnly || '0') === '1';
    const maxAgeDays = Math.max(1, parseInt((req.query.maxAgeDays as string) || '60', 10));
    const rolesCsv = (req.query.roles as string) || ''; // e.g. software,data_engineer

    const rolePatterns = patternsForRolesCsv(rolesCsv);

    // ----- dynamic WHERE builder -----
    const whereConds: string[] = [];
    const args: any[] = [];
    const p = (val: any) => {
      args.push(val);
      return `$${args.length}`;
    };

    // freshness
    whereConds.push(`COALESCE(posted_at, scraped_at) >= NOW() - INTERVAL '${maxAgeDays} days'`);

    // q search
    if (q) {
      const t = p(`%${q}%`);
      const c = p(`%${q}%`);
      const l = p(`%${q}%`);
      whereConds.push(`(title ILIKE ${t} OR company ILIKE ${c} OR COALESCE(location,'') ILIKE ${l})`);
    }

    // US only (heuristic)
    if (usOnly) {
      const patterns = [
        '%United States%', '%USA%', '% US%', 'US-Remote', 'Remote - US',
        // a few common state abbreviations / formats
        '%, CA%', '%, NY%', '%, TX%', '%, WA%', '%, MA%', '%, IL%', '%, NJ%', '%, PA%', '%, FL%', '%, GA%'
      ];
      const orParts: string[] = [];
      for (const pat of patterns) {
        const ph = p(pat);
        orParts.push(`COALESCE(location,'') ILIKE ${ph}`);
      }
      whereConds.push(`(${orParts.join(' OR ')})`);
    }

    // role group patterns (OR over title)
    if (rolePatterns.length) {
      const ors: string[] = [];
      for (const pat of rolePatterns) {
        const ph = p(pat);
        ors.push(`title ILIKE ${ph}`);
      }
      whereConds.push(`(${ors.join(' OR ')})`);
    }

    const whereSql = whereConds.length ? `WHERE ${whereConds.join(' AND ')}` : '';

    // ----- total -----
    const totalQuery = `
      SELECT COUNT(*)::int AS total
      FROM jobs
      ${whereSql}
    `;
    const totalRows = await sql.query<{ total: number }>(totalQuery, args);
    const total = totalRows.rows[0]?.total ?? 0;

    // ----- list -----
    const listQuery = `
      SELECT company, title, source, url, location,
             COALESCE(posted_at, scraped_at) AS when_time
      FROM jobs
      ${whereSql}
      ORDER BY COALESCE(posted_at, scraped_at) DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const list = await sql.query<JobRow>(listQuery, args);

    res.status(200).json({
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      maxAgeDays,
      usOnly,
      q,
      roles: rolesCsv,
      results: list.rows,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'server error' });
  }
}
