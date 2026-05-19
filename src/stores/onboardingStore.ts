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

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to SIAP',
    description:
      "Let's take a quick tour of the sidebar so you know where everything lives. You can press Esc or click the X at any time to exit.",
    roles: ['admin', 'manager', 'employee'],
    position: 'center',
  },
  {
    id: 'nav-dashboard',
    title: 'Dashboard',
    description: 'Your home view with role-specific KPIs, quick actions, and recent activity.',
    targetSelector: '[data-tour="nav-dashboard"]',
    position: 'right',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    id: 'nav-all-registries',
    title: 'All Registries',
    description: "Organization-wide directory of every employee's approved skill registry.",
    targetSelector: '[data-tour="nav-all-registries"]',
    position: 'right',
    roles: ['admin'],
  },
  {
    id: 'nav-my-registry',
    title: 'My Registry',
    description: 'Your personal skill self-assessment and the levels approved by your manager.',
    targetSelector: '[data-tour="nav-my-registry"]',
    position: 'right',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    id: 'nav-team-registry',
    title: 'Team Registry',
    description: 'Registries of employees in the domains you lead — review and approve them here.',
    targetSelector: '[data-tour="nav-team-registry"]',
    position: 'right',
    roles: ['admin', 'manager'],
  },
  {
    id: 'nav-my-assessments',
    title: 'My Assessments',
    description: 'Assessments assigned to you — in progress, pending, or completed.',
    targetSelector: '[data-tour="nav-my-assessments"]',
    position: 'right',
    roles: ['admin', 'manager', 'employee'],
  },
  {
    id: 'nav-team-assessments',
    title: 'Team Assessments',
    description: "Assessments completed by employees in your domains, ready for your review.",
    targetSelector: '[data-tour="nav-team-assessments"]',
    position: 'right',
    roles: ['admin', 'manager'],
  },
  {
    id: 'nav-skill-library',
    title: 'Skill Library',
    description: 'Catalog of skill categories, skills, and topics that power the platform.',
    targetSelector: '[data-tour="nav-skill-library"]',
    position: 'right',
    roles: ['admin', 'manager'],
  },
  {
    id: 'nav-domains',
    title: 'Domains',
    description: 'Practice areas that group people and skills, and define oversight boundaries.',
    targetSelector: '[data-tour="nav-domains"]',
    position: 'right',
    roles: ['admin', 'manager'],
  },
  {
    id: 'nav-questions',
    title: 'Question Bank',
    description: 'MCQ, coding, and scenario questions used to generate assessments.',
    targetSelector: '[data-tour="nav-questions"]',
    position: 'right',
    roles: ['admin', 'manager'],
  },
  {
    id: 'nav-assessment-config',
    title: 'Assessment Config',
    description: 'Global assessment rules: question counts, passing thresholds, and scoring.',
    targetSelector: '[data-tour="nav-assessment-config"]',
    position: 'right',
    roles: ['admin'],
  },
  {
    id: 'nav-assessment-templates',
    title: 'Assessment Templates',
    description: 'Reusable assessment definitions you can assign to employees.',
    targetSelector: '[data-tour="nav-assessment-templates"]',
    position: 'right',
    roles: ['admin', 'manager'],
  },
  {
    id: 'nav-users',
    title: 'Users',
    description: 'Manage user accounts, roles, and domain assignments.',
    targetSelector: '[data-tour="nav-users"]',
    position: 'right',
    roles: ['admin'],
  },
  {
    id: 'nav-help',
    title: 'Help & Tutorial',
    description: 'The full user guide, with the option to replay this tour anytime.',
    targetSelector: '[data-tour="nav-help"]',
    position: 'right',
    roles: ['admin', 'manager', 'employee'],
  },
];

export function getTourStepsForRole(role: UserRole): TourStep[] {
  return tourSteps.filter((s) => s.roles.includes(role));
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
