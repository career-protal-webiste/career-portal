// pages/all-jobs.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';

type Job = {
  company: string;
  title: string;
  source: string;
  url: string;
  location: string | null;
  when_time: string | null;
};

const ROLE_OPTIONS = [
  { key: 'software', label: 'Software' },
  { key: 'data_engineer', label: 'Data Eng' },
  { key: 'data_science', label: 'Data Science / ML' },
  { key: 'devops', label: 'DevOps / SRE' },
  { key: 'security', label: 'Security' },
  { key: 'qa', label: 'QA / SDET' },
  { key: 'analyst', label: 'Analyst' },
  { key: 'product', label: 'Product' },
];

const AGE_OPTIONS = [
  { v: 1, label: 'Last 24h' },
  { v: 3, label: 'Last 3 days' },
  { v: 7, label: 'Last 7 days' },
  { v: 30, label: 'Last 30 days' },
  { v: 60, label: 'Last 60 days' },
];

function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const h = Math.floor(diff / 36e5);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.floor(h / 24);
  return `${d2}d ago`;
}

export default function AllJobs() {
  const [q, setQ] = useState('');
  const [usOnly, setUsOnly] = useState(true);
  const [age, setAge] = useState(7);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['software','data_engineer','data_science']);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rolesCsv = useMemo(() => selectedRoles.join(','), [selectedRoles]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        q,
        usOnly: usOnly ? '1' : '0',
        maxAgeDays: String(age),
        roles: rolesCsv,
      });
      const r = await fetch(`/api/jobs_feed?${params.toString()}`);
      const j = await r.json();
      setRows(j.results || []);
      setTotal(j.total || 0);
      // reflect in URL for shareability
      const url = `/all-jobs?${params.toString()}`;
      window.history.replaceState(null, '', url);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize]);
  // Apply button will also call load().

  return (
    <>
      <Head><title>All Jobs — Career Portal</title></Head>
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">All Jobs</h1>
            <div className="text-sm text-neutral-400">
              {loading ? 'Loading…' : `Showing ${rows.length} of ${total} • Page ${page}/${totalPages}`}
            </div>
          </div>

          {/* Filters */}
          <div className="sticky top-0 z-10 mb-6 rounded-xl border border-neutral-800 bg-neutral-900/70 backdrop-blur px-4 py-3">
            <div className="flex flex-wrap gap-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title / company / location"
                className="flex-1 min-w-[260px] rounded-lg bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={usOnly} onChange={() => setUsOnly(!usOnly)} />
                US only
              </label>
              <select
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value))}
                className="rounded-lg bg-neutral-800 px-3 py-2"
              >
                {AGE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              <select
                value={pageSize}
                onChange={(e) => { setPage(1); setPageSize(parseInt(e.target.value)); }}
                className="rounded-lg bg-neutral-800 px-3 py-2"
              >
                {[25,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
              </select>
              <button
                onClick={() => { setPage(1); load(); }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
              >
                Apply
              </button>
            </div>

            {/* Role chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(r => {
                const on = selectedRoles.includes(r.key);
                return (
                  <button
                    key={r.key}
                    onClick={() => {
                      setPage(1);
                      setSelectedRoles(on
                        ? selectedRoles.filter(k => k !== r.key)
                        : [...selectedRoles, r.key]);
                    }}
                    className={`rounded-full px-3 py-1 text-sm border ${
                      on ? 'bg-blue-600 border-blue-500' : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            {rows.map((j, i) => (
              <a
                key={`${j.url}-${i}`}
                href={j.url} target="_blank" rel="noreferrer"
                className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold leading-tight">{j.title}</div>
                    <div className="mt-1 text-sm text-neutral-300">{j.company}</div>
                    <div className="mt-1 text-sm text-neutral-400">{j.location || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-300">
                      <span>{j.source}</span>
                      <span className="opacity-60">•</span>
                      <span>{timeAgo(j.when_time)}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}

            {!loading && rows.length === 0 && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center text-neutral-300">
                No results. Try widening filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-neutral-700 px-3 py-1 text-sm disabled:opacity-40"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(7, totalPages) }).map((_, idx) => {
              // simple window around current
              const start = Math.max(1, Math.min(page - 3, totalPages - 6));
              const n = start + idx;
              if (n > totalPages) return null;
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`rounded-lg px-3 py-1 text-sm ${
                    n === page ? 'bg-blue-600' : 'border border-neutral-700'
                  }`}
                >
                  {n}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-neutral-700 px-3 py-1 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
