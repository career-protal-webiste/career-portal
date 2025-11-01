// components/JobFeedView.tsx
import React, { useEffect, useMemo, useState } from 'react';
import FiltersBar from './FiltersBar';
import JobCard, { Job } from './JobCard';
import Pagination from './Pagination';

type FeedResp = {
  page: number; pageSize: number; total: number; totalPages: number;
  maxAgeDays: number; usOnly: boolean; q: string; roles: string; results: Job[];
};

export default function JobFeedView(props: {
  defaultUsOnly?: boolean;
  defaultRolesCsv?: string;   // e.g., 'popular' (your API supports mapped roles)
  defaultMaxAge?: number;     // e.g., 60
  title?: string;
  showOpenAllLink?: boolean;
}) {
  const {
    defaultUsOnly = true,
    defaultRolesCsv = '',      // '' on /all-jobs to show everything
    defaultMaxAge = 60,
    title = 'Career Portal',
    showOpenAllLink = true,
  } = props;

  const [q, setQ] = useState('');
  const [usOnly, setUsOnly] = useState(defaultUsOnly);
  const [roles, setRoles] = useState<string[]>(defaultRolesCsv ? defaultRolesCsv.split(',') : []);
  const [maxAgeDays, setMaxAgeDays] = useState(defaultMaxAge);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FeedResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = useMemo(()=>{
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '100');
    params.set('maxAgeDays', String(maxAgeDays));
    params.set('usOnly', usOnly ? '1':'0');
    if (q.trim()) params.set('q', q.trim());
    if (roles.length) params.set('roles', roles.join(','));
    return `/api/jobs_feed?${params.toString()}`;
  }, [q, usOnly, roles, maxAgeDays, page]);

  useEffect(()=>{
    setLoading(true); setError(null);
    fetch(apiUrl)
      .then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json:FeedResp)=> setData(json))
      .catch(e=>setError(e?.message || 'Failed to load'))
      .finally(()=>setLoading(false));
  }, [apiUrl]);

  const apply = () => setPage(1);
  const reset = () => { setQ(''); setUsOnly(defaultUsOnly); setRoles(defaultRolesCsv? defaultRolesCsv.split(','):[]); setMaxAgeDays(defaultMaxAge); setPage(1); };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.h1}>{title}</h1>
        {showOpenAllLink ? <a href="/all-jobs" style={styles.link}>Open full list →</a> : <span/>}
      </header>

      <FiltersBar
        q={q} setQ={setQ}
        usOnly={usOnly} setUsOnly={setUsOnly}
        maxAgeDays={maxAgeDays} setMaxAgeDays={setMaxAgeDays}
        roles={roles} setRoles={setRoles}
        onApply={apply} onReset={reset}
        extraLink={<a href="/all-jobs" style={styles.link}>Full list →</a>}
      />

      <section style={styles.meta}>
        {loading ? 'Loading…' : error ? <span style={{color:'#ff8a8a'}}>Error: {error}</span> : (
          <span>
            Showing <strong>{Math.min(100, data?.results.length ?? 0)}</strong> of{' '}
            <strong>{(data?.total ?? 0).toLocaleString()}</strong> jobs (page {data?.page ?? 1}/{data?.totalPages ?? 1})
          </span>
        )}
      </section>

      <main style={styles.list}>
        {(data?.results || []).map((job, i)=> <JobCard key={`${job.url}-${i}`} job={job} />)}
      </main>

      <Pagination
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />
    </div>
  );
}

const styles:Record<string,any>={
  page:{minHeight:'100vh', padding:'24px 16px'},
  header:{maxWidth:1100, margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'space-between'},
  h1:{fontSize:28, fontWeight:700, letterSpacing:0.2},
  link:{color:'#9fb3ff', textDecoration:'none'},
  meta:{maxWidth:1100, margin:'4px auto 12px', fontSize:14, opacity:0.9},
  list:{maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr', gap:10},
};
