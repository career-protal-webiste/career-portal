// lib/filters.ts
// --- Role groups used by /api/jobs_feed role filtering (UI facets) ---
export const ROLE_GROUPS: Record<string, string[]> = {
  software: [
    'software engineer','sde','backend','back-end','frontend','front-end','full stack','full-stack',
    'ios','android','mobile','platform','distributed','systems','api','golang','go','java','python','node'
  ],
  data_engineer: [
    'data engineer','analytics engineer','etl','elt','pipeline','airflow','dbt','spark','kafka',
    'snowflake','databricks','redshift','bigquery','synapse'
  ],
  data_science: [
    'data scientist','ml engineer','machine learning','deep learning','nlp','computer vision',
    'llm','applied scientist','research engineer','mle'
  ],
  devops: [
    'devops','sre','site reliability','platform engineer','cloud engineer','kubernetes','terraform',
    'infrastructure','observability'
  ],
  security: [
    'security','iam','grc','soc','threat','appsec','secops','security analyst','security engineer'
  ],
  qa: [
    'qa','quality','sdet','test automation','automation engineer','test engineer'
  ],
  analyst: [
    'data analyst','business analyst','product analyst','analytics'
  ],
  product: [
    'product manager','technical product manager','product owner'
  ],
};

// Convert roles CSV into ILIKE patterns for SQL
export function patternsForRolesCsv(csv?: string): string[] {
  if (!csv) return [];
  const keys = csv.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const phrases = new Set<string>();
  for (const k of keys) {
    const list = ROLE_GROUPS[k];
    if (list) list.forEach(p => phrases.add(`%${p}%`));
  }
  return Array.from(phrases);
}

/**
 * 🔧 Back-compat shim so existing crons still compile.
 * We no longer filter at cron time; we filter in /api/jobs_feed.
 * Keeping this here avoids touching every cron file.
 */
export function roleMatchesWide(_title: string): boolean {
  return true; // ingest everything at cron time
}
