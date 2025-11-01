// pages/all-jobs.tsx
import { useEffect, useMemo, useState } from 'react';

type Row = {
  company: string;
  title: string;
  source: string;
  url: string;
  location: string | null;
  when_time: string;
};
type Feed = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  maxAgeDays: number;
  usOnly: boolean;
  q: string;
  roles: string;
  results: Row[];
};

export default function AllJobs() {
  const [q, setQ] = useState('');
  const [usOnly, setUsOnly] = useState(true);       // keep US-only, but broadened server-side
  const [roles, setRoles] = useState<'' | 'popular'>(''); // default = show ALL roles
  const [maxAgeDays, setMaxAgeDays] = useState(60); // bigger window so you see volume
  const pageSize = 100;

  const [page, setPage] = useState(1);
  const [data, setData] = useState<Feed | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const url = useMemo(() => {
    const u = new URL('/api/jobs_feed', typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
    u.searchParams.set('page', String(page));
    u.searchParams.set('pageSize', String(pageSize));
    u.searchParams.set('maxAgeDays', String(maxAgeDays));
    u.searchParams.set('usOnly', usOnly ? '1' : '0');
    if (roles) u.searchParams.set('roles', roles);
    if (q.trim()) u.searchParams.set('q', q.trim());
    return u.toString();
  }, [page, pageSize, maxAgeDays, usOnly, roles, q]);

  async function load(merge=false) {
    setLoading(true);
    try {
      const r = await fetch(url);
      const j: Feed = await r.json();
      setData(j);
      setItems(merge ? [...items, ...j.results] : j.results);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page > 1); /* eslint-disable-next-line */ }, [page, url]);

  function apply() {
    setPage(1);
    load(false);
  }

  return (
    <div style={{ maxWidth: 980, margin: '40px auto', padding: '0 16px', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>All Jobs (Paginated)</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title/company…" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={usOnly} onChange={e => setUsOnly(e.target.checked)} />
          US only
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={roles === 'popular'} onChange={e => setRoles(e.target.checked ? 'popular' : '')} />
          STEM focus
        </label>
        <select value={maxAgeDays} onChange={e => setMaxAgeDays(parseInt(e.target.value, 10))}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
        </select>
        <button onClick={apply} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #222', background: '#111', color: '#fff' }}>
          Apply
        </button>
      </div>

      {data && (
        <div style={{ color: '#666', marginBottom: 12 }}>
          Showing <b>{items.length}</b> of <b>{data.total}</b> jobs — page <b>{data.page}</b> / {data.totalPages}
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((r, i) => (
          <a key={`${r.url}-${i}`} href={r.url} target="_blank" rel="noreferrer"
             style={{ padding: 14, border: '1px solid #eee', borderRadius: 10, textDecoration: 'none', color: '#111' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{r.title}</div>
            <div style={{ fontSize: 14, color: '#444' }}>{r.company} · {r.location || '—'} · {r.source}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{new Date(r.when_time).toLocaleString()}</div>
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
        <button disabled={loading || !data || data.page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
          ← Prev
        </button>
        <button disabled={loading || !data || data.page >= (data.totalPages || 1)}
                onClick={() => setPage(p => p + 1)}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
          Next →
        </button>
        <button disabled={loading || !data || data.page >= (data.totalPages || 1)}
                onClick={() => setPage(p => p + 1)}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #222', background: '#111', color: '#fff' }}>
          Load more
        </button>
      </div>
    </div>
  );
}
