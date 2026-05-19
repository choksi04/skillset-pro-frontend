import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole } from '@/types/models';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  targetRoute?: string;
  roles: UserRole[];
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const dashboardIntroStep: TourStep = {
  id: 'dashboard-intro',
  title: 'Welcome to your Dashboard',
  description:
    'This is your dashboard — a snapshot of skills, assessments, and progress relevant to your role. Use the sidebar to navigate, and visit the User Guide for a full walkthrough of every feature.',
  roles: ['admin', 'manager', 'employee'],
  position: 'center',
  targetRoute: '/',
};

export function getTourStepsForRole(_role: UserRole): TourStep[] {
  return [dashboardIntroStep];
}


export interface ChecklistItem {
  id: string;
  label: string;
  roles: UserRole[];
  checkFn: string;
}

export const checklistItems: ChecklistItem[] = [
  { id: 'create-domain', label: 'Create your first Domain', roles: ['admin'], checkFn: 'hasDomains' },
  { id: 'add-skills', label: 'Add Skills', roles: ['admin'], checkFn: 'hasCustomSkills' },
  { id: 'map-skills', label: 'Map Skills to Domain', roles: ['admin'], checkFn: 'hasMappings' },
  { id: 'generate-questions', label: 'Generate Questions', roles: ['admin'], checkFn: 'hasQuestions' },
  { id: 'create-template', label: 'Create Assessment Template', roles: ['admin'], checkFn: 'hasAssessments' },
  { id: 'submit-registry', label: 'Submit Skill Registry', roles: ['employee'], checkFn: 'hasSubmission' },
  { id: 'attempt-assessment', label: 'Attempt Assessment', roles: ['employee'], checkFn: 'hasAttempt' },
  { id: 'view-feedback', label: 'View Feedback', roles: ['employee'], checkFn: 'hasFeedback' },
  { id: 'review-assessment', label: 'Review an Assessment', roles: ['manager'], checkFn: 'hasReview' },
  { id: 'approve-registry', label: 'Approve Skill Registry', roles: ['manager'], checkFn: 'hasCompletedReview' },
];

interface OnboardingStore {
  tutorialCompleted: boolean;
  tutorialLastStep: number;
  showWelcome: boolean;
  tourActive: boolean;
  tourStep: number;
  checklistDismissed: boolean;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  skipTour: () => void;
  completeTour: () => void;
  restartTour: () => void;
  continueLater: () => void;
  dismissWelcome: () => void;
  showWelcomeModal: () => void;
  dismissChecklist: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      tutorialCompleted: false,
      tutorialLastStep: 0,
      showWelcome: true,
      tourActive: false,
      tourStep: 0,
      checklistDismissed: false,
      startTour: () => set({ showWelcome: false, tourActive: true, tourStep: 0 }),
      nextStep: () => set((s) => ({ tourStep: s.tourStep + 1, tutorialLastStep: s.tourStep + 1 })),
      prevStep: () => set((s) => ({ tourStep: Math.max(0, s.tourStep - 1) })),
      goToStep: (step) => set({ tourStep: step }),
      skipTour: () => set({ showWelcome: false, tourActive: false, tutorialCompleted: true }),
      completeTour: () => set({ tourActive: false, tutorialCompleted: true }),
      restartTour: () => set({ showWelcome: true, tourActive: false, tourStep: 0, tutorialCompleted: false, checklistDismissed: false }),
      continueLater: () => set((s) => ({ tourActive: false, tutorialLastStep: s.tourStep })),
      dismissWelcome: () => set({ showWelcome: false }),
      showWelcomeModal: () => set({ showWelcome: true }),
      dismissChecklist: () => set({ checklistDismissed: true }),
      resetOnboarding: () => set({ tutorialCompleted: false, tutorialLastStep: 0, showWelcome: true, tourActive: false, tourStep: 0, checklistDismissed: false }),
    }),
    { name: 'siap-onboarding' }
  )
);
