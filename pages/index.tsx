// pages/index.tsx
import Head from 'next/head';
import type { GetServerSideProps } from 'next';
import { getLatestJobs, JobRecord } from '../lib/db';

type Props = { jobs: JobRecord[]; error?: string | null };

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  try {
    const jobs = await getLatestJobs(50);
    return { props: { jobs } };
  } catch (e: any) {
    console.error('Home SSR error:', e);
    return { props: { jobs: [], error: e?.message || 'Unknown error' } };
  }
};

export default function Home({ jobs, error }: Props) {
  return (
    <>
      <Head>
        <title>Careers Portal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main style={{ maxWidth: 960, margin: '40px auto', padding: '0 16px' }}>
        <h1>Careers Portal</h1>

        {error && (
          <p style={{ color: 'crimson' }}>
            Error loading jobs: {error}
          </p>
        )}

        {!error && jobs.length === 0 && (
          <p>No jobs yet. Run the cron endpoints to fetch postings.</p>
        )}

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {jobs.map((j) => (
            <li
              key={j.fingerprint}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <a href={j.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <h3 style={{ margin: '0 0 6px' }}>
                  {j.title} — {j.company}
                </h3>
              </a>
              <div style={{ color: '#6b7280' }}>
                {j.location ?? 'Location n/a'} {j.remote ? '· Remote' : ''}
              </div>
              {j.posted_at && (
                <div style={{ color: '#6b7280', fontSize: 14, marginTop: 6 }}>
                  Posted: {new Date(j.posted_at).toLocaleDateString()}
                </div>
              )}
              {j.description && (
                <p style={{ marginTop: 8 }}>
                  {j.description.slice(0, 240)}
                  {j.description.length > 240 ? '…' : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
