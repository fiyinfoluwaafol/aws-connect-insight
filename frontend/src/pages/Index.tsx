import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

const Index = () => {
  const { user } = useAuthStore();
  const location = useLocation();

  if (location.hash || location.search) {
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const searchParams = new URLSearchParams(location.search);
    
    if (
      (hashParams.get('type') === 'recovery' && hashParams.get('access_token')) ||
      (searchParams.get('type') === 'recovery' && searchParams.get('access_token')) ||
      hashParams.get('access_token') || 
      searchParams.get('access_token')
    ) {
      const suffix = location.hash || location.search;
      return <Navigate to={`/reset-password${suffix}`} replace />;
    }
  }
  
  if (!user) {
    return <Navigate to="/signin" replace />;
  }
  
  if (user.role === 'supervisor') {
    return <Navigate to="/supervisor" replace />;
  }
  
  return <Navigate to="/agent" replace />;
};

export default Index;
