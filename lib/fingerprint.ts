// lib/fingerprint.ts
import crypto from 'crypto';

function norm(s?: string | null) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function createFingerprint(
  company: string | null | undefined,
  title: string | null | undefined,
  location: string | null | undefined,
  url: string | null | undefined,
  sourceId?: string | null
) {
  const base = [norm(company), norm(title), norm(location), norm(url || ''), norm(sourceId || '')]
    .filter(Boolean)
    .join('|');
  return crypto.createHash('sha256').update(base).digest('hex');
}
lib/fingerprint.ts
