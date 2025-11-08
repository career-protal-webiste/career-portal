// lib/fingerprint.ts
import { createHash } from 'crypto';

function norm(s?: string | null) {
  return (s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds a stable SHA-256 key to de-dupe jobs across sources.
 * Prefer including sourceId if the provider gives one.
 */
export function createFingerprint(
  company: string | null | undefined,
  title: string | null | undefined,
  location: string | null | undefined,
  url: string | null | undefined,
  sourceId?: string | null
) {
  const base = [norm(company), norm(title), norm(location), norm(url), norm(sourceId ?? '')]
    .filter(Boolean)
    .join('|');

  return createHash('sha256').update(base).digest('hex');
}
