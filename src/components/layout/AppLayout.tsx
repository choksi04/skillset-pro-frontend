import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import PageHeader from './PageHeader';
import WelcomeModal from '@/components/onboarding/WelcomeModal';
import GuidedTour from '@/components/onboarding/GuidedTour';

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <WelcomeModal />
      <GuidedTour />
    </div>
  );
}
