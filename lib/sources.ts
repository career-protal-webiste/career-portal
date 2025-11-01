// lib/sources.ts
import { sql } from './db';

export type ATSType =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'recruitee'
  | 'smartrecruiters'
  | 'workday';

export type SourceRow = {
  id: number;
  type: ATSType;
  token: string;
  company_name: string;
  created_at: string;
  updated_at: string;
};

export async function addSource(input: { type: ATSType; token: string; company_name: string }) {
  const { type, token, company_name } = input;
  await sql`
    INSERT INTO ats_sources (type, token, company_name)
    VALUES (${type}, ${token}, ${company_name})
    ON CONFLICT (type, token) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      updated_at   = NOW()
  `;
}

export async function listSourcesByType(type: ATSType): Promise<{ type: ATSType; token: string; company_name: string }[]> {
  const { rows } = await sql<SourceRow>`
    SELECT id, type, token, company_name, created_at, updated_at
    FROM ats_sources
    WHERE type = ${type}
    ORDER BY company_name ASC
  `;
  return rows.map(r => ({ type: r.type, token: r.token, company_name: r.company_name }));
}
