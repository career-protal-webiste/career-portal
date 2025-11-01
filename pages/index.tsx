import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';

type Row = {
  company: string;
  title: string;
  source: string;
  url: string;
  location: string | null;
  when_time: string; // ISO
};
type Feed = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  maxAgeDays: number;
  usOnly: boolean;
  q: string;
  roles: string; // '' | 'popular'
  results: Row[];
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function Home() {
  // sensible defaults for your USA-student target
  const [q, setQ] = useState('');
  const [usOnly, setUsOnly] = useState(true);
  const [roles, setRoles] = useState<'' | 'popular'>('popular'); // STEM on by default
  const [maxAgeDays, setMaxAgeDays] = useState(60);
  const pageSize = 100;

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Omit<Feed,'results'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const url = useMemo(() => {
    const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    const u = new URL('/api/jobs_feed', base);
    u.searchParams.set('page', String(page));
    u.searchParams.set('pageSize', String(pageSize));
    u.searchParams.set('maxAgeDays', String(maxAgeDays));
    u.searchParams.set('usOnly', usOnly ? '1' : '0');
    if (roles) u.searchParams.set('roles', roles);
    if (q.trim()) u.searchParams.set('q', q.trim());
    // bust any stale caches
    u.searchParams.set('ts', String(Date.now()));
    return u.toString();
  }, [page, pageSize, maxAgeDays, usOnly, roles, q]);

  async function load(append=false) {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: Feed = await r.json();
      setMeta({
        page: j.page, pageSize: j.pageSize, total: j.total, totalPages: j.totalPages,
        maxAgeDays: j.maxAgeDays, usOnly: j.usOnly, q: j.q, roles: j.roles
      });
      setItems(append ? [...items, ...j.results] : j.results);
    } catch (e:any) {
      setErr(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page > 1); /* eslint-disable-next-line */ }, [page, url]);

  function apply() { setPage(1); load(false); }

  return (
    <>
      <Head><title>Career Portal — Fresh Jobs</title><meta name="robots" content="noindex"/></Head>

      <div style={{maxWidth:980, margin:'32px auto', padding:'0 16px', fontFamily:'Inter, system-ui, Arial, sans-serif'}}>
        <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h1 style={{fontSize:26, margin:0}}>Career Portal</h1>
          <a href="/all-jobs" style={{textDecoration:'underline'}}>Open full list →</a>
        </header>

        {/* Filters */}
        <div style={{display:'grid',gridTemplateColumns:'1fr auto auto auto auto',gap:8,alignItems:'center',marginBottom:10}}>
          <input
            placeholder="Search title/company…"
            value={q}
            onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') apply(); }}
            style={{padding:10,borderRadius:8,border:'1px solid #ddd'}}
          />
          <label style={{display:'flex',gap:6,alignItems:'center'}}>
            <input type="checkbox" checked={usOnly} onChange={e=>setUsOnly(e.target.checked)} /> US only
          </label>
          <label style={{display:'flex',gap:6,alignItems:'center'}}>
            <input type="checkbox" checked={roles==='popular'} onChange={e=>setRoles(e.target.checked?'popular':'')} /> STEM focus
          </label>
          <select
            value={maxAgeDays}
            onChange={e=>setMaxAgeDays(parseInt(e.target.value,10))}
            style={{padding:'8px 10px',borderRadius:8,border:'1px solid #ddd',background:'#fff'}}
            title="Recency window"
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
          </select>
          <button onClick={apply} style={{padding:'10px 14px',borderRadius:8,border:'1px solid #222',background:'#111',color:'#fff'}}>Apply</button>
        </div>

        {/* Counter */}
        <div style={{color:'#666',marginBottom:10}}>
          {meta
            ? <>Showing <b>{items.length}</b> of <b>{meta.total}</b> jobs (page {meta.page}/{meta.totalPages})</>
            : <>Loading…</>}
        </div>
        {err && <div style={{color:'#b00',marginBottom:10}}>Error: {err}</div>}

        {/* List */}
        <div style={{display:'grid',gap:10}}>
          {items.map((r,i)=>(
            <a key={`${r.url}-${i}`} href={r.url} target="_blank" rel="noreferrer"
               style={{padding:14,border:'1px solid #eee',borderRadius:10,textDecoration:'none',color:'#111'}}>
              <div style={{fontSize:16,fontWeight:600}}>{r.title}</div>
              <div style={{fontSize:14,color:'#444'}}>{r.company} · {r.location || '—'} · {r.source}</div>
              <div style={{fontSize:12,color:'#888',marginTop:6}}>{fmt(r.when_time)}</div>
            </a>
          ))}
        </div>

        {/* Paging */}
        <div style={{display:'flex',gap:8,justifyContent:'center',margin:'18px 0 40px'}}>
          <button disabled={loading || (meta?.page||1) <= 1}
                  onClick={()=>setPage(p=>Math.max(1,p-1))}
                  style={{padding:'10px 14px',borderRadius:8,border:'1px solid #ddd',background:'#fff'}}>← Prev</button>
          <button disabled={loading || (meta?.page||1) >= (meta?.totalPages||1)}
                  onClick={()=>setPage(p=>p+1)}
                  style={{padding:'10px 14px',borderRadius:8,border:'1px solid #ddd',background:'#fff'}}>Next →</button>
          <button disabled={loading || (meta?.page||1) >= (meta?.totalPages||1)}
                  onClick={()=>setPage(p=>p+1)}
                  style={{padding:'10px 14px',borderRadius:8,border:'1px solid #222',background:'#111',color:'#fff'}}>Load more</button>
        </div>
      </div>
    </>
  );
}
