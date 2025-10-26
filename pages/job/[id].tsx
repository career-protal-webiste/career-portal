// pages/job/[id].tsx
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { getJobById, listSimilar, type JobRow } from '../../lib/queries';

type Props = { job: JobRow; similar: JobRow[]; nowISO: string };

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const id = String(ctx.params?.id ?? '');
  const job = await getJobById(id);
  if (!job) return { notFound: true };
  const similar = await listSimilar(job, 6);
  return { props: { job, similar, nowISO: new Date().toISOString() } };
};

function money(min?: number | null, max?: number | null, currency?: string | null) {
  if (!currency || (min == null && max == null)) return null;
  const fmt = (v: number) => v.toLocaleString(undefined, { style: 'currency', currency });
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return fmt(max!);
}
function isRemote(v: JobRow['remote']): boolean {
  if (typeof v === 'boolean') return v;
  return typeof v === 'string' && /remote/i.test(v);
}
function formatUTC(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC`;
}
function relative(fromISO: string | null, nowISO: string): string {
  const from = fromISO ? new Date(fromISO) : new Date(nowISO);
  const diff = (new Date(nowISO).getTime() - from.getTime()) / 1000;
  const m = Math.floor(diff / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d} day${d > 1 ? 's':''} ago`;
  if (h > 0) return `${h} hour${h > 1 ? 's':''} ago`;
  if (m > 0) return `${m} minute${m > 1 ? 's':''} ago`;
  return 'just now';
}

export default function JobDetail({ job, similar, nowISO }: Props) {
  const pay = money(job.salary_min ?? undefined, job.salary_max ?? undefined, job.currency ?? undefined);
  const postedISO = job.posted_at ?? job.scraped_at;

  return (
    <>
      <Head>
        <title>{job.title ? `${job.title} – ${job.company}` : 'Job'} | Careers Portal</title>
        {job.url ? <link rel="canonical" href={job.url} /> : null}
        <meta name="description" content={`${job.company ?? ''} • ${job.location ?? (isRemote(job.remote) ? 'Remote' : '')}`} />
      </Head>

      <div className="detail">
        <div style={{marginBottom: 8}}>
          <Link href="/" className="btn ghost">← Back to listings</Link>
        </div>

        <div className="kicker">{job.company ?? 'Company'}</div>
        <h1>{job.title ?? 'Untitled role'}</h1>

        <div className="row" style={{marginTop: 6}}>
          {job.location ? <span>📍 {job.location}</span> : null}
          {isRemote(job.remote) ? <span>• 🏡 Remote</span> : null}
          {job.employment_type ? <span>• {job.employment_type}</span> : null}
          {job.experience_hint ? <span>• {job.experience_hint}</span> : null}
          {job.category ? <span>• {job.category}</span> : null}
        </div>

        <div className="row" style={{marginTop: 6}}>
          <span>Posted {relative(postedISO, nowISO)} ({formatUTC(postedISO)})</span>
          {pay ? <span>• 💸 {pay}</span> : null}
        </div>

        <div className="actions" style={{marginTop: 14}}>
          {job.url ? <a href={job.url} target="_blank" rel="noreferrer" className="btn primary">Apply on site</a> : null}
        </div>

        <div className="desc">
          {job.description ? job.description : 'No description available.'}
        </div>

        {similar.length ? (
          <>
            <h2 style={{marginTop: 32, marginBottom: 10}}>Similar roles</h2>
            <div className="grid">
              {similar.map(s => (
                <article className="card" key={s.fingerprint}>
                  <header>
                    <strong>{s.company ?? 'Unknown'}</strong>
                    <span className="dot" />
                    <span>{s.location ?? (isRemote(s.remote) ? 'Remote' : '—')}</span>
                  </header>
                  <div className="title">{s.title ?? 'Untitled role'}</div>
                  <div className="meta">Posted {relative(s.posted_at ?? s.scraped_at, nowISO)} ({formatUTC(s.posted_at ?? s.scraped_at)})</div>
                  <div className="actions">
                    <Link className="btn secondary" href={`/job/${encodeURIComponent(s.fingerprint)}`}>Details</Link>
                    {s.url ? <a className="btn" href={s.url} target="_blank" rel="noreferrer">Apply</a> : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
