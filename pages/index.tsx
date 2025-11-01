// pages/index.tsx
import dynamic from 'next/dynamic';
const JobFeedView = dynamic(()=>import('../components/JobFeedView'), { ssr: false });

export default function HomePage() {
  return (
    <JobFeedView
      title="Career Portal — Fresh Jobs (US STEM)"
      defaultUsOnly={true}
      defaultRolesCsv="popular"   // your API maps this to STEM-heavy roles
      defaultMaxAge={30}
      showOpenAllLink={true}
    />
  );
}
