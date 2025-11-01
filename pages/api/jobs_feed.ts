// pages/api/jobs_feed.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';
import { patternsForRolesCsv } from '../../lib/filters';

type Row = {
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
    const rolesCsv = (req.query.roles as string) || ''; // e.g., software,data_engineer

    const rolePatterns = patternsForRolesCsv(rolesCsv);

    // --- WHERE assembly ---
    const whereParts: any[] = [];
    const args: any[] = [];

    // freshness
    whereParts.push(`COALESCE(posted_at, scraped_at) >= NOW() - INTERVAL '${maxAgeDays} days'`);

    // q search
    if (q) {
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
      whereParts.push(`(title ILIKE $${args.length-2} OR company ILIKE $${args.length-1} OR COALESCE(location,'') ILIKE $${args.length})`);
    }

    // US only heuristic
    if (usOnly) {
      // cheap heuristic that catches "United States", "US", state abbreviations, or typical city, ST
      args.push('%United States%', '% USA%', '% US%', '%, AL%', '%, AK%', '%, AZ%', '%, AR%', '%, CA%', '%, CO%', '%, CT%', '%, DC%', '%, DE%', '%, FL%', '%, GA%', '%, HI%', '%, IA%', '%, ID%', '%, IL%', '%, IN%', '%, KS%', '%, KY%', '%, LA%', '%, MA%', '%, MD%', '%, ME%', '%, MI%', '%, MN%', '%, MO%', '%, MS%', '%, MT%', '%, NC%', '%, ND%', '%, NE%', '%, NH%', '%, NJ%', '%, NM%', '%, NV%', '%, NY%', '%, OH%', '%, OK%', '%, OR%', '%, PA%', '%, RI%', '%, SC%', '%, SD%', '%, TN%', '%, TX%', '%, UT%', '%, VA%', '%, VT%', '%, WA%', '%, WI%', '%, WV%', '%Remote - US%', '%US-Remote%');
      const base = args.length - 52; // number added above
      const locConds = [];
      for (let i = 0; i < 52; i++) locConds.push(`COALESCE(location,'') ILIKE $${base + i + 1}`);
      whereParts.push(`(${locConds.join(' OR ')})`);
    }

    // role patterns OR over title
    if (rolePatterns.length) {
      const start = args.length;
      rolePatterns.forEach(p => args.push(p));
      const conds = [];
      for (let i = 0; i < rolePatterns.length; i++) {
        conds.push(`title ILIKE $${start + i + 1}`);
      }
      whereParts.push(`(${conds.join(' OR ')})`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    // total
    const totalQuery = `
      SELECT COUNT(*)::int AS total
      FROM jobs
      ${whereSql}
    `;
    const totalRows = await sql<{ total: number }>([totalQuery].join(' '), args as any);
    const total = totalRows.rows[0]?.total ?? 0;

    // list
    const listQuery = `
      SELECT company, title, source, url, location,
             COALESCE(posted_at, scraped_at) AS when_time
      FROM jobs
      ${whereSql}
      ORDER BY COALESCE(posted_at, scraped_at) DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const list = await sql<Row>([listQuery].join(' '), args as any);

    res.status(200).json({
      page, pageSize,
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
