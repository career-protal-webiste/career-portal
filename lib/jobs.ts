import crypto from 'crypto';

// Create fingerprint to detect duplicates across ATS providers
export function createFingerprint(source: string, id: string, team?: string, loc?: string, url?: string) {
  const canon = [source, id, (team ?? '').toLowerCase(), (loc ?? '').toLowerCase(), (url ?? '').toLowerCase()].join('|');
  return crypto.createHash('sha256').update(canon).digest('hex');
}

// Role matching logic
const ROLE_KEYWORDS = {
  apm: [/product manager/i, /apm/i, /associate product/i, /product analyst/i],
  analytics: [/data analyst/i, /business analyst/i, /analytics/i],
  data: [/data engineer/i, /etl/i, /data platform/i],
  sde: [/software engineer/i, /swe/i, /backend/i, /full stack/i, /frontend/i],
  bio: [/biomedical/i, /bioinformatics/i, /clinical data/i, /medical devices/i],
};

export function roleMatches(title: string) {
  return Object.values(ROLE_KEYWORDS).some(patterns => patterns.some(p => p.test(title)));
}

// Parse experience from title/description
export function inferExperience(title: string, description?: string) {
  const text = `${title} ${description ?? ''}`;
  const match = text.match(/(\d)\s*-\s*(\d)\+?\s*years?/i);
  if (match) return `${match[1]}-${match[2]}`;
  if (/intern|new grad|junior|associate/i.test(text)) return '0-1';
  return undefined;
}

// Normalize to one of the categories
export function normalize(title: string) {
  for (const key of Object.keys(ROLE_KEYWORDS)) {
    if (ROLE_KEYWORDS[key as keyof typeof ROLE_KEYWORDS].some(p => p.test(title))) {
      return { category: key };
    }
  }
  return { category: undefined };
}
