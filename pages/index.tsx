// pages/index.tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { listJobs, JobRow } from '../lib/db';

type Props = { jobs: JobRow[]; error?: string | null };

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  try {
    const jobs = await listJobs(50);
    return { props: { jobs } };
  } catch (e: any) {
    return { props: { jobs: [], error: String(e?.message ?? e) } };
  }
};

export default function Home({ jobs, error }: Props) {
  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: '0 16px' }}>
      <h1>Careers Portal</h1>
      <p>Fresh postings automatically pulled from Lever &amp; Greenhouse.</p>

      {error && (
        <p style={{ color: 'red' }}>
          Setup note: {error}. If this is a new deploy, visit <code>/api/migrate</code> once,
          then run the cron routes.
        </p>
      )}

      {!jobs.length && !error ? (
        <p>
          No jobs yet. Try running <code>/api/cron/lever?all=1</code> and{' '}
          <code>/api/cron/greenhouse?all=1</code>.
        </p>
      ) : (
        <ul>
          {jobs.map((j) => (
            <li key={j.fingerprint} style={{ marginBottom: 8 }}>
              <strong>{j.title}</strong> — {j.company}
              {j.location ? ` (${j.location})` : ''} ·{' '}
              <Link href={j.url}>Apply</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
