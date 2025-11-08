/**
 * Infer a rough experience level from free‑form text. Returns strings like
 * 'intern', '0-2', '3-5', '5+' or null when no hint is detected. This is
 * helpful for filtering early career jobs.
 */
export function inferExperience(text: string): string | null {
  const t = (text || '').toLowerCase();
  if (/\b(intern|internship)\b/.test(t)) return 'intern';
  if (/\b(new grad|newgrad|entry|early career|junior|graduate)\b/.test(t)) return '0-2';
  // Match ranges like "1-3 years" or "2 - 5 years"
  const range = t.match(/(\d+)\s*-\s*(\d+)\s*\+?\s*years?/);
  if (range) return `${range[1]}-${range[2]}`;
  // Match at least X years e.g. "3+ years" or "5 years experience"
  const plus = t.match(/(\d+)\s*\+?\s*years?/);
  if (plus) return `${plus[1]}+`;
  return null;
}
