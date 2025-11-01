// lib/ats_detect.ts
import type { ATSType } from './sources';

export type DetectResult = {
  type: ATSType;
  token: string;        // vendor “board token” / tenant
  company_name: string; // pretty name for UI
};

const pretty = (slug: string) =>
  decodeURIComponent(slug.replace(/[-_]/g, ' '))
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();

export function detectATS(raw: string): DetectResult | null {
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  // Greenhouse: boards.greenhouse.io/<token>
  if (host.endsWith('greenhouse.io') || host.includes('greenhouse')) {
    const idx = parts.findIndex(p => p === 'boards' || p === 'board' || p === 'greenhouse');
    const token = idx >= 0 ? (parts[idx + 1] || parts[0]) : parts[0];
    if (token) return { type: 'greenhouse', token: token.toLowerCase(), company_name: pretty(token) };
  }

  // Ashby: jobs.ashbyhq.com/<Company>
  if (host.endsWith('ashbyhq.com')) {
    const token = parts[0];
    if (token) return { type: 'ashby', token, company_name: pretty(token) };
  }

  // Lever: jobs.lever.co/<company>
  if (host.endsWith('lever.co')) {
    const token = parts[0];
    if (token) return { type: 'lever', token, company_name: pretty(token) };
  }

  // Workable: <sub>.workable.com
  if (host.endsWith('workable.com')) {
    const sub = host.split('.')[0];
    if (sub && sub !== 'www') return { type: 'workable', token: sub, company_name: pretty(sub) };
  }

  // Recruitee: <company>.recruitee.com
  if (host.endsWith('recruitee.com')) {
    const sub = host.split('.')[0];
    if (sub && sub !== 'www') return { type: 'recruitee', token: sub, company_name: pretty(sub) };
  }

  // SmartRecruiters: careers.smartrecruiters.com/<CompanySlug>
  if (host.endsWith('smartrecruiters.com')) {
    const token = parts[0];
    if (token) return { type: 'smartrecruiters', token, company_name: pretty(token) };
  }

  // Workday: *.myworkdayjobs.com/(en-US|de-DE|…)?/<tenant>(/|$)…
  if (host.endsWith('myworkdayjobs.com')) {
    let tenant = parts[0];
    if (/^[a-z]{2}-[A-Z]{2}$/.test(tenant)) tenant = parts[1]; // skip locale segment
    if (tenant) return { type: 'workday', token: tenant, company_name: pretty(tenant) };
  }

  return null;
}
