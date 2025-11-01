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
  roles: string; // '' or 'popular'
  results: Row[];
};

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function Home() {
  // filters
  const [q, setQ] = useState('');
  const [usOnly, setUsOnly] = useState(true);
  const [roles, setRoles] = useState<'popular' | ''>('popular');
  const [maxAgeDays, setMaxAgeDays] = useState(14); // 14 days default
  const pageSize = 50;

  // data
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const queryUrl = useMemo(() => {
    const u = new URL('/api/jobs_feed', typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
    u.searchParams.set('page', String(page));
    u.searchParams.set('pageSize', String(pageSize));
    u.searchParams.set('maxAgeDays', String(maxAgeDays));
    u.searchParams.set('usOnly', usOnly ? '1' : '0');
    u.searchParams.set('roles', roles);
    if (q.trim()) u.searchParams.set('q', q.trim());
    return u.toString();
  }, [page, pageSize, maxAgeDays, usOnly, roles, q]);

  async function fetchPage(merge = false) {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(queryUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: Feed = await r.json();
      setTotal(j.total);
      setTotalPages(j.totalPages);
      if (merge && items.length > 0) {
        setItems(prev => [...prev, ...j.results]);
      } else {
        setItems(j.results);
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  // load on page change
  useEffect(() => {
    fetchPage(page > 1); // merge when loading > page 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, queryUrl]);

  // apply filters resets to page 1
  function applyFilters() {
    setPage(1);
    fetchPage(false);
  }

  return (
    <>
      <Head>
        <title>Careers Portal — Fresh Jobs (Paginated)</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div style={{ maxWidth: 980, margin: '32px auto', padding: '0 16px', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>Careers Portal</h1>
          <a href="/all-jobs" style={{ fontSize: 14, textDecoration: 'underline' }}>Open full list →</a>
        </header>

        {/* Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <input
            placeholder="Search title/company…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyFilters(); }}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />

          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={usOnly} onChange={e => setUsOnly(e.target.checked)} />
            US only
          </label>

          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={roles === 'popular'} onChange={e => setRoles(e.target.checked ? 'popular' : '')} />
            STEM focus
          </label>

          <select
            value={maxAgeDays}
            onChange={e => setMaxAgeDays(parseInt(e.target.value, 10))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}
            title="Recency window"
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>

          <button
            onClick={applyFilters}
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #222', background: '#111', color: '#fff' }}
          >
            Apply
          </button>
        </div>

        <div style={{ color: '#666', marginBottom: 10 }}>
          Showing <b>{items.length}</b> of <b>{total}</b> jobs (page {page} / {totalPages})
        </div>

        {err && <div style={{ color: '#b00', marginBottom: 10 }}>Error: {err}</div>}

        {/* List */}
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((r, i) => (
            <a key={`${r.url}-${i}`} href={r.url} target="_blank" rel="noreferrer"
               style={{ padding: 14, border: '1px solid #eee', borderRadius: 10, textDecoration: 'none', color: '#111' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{r.title}</div>
              <div style={{ fontSize: 14, color: '#444' }}>
                {r.company} · {r.location || '—'} · {r.source}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{fmtDate(r.when_time)}</div>
            </a>
          ))}
        </div>

        {/* Paging */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '18px 0 40px' }}>
          <button
            disabled={loading || page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}
          >
            ← Prev
          </button>

          <button
            disabled={loading || page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}
          >
            Next →
          </button>

          <button
            disabled={loading || page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #222', background: '#111', color: '#fff' }}
            title="Appends next page to current list"
          >
            Load more
          </button>
        </div>
      </div>
    </>
  );
}
