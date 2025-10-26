// pages/jobs/[fingerprint].tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { sql } from '@vercel/postgres';

type Job = {
  fingerprint: string;
  company: string;
  title: string;
  location: string | null;
  remote: boolean | null;
  employment_type: string | null;
  experience_hint: string | null;
  category: string | null;
  url: string | null;
  posted_at: string | null;
  scraped_at: string | null;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
};

type Props = { job: Job };

function formatRelative(d: Date) {
  const deltaSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin} min ago`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr} hour${deltaHr === 1 ? '' : 's'} ago`;
  const deltaDay = Math.floor(deltaHr / 24);
  return `${deltaDay} day${deltaDay === 1 ? '' : 's'} ago`;
}

function fmtSalary(min?: number | null, max?: number | null, currency?: string | null) {
  if (min == null && max == null) return null;
  const cur = currency || 'USD';
  const nf = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 });
  if (min != null && max != null) return `${nf.format(min)} – ${nf.format(max)} ${cur}`;
  if (min != null) return `${nf.format(min)} ${cur}+`;
  if (max != null) return `up to ${nf.format(max)} ${cur}`;
  return null;
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const f = String(ctx.params?.fingerprint || '');
  if (!f) return { notFound: true };

  const { rows } = await sql<Job>`
    SELECT fingerprint, company, title, location, remote, employment_type, experience_hint,
           category, url, posted_at, scraped_at, description, salary_min, salary_max, currency
    FROM jobs
    WHERE fingerprint = ${f}
    LIMIT 1
  `;

  if (rows.length === 0) return { notFound: true };
  return { props: { job: rows[0] } };
};

export default function JobDetail({ job }: Props) {
  const posted = job.posted_at ? new Date(job.posted_at) : null;
  const salary = fmtSalary(job.salary_min, job.salary_max, job.currency);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-neutral-600 hover:underline">
          ← Back to jobs
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-neutral-900">{job.title}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          <span className="font-semibold text-neutral-800">{job.company}</span>
          {job.location && (
            <>
              <span>•</span>
              <span>{job.location}</span>
            </>
          )}
          {job.employment_type && (
            <>
              <span>•</span>
              <span>{job.employment_type}</span>
            </>
          )}
          {job.category && (
            <>
              <span>•</span>
              <span>{job.category}</span>
            </>
          )}
          {job.experience_hint && (
            <>
              <span>•</span>
              <span>{job.experience_hint}</span>
            </>
          )}
        </div>

        <div className="mt-2 text-sm text-neutral-500">
          {posted ? (
            <>
              Posted {formatRelative(posted)} • <span title={posted.toLocaleString()}>{posted.toLocaleDateString()}</span>
            </>
          ) : (
            'Posted date unknown'
          )}
        </div>

        {salary && (
          <div className="mt-4 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
            {salary}
          </div>
        )}

        <div className="prose prose-neutral mt-6 max-w-none whitespace-pre-wrap">
          {job.description || 'No description provided.'}
        </div>

        <div className="mt-8">
          <a
            href={job.url || '#'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white hover:opacity-90"
          >
            Apply on company site
          </a>
        </div>
      </div>
    </main>
  );
}
