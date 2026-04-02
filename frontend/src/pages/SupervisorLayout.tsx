import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { SupervisorNav } from '@/components/SupervisorNav';
import { NoTeamBanner } from '@/components/NoTeamBanner';

export default function SupervisorLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Supervisor Dashboard" subtitle="Amazon Connect Insights" />
      <NoTeamBanner />
      <SupervisorNav />
      <Outlet />
    </div>
  );
}
