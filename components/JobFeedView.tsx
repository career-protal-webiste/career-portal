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
  defaultRolesCsv?: string;
  defaultMaxAge?: number;
  title?: string;
  showOpenAllLink?: boolean;
}) {
  const {
    defaultUsOnly   = true,
    defaultRolesCsv = '',
    defaultMaxAge   = 60,
    title           = 'Career Portal',
    showOpenAllLink = true,
  } = props;

  const [q, setQ]               = useState('');
  const [usOnly, setUsOnly]     = useState(defaultUsOnly);
  const [roles, setRoles]       = useState<string[]>(defaultRolesCsv ? defaultRolesCsv.split(',') : []);
  const [exp, setExp]           = useState('');
  const [maxAgeDays, setMaxAgeDays] = useState(defaultMaxAge);
  const [page, setPage]         = useState(1);

  const [loading, setLoading]   = useState(false);
  const [data, setData]         = useState<FeedResp | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page',       String(page));
    params.set('pageSize',   '100');
    params.set('maxAgeDays', String(maxAgeDays));
    params.set('usOnly',     usOnly ? '1' : '0');
    if (q.trim())      params.set('q',     q.trim());
    if (roles.length)  params.set('roles', roles.join(','));
    if (exp)           params.set('exp',   exp);
    return `/api/jobs_feed?${params.toString()}`;
  }, [q, usOnly, roles, exp, maxAgeDays, page]);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(apiUrl)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json: FeedResp) => setData(json))
      .catch(e => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const apply = () => setPage(1);
  const reset = () => {
    setQ(''); setUsOnly(defaultUsOnly);
    setRoles(defaultRolesCsv ? defaultRolesCsv.split(',') : []);
    setExp(''); setMaxAgeDays(defaultMaxAge); setPage(1);
  };

  const total   = data?.total ?? 0;
  const showing = data?.results.length ?? 0;

  return (
    <div style={st.page}>
      {/* Header */}
      <header style={st.header}>
        <div>
          <h1 style={st.h1}>{title}</h1>
          <p style={st.subtitle}>
            Fresh jobs for Indian students in the US — updated every 15 min from 7 ATS platforms
          </p>
        </div>
        {showOpenAllLink && (
          <a href="/all-jobs" style={st.link}>All jobs →</a>
        )}
      </header>

      {/* Filters */}
      <FiltersBar
        q={q}             setQ={setQ}
        usOnly={usOnly}   setUsOnly={setUsOnly}
        maxAgeDays={maxAgeDays} setMaxAgeDays={setMaxAgeDays}
        roles={roles}     setRoles={setRoles}
        exp={exp}         setExp={setExp}
        onApply={apply}   onReset={reset}
        extraLink={showOpenAllLink
          ? <a href="/all-jobs" style={st.link}>Full list →</a>
          : undefined}
      />

      {/* Meta row */}
      <section style={st.meta}>
        {loading ? (
          <span style={st.loading}>Loading…</span>
        ) : error ? (
          <span style={{ color: '#f87171' }}>⚠ {error}</span>
        ) : (
          <span>
            Showing <strong>{showing}</strong> of{' '}
            <strong>{total.toLocaleString()}</strong> jobs
            {total === 0 && (
              <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                — crons are warming up, check back in a few minutes
              </span>
            )}
          </span>
        )}
      </section>

      {/* Job grid */}
      <main style={st.grid}>
        {(data?.results || []).map((job, i) => (
          <JobCard key={`${job.url}-${i}`} job={job} />
        ))}
      </main>

      {/* Pagination */}
      {(data?.totalPages ?? 1) > 1 && (
        <Pagination
          page={data?.page ?? 1}
          totalPages={data?.totalPages ?? 1}
          onPage={setPage}
        />
      )}
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  page:     { minHeight: '100vh', padding: '28px 16px 60px' },
  header:   { maxWidth: 1100, margin: '0 auto 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  h1:       { fontSize: 26, fontWeight: 700, letterSpacing: 0.1, margin: 0, color: '#e8ecff' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' },
  link:     { color: 'var(--brand-light)', textDecoration: 'none', fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap' },
  meta:     { maxWidth: 1100, margin: '0 auto 12px', fontSize: 13.5, color: 'var(--muted)' },
  loading:  { color: 'var(--muted-2)' },
  grid:     {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: 10,
  },
};
