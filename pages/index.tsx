// pages/index.tsx
import dynamic from 'next/dynamic';
const JobFeedView = dynamic(()=>import('../components/JobFeedView'), { ssr: false });

export default function HomePage() {
  return (
    <JobFeedView
      title="US Jobs for Indian Students — OPT / CPT / H1B"
      defaultUsOnly={true}
      defaultRolesCsv="software,data_science,data_engineer,analyst"
      defaultMaxAge={30}
      showOpenAllLink={true}
    />
  );
}
