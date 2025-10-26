// pages/job/[fingerprint].tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { getJobByFingerprint, type JobRow } from '../../lib/queries';

type Props = { job: JobRow };

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const fp = String(ctx.params?.fingerprint ?? '');
  const job = await getJobByFingerprint(fp);
  if (!job) return { notFound: true };
  return { props: { job } };
};

function money(min?: number | null, max?: number | null, currency?: string | null) {
  if (!currency || (min == null && max == null)) return null;
  const fmt = (v: number) => v.toLocaleString(undefined, { style: 'currency', currency });
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return fmt(max!);
}

export default function JobDetail({ job }: Props) {
  const posted = job.posted_at ?? job.scraped_at;
  const pay = money(job.salary_min, job.salary_max, job.currency);

  return (
    <div className="detail">
      <div className="kicker">
        <Link href="/" className="btn ghost">← Back</Link>
      </div>

      <h1>{job.title}</h1>
      <div className="row" style={{marginTop: 6}}>
        <span><strong>{job.company}</strong></span>
        {job.location ? <span>• {job.location}</span> : null}
        {job.category ? <span>• {job.category}</span> : null}
        {job.employment_type ? <span>• {job.employment_type}</span> : null}
      </div>

      <div className="row" style={{marginTop: 6}}>
        {posted ? <span>Posted: {new Date(posted).toUTCString()}</span> : null}
        {pay ? <span>• Salary: {pay}</span> : null}
        {Array.isArray(job.visa_tags) && job.visa_tags.length
          ? <span>• Visa: {job.visa_tags.join(', ')}</span>
          : null}
        <span>• Source: {job.source ?? '—'}</span>
      </div>

      <div className="actions" style={{marginTop: 16}}>
        <a className="btn primary" href={job.url} target="_blank" rel="noreferrer">Apply</a>
        <Link className="btn" href="/">All jobs</Link>
      </div>

      {job.description && <div className="desc">{job.description}</div>}
    </div>
  );
}
