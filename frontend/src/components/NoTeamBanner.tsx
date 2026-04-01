import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Banner component shown when user is not assigned to a team.
 *
 * Displays a prominent warning at the top of the page for users
 * without a team assignment. Different messages for agents vs supervisors.
 */
export function NoTeamBanner() {
  const { user } = useAuthStore();

  // Don't show banner if user has a team
  if (user?.teamId) {
    return null;
  }

  const message =
    user?.role === 'agent'
      ? 'You have not been assigned to a team yet. Please contact your supervisor to be added to a team.'
      : 'You have not been assigned to a team yet. Please contact an administrator to create or assign you to a team.';

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
