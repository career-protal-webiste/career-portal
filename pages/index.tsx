// pages/index.tsx
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { listJobs, type JobRow } from '../lib/db';

// ---- helpers ----
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

function isHot(d?: Date | null) {
  if (!d) return false;
  return Date.now() - d.getTime() <= 60 * 60 * 1000; // last 1h
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

type Props = { jobs: JobRow[]; error?: string | null };

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  try {
    const jobs = await listJobs();
    return { props: { jobs } };
  } catch (e: any) {
    return { props: { jobs: [], error: e?.message ?? 'Failed to load' } };
  }
};

export default function Home({ jobs, error }: Props) {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Careers Portal</h1>
          <p className="mt-3 text-neutral-600">
            Fresh postings automatically pulled from Lever &amp; Greenhouse.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm text-neutral-600">{jobs.length} open roles</div>
          <div className="w-[420px] max-w-full">
            <input
              type="search"
              placeholder="Search title, company, or location…"
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm outline-none ring-0 focus:border-neutral-300"
              onChange={(e) => {
                const q = e.currentTarget.value.trim().toLowerCase();
                const cards = document.querySelectorAll<HTMLDivElement>('[data-role-card]');
                cards.forEach((el) => {
                  const hay = (el.dataset.haystack || '').toLowerCase();
                  el.style.display = hay.includes(q) ? '' : 'none';
                });
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {jobs.map((j) => {
            const posted = j.posted_at ? new Date(j.posted_at) : null;
            const salary = fmtSalary(j.salary_min as any, j.salary_max as any, j.currency as any);
            const haystack = [
              j.company,
              j.title,
              j.location || '',
              j.category || '',
              j.experience_hint || '',
            ].join(' • ');

            return (
              <div
                key={j.fingerprint}
                data-role-card
                data-haystack={haystack}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
                  <span className="font-semibold text-neutral-700">{j.company}</span>
                  {j.location && (
                    <>
                      <span>•</span>
                      <span>{j.location}</span>
                    </>
                  )}
                </div>

                <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                  <Link href={`/jobs/${encodeURIComponent(String(j.fingerprint))}`} className="hover:underline">
                    {j.title}
                  </Link>
                </h3>

                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  {isHot(posted) && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                      High CTR
                    </span>
                  )}
                  {j.category && (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
                      {j.category}
                    </span>
                  )}
                  {j.experience_hint && (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
                      {j.experience_hint}
                    </span>
                  )}
                  {salary && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      {salary}
                    </span>
                  )}
                </div>

                <div className="mb-4 text-xs text-neutral-500">
                  {posted ? (
                    <>
                      <span title={posted.toLocaleString()}>
                        Posted {formatRelative(posted)} ({posted.toLocaleDateString()})
                      </span>
                    </>
                  ) : (
                    <span>Posted date unknown</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={j.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center rounded-full bg-black px-4 text-sm font-medium text-white hover:opacity-90"
                  >
                    Apply
                  </a>

                  <Link
                    href={`/jobs/${encodeURIComponent(String(j.fingerprint))}`}
                    className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline"
                  >
                    Details
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
