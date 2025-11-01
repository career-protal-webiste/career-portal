// pages/api/debug/health.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../lib/db';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const envs = {
    has_DATABASE_URL: Boolean(process.env.DATABASE_URL),
    has_POSTGRES_URL: Boolean(process.env.POSTGRES_URL),
    has_NEON_DATABASE_URL: Boolean(process.env.NEON_DATABASE_URL),
    has_ADMIN_KEY: Boolean(process.env.ADMIN_KEY),
    has_CRON_SECRET: Boolean(process.env.CRON_SECRET),
  };

  let db_ok = false;
  let db_error: string | null = null;
  try {
    await sql`select 1 as ok`;
    db_ok = true;
  } catch (e: any) {
    db_error = e?.message || String(e);
  }

  res.status(200).json({
    ok: true,
    envs,
    db_ok,
    db_error,
  });
}
