// lib/experience.ts
export function inferExperience(text: string): string | null {
  const t = (text || '').toLowerCase();
  if (/\b(intern|internship)\b/.test(t)) return 'intern';
  if (/\b(new grad|newgrad|entry|early career|junior|grad(uate)?)\b/.test(t)) return '0-2';
  const m = t.match(/(\d+)\s*-\s*(\d+)\s*(?:\+)?\s*years?/);
  if (m) return `${m[1]}-${m[2]}`;
  const m2 = t.match(/(\d+)\s*\+?\s*years?/);
  if (m2) return `${m2[1]}+`;
  return null;
}
