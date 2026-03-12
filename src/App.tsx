import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/organization" element={<OrganizationPage />} />
              <Route path="/skills" element={<SkillFrameworkPage />} />
              <Route path="/domains" element={<DomainsPage />} />
              <Route path="/domains/:id" element={<DomainDetailPage />} />
              <Route path="/domain-skills" element={<DomainSkillMappingPage />} />
              <Route path="/questions" element={<QuestionBankPage />} />
              <Route path="/ai-generate" element={<AIGenerationPage />} />
              <Route path="/assessments" element={<AssessmentsPage />} />
              <Route path="/assessment-exec" element={<AssessmentExecPage />} />
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/registry" element={<SkillRegistryPage />} />
              <Route path="/hr-dashboard" element={<HRDashboardPage />} />
              <Route path="/guide" element={<UserGuidePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
