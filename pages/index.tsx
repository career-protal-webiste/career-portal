// pages/index.tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { listFilteredJobs, type JobRow } from '../lib/queries';

type Props = {
  jobs: JobRow[];
  q: string;
  role: string;
  since: string;       // '1h' | '24h' | '72h' | 'all'
  remoteOnly: boolean;
  usOnly: boolean;
  error?: string | null;
};

function hoursFor(since: string) {
  if (since === '1h') return 1;
  if (since === '24h') return 24;
  if (since === '72h') return 72;
  return null;
}

export default function Home({ jobs, q, role, since, remoteOnly, usOnly, error }: Props) {
  const chips = [
    { k: 'analyst', label: 'Analyst' },
    { k: 'sde', label: 'SDE' },
    { k: 'data-scientist', label: 'Data Scientist' },
    { k: 'data-engineer', label: 'Data Engineer' },
    { k: 'product-manager', label: 'Product Manager' },
  ];
  const time = [
    { k: '1h', label: 'Last hour' },
    { k: '24h', label: '24 hours' },
    { k: '72h', label: '3 days' },
    { k: 'all', label: 'All' },
  ];

  const card = {
    border: '1px solid #2f2f33',
    borderRadius: 14,
    padding: 16,
    background: '#121316',
  } as const;

  function fmtPosted(j: JobRow) {
    if (!j.posted_at) return null;
    const diffMs = Date.now() - new Date(j.posted_at).getTime();
    const h = Math.floor(diffMs / 3600_000);
    const m = Math.max(1, Math.floor((diffMs % 3600_000) / 60_000));
    if (h < 1) return `${m} min ago`;
    if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d > 1 ? 's' : ''} ago`;
  }

  const header = { maxWidth: 1100, margin: '48px auto', padding: '0 16px', color: '#e5e7eb' } as const;

  return (
    <main style={header}>
      <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 6 }}>Careers Portal</div>
      <h1 style={{ fontSize: 44, fontWeight: 800, marginBottom: 8 }}>Careers Portal</h1>
      <p style={{ color: '#9ca3af', marginBottom: 24 }}>Fresh postings automatically pulled from Lever & Greenhouse.</p>

      {/* Controls */}
      <form method="get" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center' }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title, company, or location…"
          style={{
            width: '100%',
            background: '#0b0c0f',
            border: '1px solid #2f2f33',
            color: '#e5e7eb',
            borderRadius: 12,
            padding: '12px 14px',
            outline: 'none',
          }}
        />
        <input type="hidden" name="since" value={since} />
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="remote" value={remoteOnly ? '1' : ''} />
        <input type="hidden" name="us" value={usOnly ? '1' : ''} />
        <button
          type="submit"
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #374151', background: '#1f2937', color: '#e5e7eb' }}
        >
          Search
        </button>
        <a href="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>Reset</a>
      </form>

      {/* Quick role chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {chips.map(c => {
          const url = new URLSearchParams({ q, since, role: c.k, remote: remoteOnly ? '1' : '', us: usOnly ? '1' : '' }).toString();
          const active = role === c.k;
          return (
            <a
              key={c.k}
              href={`/?${url}`}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: '1px solid ' + (active ? '#60a5fa' : '#374151'),
                background: active ? '#0b1220' : '#0b0c0f',
                color: active ? '#bfdbfe' : '#e5e7eb',
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              {c.label}
            </a>
          );
        })}
      </div>

      {/* Time chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {time.map(t => {
          const url = new URLSearchParams({ q, since: t.k, role, remote: remoteOnly ? '1' : '', us: usOnly ? '1' : '' }).toString();
          const active = since === t.k;
          return (
            <a
              key={t.k}
              href={`/?${url}`}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid ' + (active ? '#34d399' : '#374151'),
                background: active ? '#062015' : '#0b0c0f',
                color: active ? '#a7f3d0' : '#e5e7eb',
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              {t.label}
            </a>
          );
        })}

        {/* Toggles */}
        <a
          href={`/?${new URLSearchParams({ q, role, since, remote: remoteOnly ? '' : '1', us: usOnly ? '1' : '' })}`}
          style={{
            marginLeft: 8, padding: '6px 10px', borderRadius: 999, fontSize: 13,
            border: '1px solid ' + (remoteOnly ? '#fbbf24' : '#374151'),
            background: remoteOnly ? '#1f1403' : '#0b0c0f', color: remoteOnly ? '#fde68a' : '#e5e7eb', textDecoration: 'none'
          }}
        >
          {remoteOnly ? 'Remote only ✓' : 'Remote only'}
        </a>
        <a
          href={`/?${new URLSearchParams({ q, role, since, remote: remoteOnly ? '1' : '', us: usOnly ? '' : '1' })}`}
          style={{
            padding: '6px 10px', borderRadius: 999, fontSize: 13,
            border: '1px solid ' + (usOnly ? '#c084fc' : '#374151'),
            background: usOnly ? '#1a0f24' : '#0b0c0f', color: usOnly ? '#e9d5ff' : '#e5e7eb', textDecoration: 'none'
          }}
        >
          {usOnly ? 'US only ✓' : 'US only'}
        </a>
      </div>

      {/* Meta / errors */}
      <div style={{ color: '#9ca3af', marginTop: 18 }}>{jobs.length} open roles</div>
      {error ? (
        <div style={{ background: '#3f2d11', color: '#fde68a', border: '1px solid #f59e0b', padding: 10, borderRadius: 10, marginTop: 8 }}>
          Couldn’t load everything from the DB. Showing what we could. ({error})
        </div>
      ) : null}

      {/* Results */}
      <ul style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        {jobs.map(j => {
          const isHot = j.posted_at && Date.now() - new Date(j.posted_at).getTime() <= 3600_000;
          return (
            <li key={j.fingerprint} style={card}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
                {j.company ?? '—'} • {j.location ?? '—'} {j.remote ? '• Remote' : ''}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{j.title ?? 'Untitled role'}</div>
                {isHot ? (
                  <span style={{
                    marginLeft: 6, fontSize: 11, padding: '3px 6px', borderRadius: 6,
                    background: '#0b1220', border: '1px solid #60a5fa', color: '#bfdbfe'
                  }}>High CTR</span>
                ) : null}
              </div>

              <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
                {j.url ? (
                  <a href={j.url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'underline' }}>
                    Apply
                  </a>
                ) : null}
                <Link href={`/jobs/${j.fingerprint}`} style={{ color: '#93c5fd', textDecoration: 'underline' }}>
                  Details
                </Link>
                {j.posted_at ? (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
                    Posted {fmtPosted(j)}{/* exact: */} {` (${new Date(j.posted_at).toLocaleDateString()})`}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <p style={{ color: '#6b7280', fontSize: 12, marginTop: 18 }}>
        Note: Times are shown in UTC. Salary appears when the source provides it. “High CTR” highlights roles posted within the last hour.
      </p>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const q = String(ctx.query.q ?? '');
  const role = String(ctx.query.role ?? '');
  const since = String(ctx.query.since ?? 'all');    // '1h' | '24h' | '72h' | 'all'
  const remoteOnly = String(ctx.query.remote ?? '') === '1';
  const usOnly = String(ctx.query.us ?? '') === '1';

  try {
    const jobs = await listFilteredJobs({
      q,
      role: (role as any) || '',
      sinceHours: hoursFor(since),
      remoteOnly,
      usOnly,
      maxYears: 5,      // focus early-career by default
      limit: 120,
    });
    return { props: { jobs, q, role, since, remoteOnly, usOnly } };
  } catch (e: any) {
    console.error('Home SSR error:', e);
    return { props: { jobs: [], q, role, since, remoteOnly, usOnly, error: e?.message ?? 'server error' } };
  }
};
