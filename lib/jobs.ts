import crypto from 'crypto';

/**
 * Create a fingerprint for a job posting.
 * We use company + title + location + url to deduplicate across providers.
 */
export function createFingerprint(
  company: string,
  title: string,
  loc?: string,
  url?: string
) {
  const canon = [
    (company ?? '').toLowerCase(),
    (title ?? '').toLowerCase(),
    (loc ?? '').toLowerCase(),
    (url ?? '').toLowerCase(),
  ].join('|');

  return crypto.createHash('sha256').update(canon).digest('hex');
}

const ROLE_KEYWORDS: Record<string, RegExp[]> = {
  apm: [
    /product manager/i,
    /\bapm\b/i,
    /associate product/i,
    /product analyst/i,
  ],
  analytics: [/data analyst/i, /business analyst/i, /analytics/i],
  data: [/data engineer/i, /\betl\b/i, /data platform/i],
  sde: [
    /software engineer/i,
    /\bswe\b/i,
    /backend/i,
    /full stack/i,
    /frontend/i,
  ],
  bio: [/biomedical/i, /bioinformatics/i, /clinical data/i, /medical devices/i],
};

/**
 * Check if a job title or description matches one of our role patterns.
 */
export function roleMatches(title: string, description?: string) {
  const text = `${title} ${description ?? ''}`;
  return Object.values(ROLE_KEYWORDS).some((patterns) =>
    patterns.some((p) => p.test(text))
  );
}

/**
 * Infer an experience band from the job title or description.
 * Returns a string like "0-1", "1-3", "3-5" or null.
 */
export function inferExperience(title: string, description?: string) {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  const match = text.match(/(\d)\s*-\s*(\d)\+?\s*(year|yr)/);
  if (match) {
    const lo = Number(match[1]);
    const hi = Number(match[2]);
    if (hi <= 1) return '0-1';
    if (hi <= 3) return '1-3';
    if (hi <= 5) return '3-5';
  }
  if (/intern|new grad|junior|associate/.test(text)) return '0-1';
  return null;
}

/**
 * Normalize a title into one of our categories.
 */
export function normalize(title: string) {
  const lower = title.toLowerCase();
  if (/product manager|apm|product analyst/.test(lower)) return { category: 'apm' };
  if (/data analyst|business analyst|analytics/.test(lower)) return { category: 'analytics' };
  if (/data engineer|etl|data platform/.test(lower)) return { category: 'data' };
  if (/software engineer|swe|backend|full stack|frontend/.test(lower)) return { category: 'sde' };
  if (/biomedical|bioinformatics|clinical data|medical devices/.test(lower)) return { category: 'bio' };
  return { category: null };
}
