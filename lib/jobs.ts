import crypto from 'crypto';

// Robust fingerprint across providers
export function createFingerprint(source: string, id: string, team?: string, loc?: string, url?: string) {
  const canon = [
    (team ?? '').toLowerCase().trim(),
    (loc ?? '').toLowerCase().trim(),
    (url ?? '').toLowerCase().trim()
  ].join('|');
  // keep source/id in the hash as a tie-breaker
  return crypto.createHash('sha256').update(`${canon}|${source}|${id}`).digest('hex');
}

// Role matching
const ROLE_KEYWORDS = [
  /product manager/i, /apm/i, /associate product/i, /product analyst/i,
  /data analyst/i, /business analyst/i, /analytics/i,
  /data engineer/i, /etl/i, /data platform/i,
  /software engineer/i, /swe/i, /backend/i, /full stack/i, /frontend/i,
  /biomedical/i, /bioinformatics/i, /clinical data/i, /medical devices/i
];

export function roleMatches(title: string, desc?: string) {
  const s = `${title} ${desc ?? ''}`;
  return ROLE_KEYWORDS.some(re => re.test(s));
}

export function inferExperience(title: string, description?: string) {
  const s = `${title} ${description ?? ''}`.toLowerCase();
  const m = s.match(/(\d)\s*[-–]?\s*(\d)?\s*(?:\+)?\s*(year|yr)/);
  if (m) {
    const lo = Number(m[1] ?? 0);
    const hi = Number(m[2] ?? m[1] ?? 0);
    if (hi <= 1) return '0-1';
    if (hi <= 3) return '1-3';
    if (hi <= 5) return '3-5';
  }
  if (/intern|new grad|junior|associate/.test(s)) return '0-1';
  return null;
}

export function normalize(title: string) {
  const t = title.toLowerCase();
  if (/product manager|apm|product analyst/.test(t)) return { category: 'apm' };
  if (/data analyst|business analyst|analytics/.test(t)) return { category: 'analytics' };
  if (/data engineer|etl|data platform/.test(t)) return { category: 'data' };
  if (/software engineer|swe|backend|full stack|frontend/.test(t)) return { category: 'sde' };
  if (/biomedical|bioinformatics|clinical data|medical devices/.test(t)) return { category: 'bio' };
  return { category: null };
}
