// pages/index.tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { listJobs, type JobRow } from '../lib/queries';

type Props = {
  nowISO: string;
  jobs: JobRow[];
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const jobs = await listJobs(300); // grab plenty; we filter client-side
  return { props: { jobs, nowISO: new Date().toISOString() } };
};

// helpers (no external deps)
function toDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function relativeTime(fromISO: string | null, nowISO: string): string {
  const from = toDate(fromISO) ?? toDate(nowISO)!;
  const now = new Date(nowISO);
  const diffMs = now.getTime() - from.getTime();
  const s = Math.max(0, Math.floor(diffMs / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} day${d > 1 ? 's' : ''} ago`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''} ago`;
  if (m > 0) return `${m} minute${m > 1 ? 's' : ''} ago`;
  return 'just now';
}
function formatUTC(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC`;
}
function money(min?: number | null, max?: number | null, currency?: string | null) {
  if (!currency || (min == null && max == null)) return null;
  const fmt = (v: number) => v.toLocaleString(undefined, { style: 'currency', currency });
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return fmt(max!);
}
function isRemote(r: JobRow['remote']): boolean {
  if (typeof r === 'boolean') return r;
  return typeof r === 'string' && /remote/i.test(r);
}

type WindowOpt = '1h' | '24h' | '72h' | 'all';

export default function Home({ jobs, nowISO }: Props) {
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<string | null>(null);
  const [win, setWin] = useState<WindowOpt>('all');

  const filtered = useMemo(() => {
    const q = (quick ? `${query} ${quick}` : query).trim().toLowerCase();

    const within = (postedISO: string | null) => {
      if (win === 'all') return true;
      const posted = toDate(postedISO);
      if (!posted) return false;
      const now = new Date(nowISO);
      const diffHrs = (now.getTime() - posted.getTime()) / 36e5;
      return win === '1h' ? diffHrs <= 1
           : win === '24h' ? diffHrs <= 24
           : diffHrs <= 72;
    };

    return jobs.filter(j => {
      if (!within(j.posted_at ?? j.scraped_at)) return false;
      if (!q) return true;
      const hay = [
        j.title, j.company, j.location, j.category,
        j.employment_type, j.experience_hint
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [jobs, nowISO, query, quick, win]);

  const roleChips = ['Analyst', 'SDE', 'Data Scientist', 'Product Manager'];

  return (
    <div className="container">
      <div className="kicker">Careers Portal</div>
      <h1 className="h1">Careers Portal</h1>
      <div className="subtle">Fresh postings automatically pulled from Lever &amp; Greenhouse.</div>

      <div className="toolbar">
        <div className="chips">
          {roleChips.map(label => (
            <button
              key={label}
              className={`chip ${quick === label.toLowerCase() ? 'active' : ''}`}
              onClick={() =>
                setQuick(curr => curr === label.toLowerCase() ? null : label.toLowerCase())
              }
              title={`Filter by ${label}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{display:'flex', gap: 8}}>
          <input
            className="input"
            placeholder="Search title, company, or location…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="segment" style={{marginTop: 6, marginBottom: 12}}>
        <button className={win==='1h'?'active':''} onClick={() => setWin('1h')}>Last hour</button>
        <button className={win==='24h'?'active':''} onClick={() => setWin('24h')}>24 hours</button>
        <button className={win==='72h'?'active':''} onClick={() => setWin('72h')}>3 days</button>
        <button className={win==='all'?'active':''} onClick={() => setWin('all')}>All</button>
      </div>

      <div className="count">{filtered.length} open roles</div>

      <div className="grid">
        {filtered.map(job => {
          const postedISO = job.posted_at ?? job.scraped_at;
          const rel = relativeTime(postedISO, nowISO);
          const utc = formatUTC(postedISO);
          const isHot = (() => {
            const d = toDate(postedISO);
            if (!d) return false;
            const hrs = (new Date(nowISO).getTime() - d.getTime()) / 36e5;
            return hrs <= 1;
          })();
          const pay = money(job.salary_min ?? undefined, job.salary_max ?? undefined, job.currency ?? undefined);
          return (
            <article className="card" key={job.fingerprint}>
              <header>
                <strong>{job.company ?? 'Unknown'}</strong>
                <span className="dot" />
                <span>{job.location ?? (isRemote(job.remote) ? 'Remote' : '—')}</span>
              </header>

              <div className="title">{job.title ?? 'Untitled role'}</div>

              <div className="meta">
                <span>Posted {rel} ({utc})</span>
                {job.experience_hint ? <span>• {job.experience_hint}</span> : null}
                {job.category ? <span>• {job.category}</span> : null}
              </div>

              <div className="badges">
                {isHot && <span className="badge ctr">🔥 High CTR</span>}
                {pay && <span className="badge salary">💸 {pay}</span>}
                {isRemote(job.remote) && <span className="badge">🏡 Remote</span>}
                {job.employment_type && <span className="badge">{job.employment_type}</span>}
              </div>

              <div className="actions">
                <a
                  className="btn primary"
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Apply
                </a>
                <Link className="btn secondary" href={`/job/${encodeURIComponent(job.fingerprint)}`}>
                  Details
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="note">
        Note: Times are shown in UTC. Salary appears when the source provides it. “High CTR” simply
        highlights roles posted within the last hour to improve click-through.
      </footer>
    </div>
  );
}
