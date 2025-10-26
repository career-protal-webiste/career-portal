// pages/index.tsx
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { ensureSchema, getJobs, JobRow } from '../lib/db';

type Props = { jobs: (JobRow & { posted_at_iso: string | null; scraped_at_iso: string })[] };

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  // Make sure the table exists before we query it (prevents 500 on first load).
  await ensureSchema();

  const rows = await getJobs(50);

  // Convert Dates to strings so Next can serialize them
  const jobs = rows.map((j) => ({
    ...j,
    posted_at_iso: j.posted_at ? j.posted_at.toISOString() : null,
    scraped_at_iso: j.scraped_at.toISOString(),
  }));

  return { props: { jobs } };
};

export default function Home({ jobs }: Props) {
  return (
    <>
      <Head>
        <title>Careers Portal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main style={{ maxWidth: 960, margin: '40px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>Latest roles</h1>
        <p style={{ color: '#888', marginBottom: 24 }}>
          Showing {jobs.length} jobs. Use /api/cron/lever?all=1 and /api/cron/greenhouse?all=1 to load data the first time.
        </p>

        {jobs.length === 0 ? (
          <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 12 }}>
            No jobs yet. Run the cron URLs above (with <code>?all=1</code>) and refresh.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {jobs.map((j) => (
              <li key={j.fingerprint} style={{ padding: 16, border: '1px solid #eee', borderRadius: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 600 }}>
                  {j.title} — {j.company}
                </div>
                <div style={{ color: '#555', fontSize: 14 }}>
                  {j.location || 'Location N/A'} {j.remote ? '(Remote)' : ''}
                </div>
                <a href={j.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                  Apply ↗
                </a>
                <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
                  Posted: {j.posted_at_iso || 'N/A'} • Scraped: {j.scraped_at_iso}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
