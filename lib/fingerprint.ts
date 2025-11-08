import { createHash } from 'crypto';

/**
 * Normalize a string by trimming whitespace, lowercasing and collapsing
 * contiguous whitespace. This helps generate consistent fingerprints.
 */
function norm(s?: string | null): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a deterministic SHA‑256 fingerprint for a job based on company,
 * title, location, url and an optional sourceId. Passing undefined or null
 * values is safe; they will be normalized to empty strings and removed.
 *
 * @param company   Company name
 * @param title     Job title
 * @param location  Job location
 * @param url       Link to the job description
 * @param sourceId  Provider specific ID to further de‑duplicate
 */
export function createFingerprint(
  company: string | null | undefined,
  title: string | null | undefined,
  location: string | null | undefined,
  url: string | null | undefined,
  sourceId?: string | null
): string {
  const base = [norm(company), norm(title), norm(location), norm(url), norm(sourceId ?? '')]
    .filter(Boolean)
    .join('|');
  return createHash('sha256').update(base).digest('hex');
}
