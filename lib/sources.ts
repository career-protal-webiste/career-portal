// lib/sources.ts
import { sql } from '@vercel/postgres';

export type ATSType = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'recruitee';

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

/** List active sources of a given ATS type */
export async function listSourcesByType(type: ATSType): Promise<{ token: string; company_name: string }[]> {
  await ensureTable();
  const { rows } = await sql/* sql */`
    SELECT token, company_name
    FROM ats_sources
    WHERE type = ${type} AND active = TRUE
    ORDER BY company_name;
  `;
  return rows as any;
}

/** Upsert a single source (adds if new, re-activates + renames if existing) */
export async function addSource(type: ATSType, token: string, company_name: string): Promise<void> {
  await ensureTable();
  await sql/* sql */`
    INSERT INTO ats_sources (type, token, company_name)
    VALUES (${type}, ${token}, ${company_name})
    ON CONFLICT (type, token) DO UPDATE
    SET company_name = EXCLUDED.company_name,
        active = TRUE,
        updated_at = NOW();
  `;
}

/** Bulk add/activate multiple sources */
export async function bulkAddSources(items: { type: ATSType; token: string; company_name: string }[]): Promise<void> {
  await ensureTable();
  for (const it of items) {
    await addSource(it.type, it.token, it.company_name);
  }
}

/** (Optional) Soft-disable a source without deleting */
export async function deactivateSource(type: ATSType, token: string): Promise<void> {
  await ensureTable();
  await sql/* sql */`
    UPDATE ats_sources
    SET active = FALSE, updated_at = NOW()
    WHERE type = ${type} AND token = ${token};
  `;
}
