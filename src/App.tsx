import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types/models";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import OrganizationPage from "@/pages/OrganizationPage";
import SkillFrameworkPage from "@/pages/SkillFrameworkPage";
import DomainsPage from "@/pages/DomainsPage";
import DomainDetailPage from "@/pages/DomainDetailPage";
import DomainSkillMappingPage from "@/pages/DomainSkillMappingPage";
import QuestionBankPage from "@/pages/QuestionBankPage";
import AIGenerationPage from "@/pages/AIGenerationPage";
import AssessmentsPage from "@/pages/AssessmentsPage";
import AssessmentExecPage from "@/pages/AssessmentExecPage";
import ReviewsPage from "@/pages/ReviewsPage";
import SkillRegistryPage from "@/pages/SkillRegistryPage";
import HRDashboardPage from "@/pages/HRDashboardPage";
import UserGuidePage from "@/pages/UserGuidePage";
import UsersPage from "@/pages/UsersPage";
import NotFound from "@/pages/NotFound";
import { toast } from "sonner";
import { useEffect } from "react";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading)
    return <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleGuard({ children, allowed }: { children: React.ReactNode; allowed: UserRole[] }) {
  const { currentRole } = useAuth();

  useEffect(() => {
    if (!allowed.includes(currentRole)) {
      toast.error("You don't have permission to access that page.");
    }
  }, [currentRole, allowed]);

  if (!allowed.includes(currentRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <AuthGuard>
                  <AppLayout />
                </AuthGuard>
              }
            >
              {/* All roles */}
              <Route path="/" element={<DashboardPage />} />
              <Route path="/registry" element={<SkillRegistryPage />} />
              <Route path="/assessments" element={<AssessmentsPage />} />
              <Route path="/assessment-exec" element={<AssessmentExecPage />} />
              <Route path="/guide" element={<UserGuidePage />} />

              {/* Admin only */}
              <Route path="/organization" element={<RoleGuard allowed={["admin"]}><OrganizationPage /></RoleGuard>} />
              <Route path="/users" element={<RoleGuard allowed={["admin"]}><UsersPage /></RoleGuard>} />
              <Route path="/skill-analytics" element={<RoleGuard allowed={["admin"]}><HRDashboardPage /></RoleGuard>} />
              <Route path="/ai-generate" element={<RoleGuard allowed={["admin", "manager"]}><AIGenerationPage /></RoleGuard>} />

              {/* Admin + Manager */}
              <Route path="/skills" element={<RoleGuard allowed={["admin", "manager"]}><SkillFrameworkPage /></RoleGuard>} />
              <Route path="/domains" element={<RoleGuard allowed={["admin", "manager"]}><DomainsPage /></RoleGuard>} />
              <Route path="/domains/:id" element={<RoleGuard allowed={["admin", "manager"]}><DomainDetailPage /></RoleGuard>} />
              <Route path="/domain-skills" element={<RoleGuard allowed={["admin", "manager"]}><DomainSkillMappingPage /></RoleGuard>} />
              <Route path="/questions" element={<RoleGuard allowed={["admin", "manager"]}><QuestionBankPage /></RoleGuard>} />
              <Route path="/reviews" element={<RoleGuard allowed={["admin", "manager"]}><ReviewsPage /></RoleGuard>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
