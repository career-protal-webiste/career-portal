// pages/index.tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { listJobs, JobRow } from '../lib/db';

type Props = { jobs: JobRow[]; error?: string };

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  try {
    const jobs = await listJobs(50);
    return { props: { jobs } };
  } catch (e: any) {
    // Do not 500 the page; show a friendly message
    return { props: { jobs: [], error: String(e?.message ?? e) } };
  }
};

export default function Home({ jobs, error }: Props) {
  return (
    <main style={{ maxWidth: 840, margin: '40px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Careers Portal</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Fresh postings automatically pulled from Lever & Greenhouse.
      </p>

      {error && (
        <p style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: 12, borderRadius: 8 }}>
          Setup note: {error}. If this is a new deploy, visit <code>/api/migrate</code> once, then try the cron routes.
        </p>
      )}

      {!jobs.length ? (
        <p>No jobs yet. Try running <code>/api/cron/lever?all=1</code> and <code>/api/cron/greenhouse?all=1</code>.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {jobs.map((j) => (
            <li key={j.id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {j.title}{' '}
                <span style={{ color: '#888', fontWeight: 400 }}>— {j.company}</span>
              </div>
              <div style={{ color: '#666', fontSize: 14, marginTop: 6 }}>
                {j.location || '—'} {j.remote ? '(Remote)' : ''}
                {j.category ? ` • ${j.category}` : ''}
              </div>
              <div style={{ marginTop: 10 }}>
                <Link href={j.url} style={{ color: '#2563eb' }} target="_blank">View posting →</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
