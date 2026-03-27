import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, UserRole } from '@/stores/auth-store';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: UserRole;
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    const redirectPath = user.role === 'supervisor' ? '/supervisor' : '/agent';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

