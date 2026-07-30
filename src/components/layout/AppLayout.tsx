import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import PageHeader from './PageHeader';
import WelcomeModal from '@/components/onboarding/WelcomeModal';
import GuidedTour from '@/components/onboarding/GuidedTour';

export default function AppLayout() {
  useEffect(() => {
    document.documentElement.classList.add('overflow-hidden');
    document.body.classList.add('overflow-hidden');
    return () => {
      document.documentElement.classList.remove('overflow-hidden');
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader />
        <main className="flex-1 min-h-0 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <WelcomeModal />
      <GuidedTour />
    </div>
  );
}

