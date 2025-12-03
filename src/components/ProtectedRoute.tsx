import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, UserRole } from '@/stores/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: UserRole;
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user } = useAuthStore();
  const location = useLocation();

  // Not logged in - redirect to sign in
  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // User logged in but accessing wrong role's route
  if (allowedRole && user.role !== allowedRole) {
    const redirectPath = user.role === 'supervisor' ? '/supervisor' : '/agent';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

