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
import SkillFrameworkPage from "@/pages/SkillFrameworkPage";
import CategoryDetailPage from "@/pages/CategoryDetailPage";
import DomainsPage from "@/pages/DomainsPage";
import DomainDetailPage from "@/pages/DomainDetailPage";
import QuestionBankPage from "@/pages/QuestionBankPage";
import AssessmentsPage from "@/pages/AssessmentsPage";
import AssessmentExecPage from "@/pages/AssessmentExecPage";
import ReviewsPage from "@/pages/ReviewsPage";
import ReviewCyclesPage from "@/pages/ReviewCyclesPage";
import SkillRegistryPage from "@/pages/SkillRegistryPage";
import HRDashboardPage from "@/pages/HRDashboardPage";
import UserGuidePage from "@/pages/UserGuidePage";
import UsersPage from "@/pages/UsersPage";
import QuestionSettingsPage from "@/pages/QuestionSettingsPage";
import AllRegistriesPage from "@/pages/AllRegistriesPage";
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
              <Route path="/skill-registry" element={<SkillRegistryPage />} />
              <Route path="/assessments" element={<AssessmentsPage />} />
              <Route path="/assessment-exec" element={<AssessmentExecPage />} />
              <Route path="/help" element={<UserGuidePage />} />

              {/* Admin only */}
              <Route path="/users" element={<RoleGuard allowed={["admin"]}><UsersPage /></RoleGuard>} />
              <Route path="/question-settings" element={<RoleGuard allowed={["admin"]}><QuestionSettingsPage /></RoleGuard>} />
              <Route path="/all-registries" element={<RoleGuard allowed={["admin"]}><AllRegistriesPage /></RoleGuard>} />

              {/* Admin + Manager */}
              <Route path="/skill-library" element={<RoleGuard allowed={["admin", "manager"]}><SkillFrameworkPage /></RoleGuard>} />
              <Route path="/skill-library/:categoryId" element={<RoleGuard allowed={["admin", "manager"]}><CategoryDetailPage /></RoleGuard>} />
              <Route path="/domains" element={<RoleGuard allowed={["admin", "manager"]}><DomainsPage /></RoleGuard>} />
              <Route path="/domains/:id" element={<RoleGuard allowed={["admin", "manager"]}><DomainDetailPage /></RoleGuard>} />
              <Route path="/questions" element={<RoleGuard allowed={["admin", "manager"]}><QuestionBankPage /></RoleGuard>} />
              <Route path="/review-cycles" element={<RoleGuard allowed={["admin", "manager"]}><ReviewCyclesPage /></RoleGuard>} />
              <Route path="/manager-reviews" element={<RoleGuard allowed={["admin", "manager"]}><ReviewsPage /></RoleGuard>} />

              {/* Legacy redirects */}
              <Route path="/ai-generate" element={<Navigate to="/questions" replace />} />
              <Route path="/skills" element={<Navigate to="/skill-library" replace />} />
              <Route path="/registry" element={<Navigate to="/skill-registry" replace />} />
              <Route path="/reviews" element={<Navigate to="/review-cycles" replace />} />
              <Route path="/guide" element={<Navigate to="/help" replace />} />
              <Route path="/skill-analytics" element={<Navigate to="/all-registries" replace />} />
              <Route path="/organization" element={<Navigate to="/" replace />} />
              <Route path="/domain-skills" element={<Navigate to="/domains" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
