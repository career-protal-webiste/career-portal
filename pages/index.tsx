import { getJobs } from '../lib/db';

export default function Home({ jobs }: { jobs: any[] }) {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Latest Jobs</h1>
      <ul className="space-y-2">
        {jobs.map((job) => (
          <li key={job.id} className="border rounded-lg p-4 hover:bg-gray-50">
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold">
              {job.title}
            </a>
            <p className="text-sm text-gray-600">
              {job.company} — {job.location || 'Remote'}
            </p>
            <p className="text-xs text-gray-500">
              Posted {new Date(job.posted_at).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}

export async function getServerSideProps() {
  const jobs = await getJobs(100);
  return { props: { jobs } };
}
