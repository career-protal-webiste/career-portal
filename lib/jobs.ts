// lib/jobs.ts
import crypto from 'crypto';

export function createFingerprint(
  company: string,
  title: string,
  loc?: string,
  url?: string
): string {
  const canon = [
    (company || '').toLowerCase().trim(),
    (title || '').toLowerCase().trim(),
    (loc || '').toLowerCase().trim(),
    (url || '').toLowerCase().trim(),
  ].join('|');
  return crypto.createHash('sha256').update(canon).digest('hex');
}

// keep/adjust these as you like
const ROLE_PATTERNS = [
  /data\s*(scientist|engineer|analyst)/i,
  /(ml|machine learning)/i,
  /\bai\b/i,
  /analytics?/i,
];

export function roleMatches(title: string, description: string): boolean {
  const hay = `${title} ${description}`.toLowerCase();
  return ROLE_PATTERNS.some((re) => re.test(hay));
}

export function inferExperience(title: string, description: string): string | null {
  const t = `${title} ${description}`.toLowerCase();
  if (/\bintern(ship)?\b/.test(t)) return 'intern';
  if (/\b(junior|new grad|entry)\b/.test(t)) return 'junior';
  if (/\b(senior|staff|principal|lead)\b/.test(t)) return 'senior';
  return null;
}

export function normalize(category?: string | null): string | null {
  if (!category) return null;
  const c = category.toLowerCase();
  if (/data/.test(c)) return 'data';
  if (/ml|machine learning/.test(c)) return 'ml';
  if (/ai/.test(c)) return 'ai';
  return category;
}
