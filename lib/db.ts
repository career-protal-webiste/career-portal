// lib/db.ts
import { createPool } from '@vercel/postgres';

function getConnString(): string {
  const c =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||        // Vercel Postgres
    process.env.NEON_DATABASE_URL ||   // Neon
    process.env.POSTGRESQL_URL ||      // some providers
    '';
  if (!c) {
    throw new Error(
      'No DATABASE_URL/POSTGRES_URL/NEON_DATABASE_URL set. Add a Postgres connection string in Vercel env and redeploy.'
    );
  }
  return c;
}

export const pool = createPool({ connectionString: getConnString() });
export const sql = pool.sql;

// ---- keep your existing exports unchanged below (upsertJob, migrate, etc.) ----
