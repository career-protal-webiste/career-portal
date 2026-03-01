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
  experience_hint: string | null;
  scraped_at: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const pageSize = Math.min(100, Math.max(10, parseInt((req.query.pageSize as string) || '100', 10)));
    const offset = (page - 1) * pageSize;

    const q = (req.query.q as string) || '';
    const usOnly = String(req.query.usOnly || '0') === '1';
    const maxAgeDays = Math.max(1, parseInt((req.query.maxAgeDays as string) || '60', 10));
    const rolesCsv = (req.query.roles as string) || '';
    const expFilter = (req.query.exp as string) || ''; // intern, new_grad, senior

    const rolePatterns = patternsForRolesCsv(rolesCsv);

    // ----- dynamic WHERE builder -----
    const whereConds: string[] = [];
    const args: any[] = [];
    const p = (val: any) => {
      args.push(val);
      return `$${args.length}`;
    };

    // Freshness: use scraped_at (when we last confirmed job is open in ATS)
    // OR posted_at so recently-posted jobs also appear. This prevents old
    // posted_at dates from hiding actively-scraped open positions.
    whereConds.push(
      `(scraped_at >= NOW() - INTERVAL '${maxAgeDays} days' OR posted_at >= NOW() - INTERVAL '${maxAgeDays} days')`
    );

    // Free-text search
    if (q) {
      const t = p(`%${q}%`);
      const c = p(`%${q}%`);
      const l = p(`%${q}%`);
      whereConds.push(`(title ILIKE ${t} OR company ILIKE ${c} OR COALESCE(location,'') ILIKE ${l})`);
    }

    // US-only heuristic filter
    if (usOnly) {
      const patterns = [
        '%United States%', '%USA%', '% US%', 'US-Remote', 'Remote - US',
        '%, CA%', '%, NY%', '%, TX%', '%, WA%', '%, MA%', '%, IL%',
        '%, NJ%', '%, PA%', '%, FL%', '%, GA%', '%, CO%', '%, AZ%',
        '%, NC%', '%, OH%', '%, MN%', '%Remote%',
      ];
      const orParts: string[] = [];
      for (const pat of patterns) {
        const ph = p(pat);
        orParts.push(`COALESCE(location,'') ILIKE ${ph}`);
      }
      whereConds.push(`(${orParts.join(' OR ')})`);
    }

    // Role group patterns (OR over title)
    if (rolePatterns.length) {
      const ors: string[] = [];
      for (const pat of rolePatterns) {
        const ph = p(pat);
        ors.push(`title ILIKE ${ph}`);
      }
      whereConds.push(`(${ors.join(' OR ')})`);
    }

    // Experience level filter
    if (expFilter === 'intern') {
      whereConds.push(`experience_hint = 'intern'`);
    } else if (expFilter === 'new_grad') {
      const ph = p('0-2');
      whereConds.push(`experience_hint = ${ph}`);
    } else if (expFilter === 'senior') {
      const ph = p('senior');
      whereConds.push(`experience_hint = ${ph}`);
    }

    const whereSql = whereConds.length ? `WHERE ${whereConds.join(' AND ')}` : '';

    // ----- total -----
    const totalQuery = `SELECT COUNT(*)::int AS total FROM jobs ${whereSql}`;
    const totalRows = await sql.query<{ total: number }>(totalQuery, args);
    const total = totalRows.rows[0]?.total ?? 0;

    // ----- list — order by most-recently scraped first -----
    const listQuery = `
      SELECT company, title, source, url, location, experience_hint, scraped_at,
             COALESCE(posted_at, scraped_at) AS when_time
      FROM jobs
      ${whereSql}
      ORDER BY COALESCE(scraped_at, posted_at) DESC, COALESCE(posted_at, scraped_at) DESC
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
