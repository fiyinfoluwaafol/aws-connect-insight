import { useAuthStore } from '@/stores/auth-store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Settings, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const showDemoBadge = import.meta.env.VITE_SHOW_DEMO_BADGE !== 'false';

export function AppHeader({ title, subtitle, actions }: AppHeaderProps) {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  const userDisplayName = user
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`.trim()
    : '';

  return (
    <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-end">
            {actions}
            <ThemeToggle className="h-9 w-9 shrink-0" />
            {showDemoBadge && (
              <Badge variant="secondary" className="px-2 sm:px-3 py-1.5 inline-flex shrink-0">
                <Activity className="h-3 w-3 mr-1.5 inline-block shrink-0" aria-hidden />
                <span className="hidden sm:inline">Demo Mode</span>
                <span className="sm:hidden">Demo</span>
              </Badge>
            )}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('gap-2 max-w-[min(100%,14rem)]', 'sm:max-w-none')}
                    aria-label={`Account menu for ${userDisplayName || user.email}`}
                  >
                    <User className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate hidden sm:inline">
                      {userDisplayName || user.email}
                    </span>
                    <Badge variant="secondary" className="ml-0 sm:ml-1 text-xs hidden md:inline-flex">
                      {user.role}
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem disabled className="flex flex-col items-start gap-0.5">
                    <span className="text-xs font-medium text-foreground truncate max-w-full">
                      {userDisplayName || 'User'}
                    </span>
                    <span className="text-xs text-muted-foreground break-all">{user.email}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {user.role === 'supervisor' && (
                    <DropdownMenuItem onClick={() => navigate('/supervisor/settings')}>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
