// pages/engineering-jobs.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

type Job = {
  fingerprint: string;
  source: string;
  company: string;
  title: string;
  location: string | null;
  remote: boolean | null;
  employment_type: string | null;
  experience_hint: string | null;
  category: string | null;
  url: string;
  posted_at: string | null;
  scraped_at: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  visa_tags: string | null;
};

type ApiResp = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  maxAgeDays: number;
  items: Job[];
  error?: string;
};

function num(val: any, def: number) {
  const n = parseInt(String(val ?? ''), 10);
  return Number.isNaN(n) ? def : n;
}

export default function EngineeringJobsPage() {
  const router = useRouter();
  const page = num(router.query.page, 1);
  const pageSize = num(router.query.pageSize, 25);

  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState<string>(String(router.query.q ?? ''));
  const [maxAgeDays, setMaxAgeDays] = useState<number>(Number(router.query.maxAgeDays ?? 7));

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('maxAgeDays', String(maxAgeDays));
    if (q) params.set('q', q);
    return `/api/jobs_engineering?${params.toString()}`;
  }, [page, pageSize, maxAgeDays, q]);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl, { cache: 'no-store' })
      .then(r => r.json())
      .then((j: ApiResp) => setData(j))
      .catch(() => setData({ ok: false, page, pageSize, total: 0, totalPages: 1, maxAgeDays, items: [], error: 'Failed to load' }))
      .finally(() => setLoading(false));
  }, [apiUrl, page, pageSize, maxAgeDays]);

  function go(newPage: number, newSize = pageSize) {
    const qd: any = { page: newPage, pageSize: newSize, maxAgeDays };
    if (q) qd.q = q;
    router.push({ pathname: '/engineering-jobs', query: qd }, undefined, { shallow: true });
  }

  function PageButton({ n, active }: { n: number; active: boolean }) {
    return (
      <button
        onClick={() => go(n)}
        disabled={active}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid #2a3343',
          background: active ? '#1f2937' : '#0f141b',
          color: '#e5e7eb',
          cursor: active ? 'default' : 'pointer'
        }}
      >
        {n}
      </button>
    );
  }

  const totalPages = data?.totalPages ?? 1;
  const pageWindow = 7;
  const start = Math.max(1, page - Math.floor(pageWindow / 2));
  const end = Math.min(totalPages, start + pageWindow - 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div style={{fontFamily:'Inter, system-ui, Arial', background:'#0b0f13', color:'#e6edf3', minHeight:'100vh'}}>
      <div style={{maxWidth: 1100, margin:'0 auto', padding:'24px'}}>
        <h1 style={{fontSize:28, fontWeight:700, marginBottom:8}}>Engineering Jobs in the US (0–5 yrs)</h1>
        <p style={{opacity:.75, marginBottom:20}}>
          Latest first • US-only • filters include CS/Data/AI/Cloud/Cyber/QA/Embedded/EE/Mech/Civil/Robotics/Aero/Chem/Bio/Industrial.
          Visa status is not filtered. Change recency, search, and page size below.
        </p>

        {/* Controls */}
        <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:18, flexWrap:'wrap'}}>
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Search title/company (optional)"
            onKeyDown={(e)=>{ if (e.key==='Enter') go(1); }}
            style={{padding:'10px 12px', background:'#0f141b', color:'#e6edf3', border:'1px solid #2a3343', borderRadius:10, minWidth:260}}
          />
          <button onClick={()=>go(1)} style={{padding:'10px 14px', borderRadius:10, background:'#2563eb', color:'#fff', border:'none'}}>Search</button>

          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span style={{opacity:.8}}>Days:</span>
            <select
              value={maxAgeDays}
              onChange={(e)=>{ setMaxAgeDays(Number(e.target.value)); go(1); }}
              style={{padding:'8px', background:'#0f141b', color:'#e6edf3', border:'1px solid #2a3343', borderRadius:8}}
            >
              <option value={3}>3</option>
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
            </select>
          </div>

          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>
            <span style={{opacity:.8}}>Per page:</span>
            <select
              value={pageSize}
              onChange={(e)=>go(1, Number(e.target.value))}
              style={{padding:'8px', background:'#0f141b', color:'#e6edf3', border:'1px solid #2a3343', borderRadius:8}}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* List */}
        {loading && <div>Loading…</div>}
        {!loading && data?.items?.length === 0 && <div>No results. Try a wider date range or clear search.</div>}

        <div style={{display:'grid', gap:12}}>
          {data?.items?.map(job => (
            <a key={job.fingerprint} href={job.url} target="_blank" rel="noreferrer"
               style={{textDecoration:'none', color:'inherit', border:'1px solid #2a3343', borderRadius:12, padding:'14px 16px', background:'#0f141b'}}>
              <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <div>
                  <div style={{fontWeight:700, fontSize:16}}>{job.title}</div>
                  <div style={{opacity:.9}}>
                    {job.company} • {job.location || (job.remote ? 'Remote' : 'Location N/A')}
                  </div>
                  <div style={{opacity:.75, fontSize:13, marginTop:6}}>
                    {job.source} • posted {job.posted_at ? new Date(job.posted_at).toLocaleDateString() : new Date(job.scraped_at).toLocaleDateString()}
                    {job.experience_hint ? ` • ${job.experience_hint}` : ''}
                    {job.category ? ` • ${job.category}` : ''}
                  </div>
                </div>
                <div style={{alignSelf:'center'}}>
                  <span style={{padding:'6px 10px', border:'1px solid #2a3343', borderRadius:999, fontSize:12, opacity:.9}}>
                    Apply ↗
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{display:'flex', gap:8, justifyContent:'center', alignItems:'center', marginTop:24}}>
            <button
              onClick={()=>go(Math.max(1, page-1))}
              disabled={page<=1}
              style={{padding:'8px 12px', borderRadius:8, border:'1px solid #2a3343', background:'#0f141b', color:'#e5e7eb'}}
            >
              ‹ Prev
            </button>
            {pages.map(n => <PageButton key={n} n={n} active={n===page} />)}
            <button
              onClick={()=>go(Math.min(totalPages, page+1))}
              disabled={page>=totalPages}
              style={{padding:'8px 12px', borderRadius:8, border:'1px solid #2a3343', background:'#0f141b', color:'#e5e7eb'}}
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
