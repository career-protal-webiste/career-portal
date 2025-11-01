import type { NextApiRequest, NextApiResponse } from 'next';
import { addSource, ATSType } from '../../../../lib/sources';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

function detect(urlStr: string): { type: ATSType|null; token: string|null } {
  try {
    const u = new URL(urlStr);
    const host = u.host.toLowerCase();
    const path = u.pathname;
    // greenhouse
    if (host.includes('boards.greenhouse.io')) return { type:'greenhouse', token: path.split('/').filter(Boolean)[0] || null };
    // lever
    if (host.includes('jobs.lever.co'))       return { type:'lever',       token: path.split('/').filter(Boolean)[0] || null };
    // ashby
    if (host.includes('ashbyhq.com')) {
      const parts = path.split('/').filter(Boolean);
      let tok = parts[0] && parts[0].toLowerCase()==='job-board' ? parts[1] : parts[0];
      return { type:'ashby', token: tok ? decodeURIComponent(tok) : null };
    }
    // workable
    if (host.includes('apply.workable.com'))  return { type:'workable',    token: path.split('/').filter(Boolean)[0] || null };
    // recruitee
    if (host.endsWith('.recruitee.com'))      return { type:'recruitee',   token: host.replace('.recruitee.com','') };
    // smartrecruiters
    if (host.includes('smartrecruiters.com')) return { type:'smartrecruiters', token: path.split('/').filter(Boolean)[0] || null };
    // workday (token is host:tenant:site)
    if (host.includes('myworkdayjobs.com')) {
      const site = path.split('/').filter(Boolean)[0] || 'External';
      const tenant = host.split('.')[0];
      return { type:'workday', token: `${host}:${tenant}:${site}` };
    }
  } catch {}
  return { type: null, token: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = (req.headers['x-admin-key'] as string) || (req.query.key as string) || '';
  if (process.env.ADMIN_KEY && key !== process.env.ADMIN_KEY) return res.status(401).json({ ok:false, error:'unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST only' });

  try {
    let items: any = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!Array.isArray(items)) return res.status(400).json({ ok:false, error:'Body must be an array of {url, company_name}' });

    const out: any[] = [];
    for (const it of items) {
      const url = String(it?.url || '');
      const company_name = String(it?.company_name || '');
      if (!url || !company_name) { out.push({ url, company_name, ok:false, error:'missing fields' }); continue; }
      const { type, token } = detect(url);
      if (!type || !token) { out.push({ url, company_name, ok:false, error:'not detected' }); continue; }
      await addSource({ type, token, company_name, active: true });
      out.push({ url, company_name, ok:true, type, token });
    }
    return res.status(200).json({ ok:true, results: out });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error: e?.message || 'server error' });
  }
}
