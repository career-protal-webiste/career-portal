// pages/api/stats/sources.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../lib/db';

type Row = {
  source: string;
  total_60d: number;
  last24h: number;
  last_run_at: string | null;
  last_fetched: number | null;
  last_inserted: number | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // jobs counts (limit to 60d window for “freshness”)
  const jobs = await sql<Row>`
    with c as (
      select
        source,
        count(*) filter (
          where now() - coalesce(posted_at::timestamptz, scraped_at::timestamptz) <= interval '60 days'
        ) as total_60d,
        count(*) filter (
          where now() - coalesce(posted_at::timestamptz, scraped_at::timestamptz) <= interval '24 hours'
        ) as last24h
      from jobs
      group by source
    ),
    h as (
      select distinct on (source)
        source, last_run_at, fetched, inserted
      from cron_heartbeats
      order by source, last_run_at desc
    )
    select
      coalesce(c.source, h.source) as source,
      coalesce(c.total_60d, 0) as total_60d,
      coalesce(c.last24h, 0)   as last24h,
      h.last_run_at            as last_run_at,
      h.fetched                as last_fetched,
      h.inserted               as last_inserted
    from c
    full outer join h on c.source = h.source
    order by coalesce(c.total_60d,0) desc nulls last, coalesce(c.source,h.source);
  `;

  res.status(200).json({ ok: true, rows: jobs.rows });
}
