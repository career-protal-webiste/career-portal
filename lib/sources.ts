// lib/sources.ts
import { sql } from '@vercel/postgres';

export type ATSType = 'greenhouse'|'lever'|'ashby'|'workable'|'recruitee';

async function ensureTable() {
  await sql/* sql */`
    CREATE TABLE IF NOT EXISTS ats_sources (
      id           BIGSERIAL PRIMARY KEY,
      type         TEXT        NOT NULL,
      token        TEXT        NOT NULL,
      company_name TEXT        NOT NULL,
      active       BOOLEAN     NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(type, token)
    );
  `;
}

export async function listSourcesByType(type: ATSType): Promise<{token:string, company_name:string}[]> {
  await ensureTable();
  const { rows } = await sql/* sql */`
    SELECT token, company_name
    FROM ats_sources
    WHERE type = ${type} AND active = TRUE
    ORDER BY company_name;
  `;
  return rows as any;
}
