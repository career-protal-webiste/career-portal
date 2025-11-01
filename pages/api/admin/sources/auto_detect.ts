import type { NextApiRequest, NextApiResponse } from 'next';
import { addSource, ATSType } from '../../../../lib/sources';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';
  if (process.env.ADMIN_KEY && key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok:false, error:'unauthorized' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST only' });

  try {
    const { url, company_name } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!url || !company_name) return res.status(400).json({ ok:false, error:'Need url and company_name' });

    const u = new URL(url);
    const host = u.host.toLowerCase();
    const path = u.pathname;

    let type: ATSType | null = null;
    let token: string | null = null;

    // Greenhouse
    // https://boards.greenhouse.io/stripe
    if (host.includes('boards.greenhouse.io')) {
      type = 'greenhouse';
      token = path.split('/').filter(Boolean)[0] || null;
    }

    // Lever
    // https://jobs.lever.co/databricks
    if (!type && host.includes('jobs.lever.co')) {
      type = 'lever';
      token = path.split('/').filter(Boolean)[0] || null;
    }

    // Ashby
    // https://jobs.ashbyhq.com/Stripe (job-board sometimes)
    if (!type && (host.includes('ashbyhq.com'))) {
      type = 'ashby';
      const parts = path.split('/').filter(Boolean);
      token = parts[0] && parts[0].toLowerCase() === 'job-board' ? parts[1] : parts[0];
      if (token) token = decodeURIComponent(token);
    }

    // SmartRecruiters
    // https://jobs.smartrecruiters.com/COMPANY
    if (!type && host.includes('smartrecruiters.com')) {
      type = 'smartrecruiters';
      token = path.split('/').filter(Boolean)[0] || null;
    }

    // Workable
    // https://apply.workable.com/TYPEFORM/
    if (!type && host.includes('apply.workable.com')) {
      type = 'workable';
      token = path.split('/').filter(Boolean)[0] || null;
    }

    // Recruitee
    // https://COMPANY.recruitee.com/
    if (!type && host.endsWith('.recruitee.com')) {
      type = 'recruitee';
      token = host.replace('.recruitee.com', '');
    }

    // Workday
    // https://stripe.wd5.myworkdayjobs.com/Stripe/ (token = host:tenant:site)
    if (!type && host.includes('myworkdayjobs.com')) {
      type = 'workday';
      const site = path.split('/').filter(Boolean)[0] || '';
      let tenant = host.split('.')[0]; // "stripe" in "stripe.wd5.myworkdayjobs.com"
      token = `${host}:${tenant}:${site}`;
    }

    if (!type || !token) {
      return res.status(422).json({ ok:false, error:'Could not detect ATS/token from URL' });
    }

    await addSource({ type, token, company_name });
    return res.status(200).json({ ok:true, detected: { type, token, company_name } });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error: e?.message || 'server error' });
  }
}
