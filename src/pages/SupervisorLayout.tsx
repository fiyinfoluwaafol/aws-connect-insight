import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { SupervisorNav } from '@/components/SupervisorNav';

export default function SupervisorLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Supervisor Dashboard" subtitle="Amazon Connect Insights" />
      <SupervisorNav />
      <Outlet />
    </div>
  );
}
