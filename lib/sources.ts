// lib/sources.ts
import { sql } from '@vercel/postgres';

export type ATSType =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'recruitee'
  | 'smartrecruiters'
  | 'workday';

export type SourceRow = {
  id?: number;
  type: ATSType;
  token: string;        // e.g. "stripe", "Vercel", "typeform", or for Workday "host:tenant:site"
  company_name: string; // Display name
  active?: boolean;
};

async function ensureTable() {
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS ats_sources (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      token TEXT NOT NULL,
      company_name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (type, token)
    );
  `;
}

export async function listSourcesByType(type: ATSType): Promise<SourceRow[]> {
  await ensureTable();
  const r = await sql/*sql*/`
    SELECT id, type, token, company_name, active
    FROM ats_sources
    WHERE type = ${type} AND active = TRUE
    ORDER BY company_name ASC;
  `;
  return r.rows as any;
}

export async function addSource(item: SourceRow) {
  await ensureTable();
  await sql/*sql*/`
    INSERT INTO ats_sources (type, token, company_name, active)
    VALUES (${item.type}, ${item.token}, ${item.company_name}, TRUE)
    ON CONFLICT (type, token) DO UPDATE
      SET company_name = EXCLUDED.company_name,
          active = TRUE,
          updated_at = NOW();
  `;
}

export async function bulkAddSources(items: SourceRow[]) {
  for (const it of items) await addSource(it);
}

export async function removeSource(type: ATSType, token: string) {
  await ensureTable();
  await sql/*sql*/`
    UPDATE ats_sources SET active = FALSE, updated_at = NOW()
    WHERE type=${type} AND token=${token};
  `;
}
