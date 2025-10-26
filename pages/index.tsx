// pages/index.tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { listJobs, type JobRow } from '../lib/db';
import { useMemo, useState } from 'react';

type Props = { jobs: JobRow[]; error?: string | null };

function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.floor((Date.now() - then) / 1000);
  const u = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ] as const;

  for (const [name, secs] of u) {
    const v = Math.floor(s / secs);
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export default function Home({ jobs, error }: Props) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter(j =>
      (j.title ?? '').toLowerCase().includes(needle) ||
      (j.company ?? '').toLowerCase().includes(needle) ||
      (j.location ?? '').toLowerCase().includes(needle)
    );
  }, [jobs, q]);

  return (
    <main className="container">
      <header className="header">
        <h1 className="title">Careers Portal</h1>
        <p className="subtitle">Fresh postings automatically pulled from Lever &amp; Greenhouse.</p>
      </header>

      <section className="toolbar">
        <div className="count">
          {error ? <span style={{ color: 'crimson' }}>{error}</span> : `${filtered.length} open roles`}
        </div>
        <div className="search">
          <input
            placeholder="Search title, company, or location…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search jobs"
          />
        </div>
      </section>

      <section className="list">
        {filtered.map((job) => {
          const posted = job.posted_at ?? job.scraped_at ?? null;
          return (
            <article key={job.fingerprint} className="card">
              <div className="row">
                <div className="company">{job.company}</div>
                <span className="dot" aria-hidden />
                <div className="meta">{job.location ?? 'Remote / Various'}</div>
              </div>

              <h3>{job.title}</h3>

              <div className="meta">
                Posted {timeAgo(posted)} {posted ? `(${new Date(posted).toLocaleDateString()})` : ''}
              </div>

              <div className="actions">
                <Link href={job.url ?? '#'} target="_blank" className="apply" rel="noopener noreferrer">
                  Apply
                </Link>
                <Link href={`/api/jobs?company=${encodeURIComponent(job.company ?? '')}`} className="view">
                  View similar in JSON →
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <footer className="meta" style={{ paddingBottom: 40 }}>
        Health check: <Link href="/api/ping" className="view">/api/ping</Link>
        <span className="dot" aria-hidden /> Cron: <span className="view">/api/cron/lever</span> &nbsp;|&nbsp; <span className="view">/api/cron/greenhouse</span>
      </footer>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  try {
    const jobs = await listJobs();
    return { props: { jobs, error: null } };
  } catch (e: any) {
    console.error('index getServerSideProps error', e);
    return { props: { jobs: [], error: String(e?.message ?? e) } };
  }
};
