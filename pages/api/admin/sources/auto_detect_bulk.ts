// pages/api/admin/sources/auto_detect_bulk.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { addSource, ATSType } from '../../../../lib/sources';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

// Detect the ATS type + token from a given company board URL
function detect(urlStr: string): { type: ATSType | null; token: string | null } {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase(); // <- hostname (no port)
    const path = u.pathname;

    // Greenhouse: https://boards.greenhouse.io/<token>
    if (host.includes('boards.greenhouse.io')) {
      return { type: 'greenhouse', token: path.split('/').filter(Boolean)[0] || null };
    }

    // Lever: https://jobs.lever.co/<token>
    if (host.includes('jobs.lever.co')) {
      return { type: 'lever', token: path.split('/').filter(Boolean)[0] || null };
    }

    // Ashby: https://<token>.ashbyhq.com or https://jobs.ashbyhq.com/job-board/<token>
    if (host.includes('ashbyhq.com')) {
      const parts = path.split('/').filter(Boolean);
      const first = parts[0];
      const tok = first && first.toLowerCase() === 'job-board' ? parts[1] : first;
      return { type: 'ashby', token: tok ? decodeURIComponent(tok) : null };
    }

    // Workable: https://apply.workable.com/<token>
    if (host.includes('apply.workable.com')) {
      return { type: 'workable', token: path.split('/').filter(Boolean)[0] || null };
    }

    // Recruitee: https://<token>.recruitee.com
    if (host.endsWith('.recruitee.com')) {
      return { type: 'recruitee', token: host.replace('.recruitee.com', '') || null };
    }

    // SmartRecruiters: https://jobs.smartrecruiters.com/<token>/...
    if (host.includes('smartrecruiters.com')) {
      const seg = path.split('/').filter(Boolean)[0];
      return { type: 'smartrecruiters', token: seg || null };
    }

    // Workday (composite token host:tenant:site)
    // Examples: https://company.wd1.myworkdayjobs.com/en-US/External
    if (host.includes('myworkdayjobs.com')) {
      const segs = path.split('/').filter(Boolean);
      const site = segs[0] || 'External';
      const tenant = host.split('.')[0]; // "company" from company.wd1.myworkdayjobs.com
      return { type: 'workday', token: `${host}:${tenant}:${site}` };
    }
  } catch {
    // fallthrough
  }
  return { type: null, token: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Optional admin key (keeps existing pattern)
  const key = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';
  if (process.env.ADMIN_KEY && key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  try {
    // Accept array body
    const items: Array<{ url: string; company_name: string }> =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!Array.isArray(items)) {
      return res
        .status(400)
        .json({ ok: false, error: 'Body must be an array of { url, company_name }' });
    }

    const out: Array<
      | { url: string; company_name: string; ok: true; type: ATSType; token: string }
      | { url: string; company_name: string; ok: false; error: string }
    > = [];

    for (const it of items) {
      const url = String(it?.url || '').trim();
      const company_name = String(it?.company_name || '').trim();

      if (!url || !company_name) {
        out.push({ url, company_name, ok: false, error: 'missing fields' });
        continue;
      }

      const { type, token } = detect(url);
      if (!type || !token) {
        out.push({ url, company_name, ok: false, error: 'not detected' });
        continue;
      }

      // ✅ FIX: remove the invalid `active: true` property
      await addSource({ type, token, company_name });

      out.push({ url, company_name, ok: true, type, token });
    }

    return res.status(200).json({ ok: true, results: out });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'server error' });
  }
}
