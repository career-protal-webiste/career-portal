export type Detected = {
  type: 'greenhouse'|'ashby'|'lever'|'workable'|'recruitee'|'smartrecruiters'|'workday',
  token: string,
  company_name: string
};

export function detectATS(input: string): Detected | null {
  const url = input.trim();
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.toLowerCase();
    const path = pathname.replace(/\/+$/, '');

    if (host.includes('greenhouse.io')) {
      const m = path.match(/\/boards\/([^/]+)/i);
      if (m) return { type: 'greenhouse', token: m[1], company_name: cap(m[1]) };
    }
    if (host.includes('ashbyhq.com')) {
      const seg = path.split('/').filter(Boolean)[0];
      if (seg) return { type: 'ashby', token: decodeURIComponent(seg), company_name: decodeURIComponent(seg) };
    }
    if (host.includes('lever.co')) {
      const seg = path.split('/').filter(Boolean)[0];
      if (seg) return { type: 'lever', token: seg, company_name: cap(seg) };
    }
    if (host.endsWith('workable.com')) {
      const sub = host.split('.').length > 2 ? host.split('.')[0] : null;
      const seg = sub || path.split('/').filter(Boolean)[0];
      if (seg) return { type: 'workable', token: seg, company_name: cap(seg) };
    }
    if (host.endsWith('recruitee.com')) {
      const sub = host.split('.').length > 2 ? host.split('.')[0] : null;
      const seg = sub || path.split('/').filter(Boolean)[0];
      if (seg) return { type: 'recruitee', token: seg, company_name: cap(seg) };
    }
    if (host.includes('smartrecruiters.com')) {
      const seg = path.split('/').filter(Boolean)[0];
      if (seg) return { type: 'smartrecruiters', token: seg, company_name: cap(seg) };
    }
    if (host.endsWith('myworkdayjobs.com')) {
      const tenant = host.split('.')[0];
      if (tenant) return { type: 'workday', token: tenant, company_name: cap(tenant) };
    }
  } catch {}
  return null;
}

function cap(s: string) {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
