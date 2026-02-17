import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

const Index = () => {
  const { user } = useAuthStore();
  
  // If no user logged in, redirect to sign in
  if (!user) {
    return <Navigate to="/signin" replace />;
  }
  
  // Redirect based on role
  if (user.role === 'supervisor') {
    return <Navigate to="/supervisor" replace />;
  }
  
  return <Navigate to="/agent" replace />;
};

export default Index;
