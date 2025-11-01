// pages/all-jobs.tsx
import dynamic from 'next/dynamic';
const JobFeedView = dynamic(()=>import('../components/JobFeedView'), { ssr: false });

export default function AllJobsPage() {
  return (
    <JobFeedView
      title="All Jobs — Global"
      defaultUsOnly={false}
      defaultRolesCsv=""       // show everything
      defaultMaxAge={60}
      showOpenAllLink={false}
    />
  );
}
