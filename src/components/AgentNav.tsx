import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, TrendingUp, Star, Bell } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';

const navItems = [
  { path: '/agent', label: 'Home', icon: Home, exact: true },
  { path: '/agent/performance', label: 'Performance', icon: TrendingUp },
  { path: '/agent/exemplars', label: 'Exemplars', icon: Star },
  { path: '/agent/notifications', label: 'Notifications', icon: Bell },
];

export function AgentNav() {
  const location = useLocation();
  const { notifications } = useAppStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <nav className="border-b bg-card/30">
      <div className="container mx-auto px-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap relative',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.path === '/agent/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
