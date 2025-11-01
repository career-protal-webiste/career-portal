// lib/ats_detect.ts
import { ATSType } from './sources';

export type DetectResult = { type: ATSType; token: string; company_name?: string } | null;

export function detectATS(raw: string): DetectResult {
  try {
    const u = new URL(raw.trim());
    const host = u.host.toLowerCase();
    const path = u.pathname;

    // Greenhouse
    let m = raw.match(/boards\.greenhouse\.io\/([^\/\?#]+)/i)
          || raw.match(/greenhouse\.io\/v1\/boards\/([^\/\?#]+)/i);
    if (m) return { type:'greenhouse', token: m[1].toLowerCase() };

    // Lever
    m = raw.match(/jobs\.lever\.co\/([^\/\?#]+)/i);
    if (m) return { type:'lever', token: m[1] };

    // Ashby
    m = raw.match(/jobs\.ashbyhq\.com\/([^\/\?#]+)/i);
    if (m) return { type:'ashby', token: m[1] };

    // Workable
    m = host.match(/^([a-z0-9\-]+)\.workable\.com$/i);
    if (m) return { type:'workable', token: m[1] };

    // Recruitee
    m = host.match(/^([a-z0-9\-]+)\.recruitee\.com$/i);
    if (m) return { type:'recruitee', token: m[1] };

    // SmartRecruiters
    m = raw.match(/careers\.smartrecruiters\.com\/([^\/\?#]+)/i)
      || raw.match(/api\.smartrecruiters\.com\/v1\/companies\/([^\/\?#]+)/i);
    if (m) return { type:'smartrecruiters', token: m[1] };

    // Workday (tenant slug)
    m = raw.match(/myworkdayjobs\.com\/([^\/\?#]+)/i);
    if (m) return { type:'workday', token: m[1] };

    // Some companies link to /careers which redirect to one above; you can paste their final URL.
    return null;
  } catch { return null; }
}
