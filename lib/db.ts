// lib/db.ts
import { createPool } from '@vercel/postgres';

// single pool reused by all routes
export const pool = createPool({
  connectionString: process.env.DATABASE_URL,
});

// expose the tagged template helper so code can do: sql`SELECT ...`
export const sql = pool.sql;
