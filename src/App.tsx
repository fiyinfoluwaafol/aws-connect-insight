import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { seedInitialData } from "@/lib/seed";

// Pages
import Index from "./pages/Index";
import SignIn from "./pages/SignIn";
import NotFound from "./pages/NotFound";

// Supervisor pages
import SupervisorLayout from "./pages/SupervisorLayout";
import SupervisorOverview from "./pages/supervisor/Overview";
import SupervisorAlerts from "./pages/supervisor/Alerts";
import SupervisorSearch from "./pages/supervisor/Search";
import SupervisorBriefs from "./pages/supervisor/Briefs";
import SupervisorSettings from "./pages/supervisor/Settings";

// Agent pages
import AgentLayout from "./pages/AgentLayout";
import AgentHome from "./pages/agent/Home";
import AgentPerformance from "./pages/agent/Performance";
import AgentExemplars from "./pages/agent/Exemplars";
import AgentNotifications from "./pages/agent/Notifications";

const queryClient = new QueryClient();

const App = () => {
  // Seed initial data on app load
  useEffect(() => {
    seedInitialData();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/signin" element={<SignIn />} />

            {/* Supervisor routes */}
            <Route
              path="/supervisor"
              element={
                <ProtectedRoute allowedRole="supervisor">
                  <SupervisorLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SupervisorOverview />} />
              <Route path="overview" element={<SupervisorOverview />} />
              <Route path="alerts" element={<SupervisorAlerts />} />
              <Route path="search" element={<SupervisorSearch />} />
              <Route path="briefs" element={<SupervisorBriefs />} />
              <Route path="settings" element={<SupervisorSettings />} />
            </Route>

            {/* Agent routes */}
            <Route
              path="/agent"
              element={
                <ProtectedRoute allowedRole="agent">
                  <AgentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AgentHome />} />
              <Route path="home" element={<AgentHome />} />
              <Route path="performance" element={<AgentPerformance />} />
              <Route path="exemplars" element={<AgentExemplars />} />
              <Route path="notifications" element={<AgentNotifications />} />
            </Route>

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
