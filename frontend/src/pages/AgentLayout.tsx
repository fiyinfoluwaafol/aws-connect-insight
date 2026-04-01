import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { AgentNav } from '@/components/AgentNav';
import { NoTeamBanner } from '@/components/NoTeamBanner';

export default function AgentLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Agent Helper" subtitle="Your coaching companion" />
      <NoTeamBanner />
      <AgentNav />
      <Outlet />
    </div>
  );
}
