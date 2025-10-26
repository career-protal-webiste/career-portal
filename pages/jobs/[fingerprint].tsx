// pages/jobs/[fingerprint].tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { getJobByFingerprint, listSimilar, type JobRow } from '../../lib/queries';

type Props = { job: JobRow | null; similar: JobRow[]; error?: string | null };

export default function JobDetail({ job, similar, error }: Props) {
  if (!job) {
    return (
      <main style={{ maxWidth: 760, margin: '48px auto', padding: '0 16px' }}>
        <p>Job not found.</p>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        <p><Link href="/">← Back</Link></p>
      </main>
    );
  }
  return (
    <main style={{ maxWidth: 760, margin: '48px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
      <p><Link href="/">← Back</Link></p>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{job.title}</h1>
      <p style={{ color: '#6b7280', marginTop: 4 }}>
        {job.company ?? '—'} • {job.location ?? '—'} {job.remote ? '• Remote' : ''}
      </p>

      <div style={{ marginTop: 16 }}>
        {job.description ? <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{job.description}</pre> : <em>No description.</em>}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {job.url ? (
          <a href={job.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
            Apply on source →
          </a>
        ) : null}
      </div>

      {similar.length ? (
        <>
          <h2 style={{ marginTop: 32, fontWeight: 700 }}>Similar roles</h2>
          <ul style={{ display: 'grid', gap: 12, marginTop: 8 }}>
            {similar.map((s) => (
              <li key={s.fingerprint} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{s.company ?? '—'} • {s.location ?? '—'}</div>
                <div style={{ fontWeight: 600 }}>{s.title ?? 'Untitled role'}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <a href={s.url ?? '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>Apply</a>
                  <Link href={`/jobs/${s.fingerprint}`} style={{ textDecoration: 'underline' }}>Details</Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {error ? (
        <p style={{ color: '#b91c1c', marginTop: 12 }}>Partial error: {error}</p>
      ) : null}
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const id = String(ctx.params?.fingerprint ?? '');
  try {
    const job = await getJobByFingerprint(id);
    if (!job) return { props: { job: null, similar: [] } };
    const similar = await listSimilar(job, 6);
    return { props: { job, similar } };
  } catch (e: any) {
    console.error('Job detail error:', e);
    return { props: { job: null, similar: [], error: e?.message ?? 'server error' } };
  }
};
