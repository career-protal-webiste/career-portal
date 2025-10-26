// pages/index.tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { listJobs, type JobRow } from '../lib/queries';

type Props = { jobs: JobRow[]; error?: string | null };

export default function Home({ jobs, error }: Props) {
  return (
    <main style={{ maxWidth: 960, margin: '48px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 8 }}>Careers Portal</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>Fresh postings automatically pulled from Lever & Greenhouse.</p>

      {error ? (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          Couldn’t load jobs right now. Showing an empty list. ({error})
        </div>
      ) : null}

      <div style={{ color: '#6b7280', marginBottom: 12 }}>{jobs.length} open roles</div>

      <ul style={{ display: 'grid', gap: 16 }}>
        {jobs.map((j) => (
          <li key={j.fingerprint} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              {j.company ?? '—'} • {j.location ?? '—'}
            </div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{j.title ?? 'Untitled role'}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href={j.url ?? '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                Apply
              </a>
              <Link href={`/jobs/${j.fingerprint}`} style={{ textDecoration: 'underline' }}>
                Details
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  try {
    const jobs = await listJobs(100);
    return { props: { jobs } };
  } catch (e: any) {
    console.error('Home getServerSideProps error:', e);
    return { props: { jobs: [], error: e?.message ?? 'server error' } };
  }
};
