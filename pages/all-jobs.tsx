// pages/all-jobs.tsx
import { useEffect, useState } from 'react';

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
  const [data, setData] = useState<Feed | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [usOnly, setUsOnly] = useState(true);
  const [roles, setRoles] = useState<'popular' | ''>('popular');
  const pageSize = 50; // show 50 per page
  const maxAgeDays = 14;

  async function load() {
    const url = `/api/jobs_feed?page=${page}&pageSize=${pageSize}&maxAgeDays=${maxAgeDays}&usOnly=${usOnly ? '1' : '0'}&roles=${roles}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    const j = await r.json();
    setData(j);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]); // re-load on page change

  return (
    <div style={{ maxWidth: 980, margin: '40px auto', padding: '0 16px', fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>All Jobs (Fresh + Paginated)</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search title/company…"
          style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
        />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={usOnly} onChange={e => setUsOnly(e.target.checked)} />
          US only
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={roles === 'popular'} onChange={e => setRoles(e.target.checked ? 'popular' : '')} />
          Focus STEM roles
        </label>
        <button
          onClick={() => { setPage(1); load(); }}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #222', background: '#111', color: '#fff' }}
        >Apply</button>
      </div>

      {data && (
        <>
          <div style={{ color: '#666', marginBottom: 12 }}>
            Showing page <b>{data.page}</b> / {data.totalPages} — total <b>{data.total}</b> jobs (last {data.maxAgeDays} days)
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {data.results.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noreferrer"
                 style={{ padding: 14, border: '1px solid #eee', borderRadius: 10, textDecoration: 'none', color: '#111' }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: 14, color: '#444' }}>{r.company} · {r.location || '—'} · {r.source}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{new Date(r.when_time).toLocaleString()}</div>
              </a>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
              ← Prev
            </button>
            <span style={{ padding: '8px 12px' }}>Page {page} / {data.totalPages}</span>
            <button disabled={page >= (data?.totalPages || 1)} onClick={() => setPage(p => p + 1)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
