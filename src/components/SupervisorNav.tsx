import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  AlertTriangle,
  Search,
  FileText,
  Settings,
} from 'lucide-react';

const navItems = [
  { path: '/supervisor', label: 'Overview', icon: LayoutDashboard, exact: true },
  { path: '/supervisor/alerts', label: 'Alerts', icon: AlertTriangle },
  { path: '/supervisor/search', label: 'Search', icon: Search },
  { path: '/supervisor/briefs', label: 'Daily Briefs', icon: FileText },
  { path: '/supervisor/settings', label: 'Settings', icon: Settings },
];

export function SupervisorNav() {
  const location = useLocation();

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
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
