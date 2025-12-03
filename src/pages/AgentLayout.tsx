import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { AgentNav } from '@/components/AgentNav';

export default function AgentLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Agent Helper" subtitle="Your coaching companion" />
      <AgentNav />
      <Outlet />
    </div>
  );
}
