import { create } from 'zustand';

export type RatingLevel = 1 | 2 | 3 | 4 | 5;

export const ratingLabels: Record<RatingLevel, string> = {
  1: 'Basic Awareness',
  2: 'Working Knowledge',
  3: 'Independent Contributor',
  4: 'Advanced',
  5: 'Expert',
};

export const ratingDescriptions: Record<RatingLevel, string> = {
  1: 'Aware of concepts but needs guidance for most tasks',
  2: 'Can perform basic tasks with some supervision',
  3: 'Works independently on standard tasks and problems',
  4: 'Handles complex scenarios and mentors others',
  5: 'Deep expertise, drives best practices and innovation',
};

export interface SkillSelfRating {
  skill_id: string;
  rating: RatingLevel;
}

export interface SkillRegistrySubmission {
  id: string;
  tenant_id: string;
  employee_id: string;
  domain_id: string;
  cycle: string; // e.g. "2026-Q1"
  ratings: SkillSelfRating[];
  status: 'draft' | 'submitted' | 'assessment_generated';
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

// Employee-domain assignment
export interface EmployeeDomainAssignment {
  employee_id: string;
  domain_id: string;
  tenant_id: string;
}

const defaultAssignments: EmployeeDomainAssignment[] = [
  { employee_id: 'user-001', domain_id: 'dom-1', tenant_id: 'tenant-001' },
];

interface RegistryStore {
  submissions: SkillRegistrySubmission[];
  assignments: EmployeeDomainAssignment[];
  currentCycle: string;
  getSubmission: (employeeId: string, cycle: string) => SkillRegistrySubmission | undefined;
  createOrUpdateDraft: (employeeId: string, tenantId: string, domainId: string, ratings: SkillSelfRating[]) => void;
  submitRegistry: (submissionId: string) => void;
  markAssessmentGenerated: (submissionId: string) => void;
  assignEmployeeToDomain: (employeeId: string, domainId: string, tenantId: string) => void;
}

export const useRegistryStore = create<RegistryStore>((set, get) => ({
  submissions: [],
  assignments: defaultAssignments,
  currentCycle: '2026-Q1',

  getSubmission: (employeeId, cycle) =>
    get().submissions.find((s) => s.employee_id === employeeId && s.cycle === cycle),

  createOrUpdateDraft: (employeeId, tenantId, domainId, ratings) =>
    set((state) => {
      const existing = state.submissions.find(
        (s) => s.employee_id === employeeId && s.cycle === state.currentCycle
      );
      if (existing && existing.status !== 'draft') return state; // locked
      if (existing) {
        return {
          submissions: state.submissions.map((s) =>
            s.id === existing.id
              ? { ...s, ratings, domain_id: domainId, updated_at: new Date().toISOString() }
              : s
          ),
        };
      }
      return {
        submissions: [
          ...state.submissions,
          {
            id: `sub-${Date.now()}`,
            tenant_id: tenantId,
            employee_id: employeeId,
            domain_id: domainId,
            cycle: state.currentCycle,
            ratings,
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }),

  submitRegistry: (submissionId) =>
    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === submissionId && s.status === 'draft'
          ? { ...s, status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : s
      ),
    })),

  markAssessmentGenerated: (submissionId) =>
    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === submissionId
          ? { ...s, status: 'assessment_generated', updated_at: new Date().toISOString() }
          : s
      ),
    })),

  assignEmployeeToDomain: (employeeId, domainId, tenantId) =>
    set((state) => {
      const exists = state.assignments.find(
        (a) => a.employee_id === employeeId && a.domain_id === domainId
      );
      if (exists) return state;
      return { assignments: [...state.assignments, { employee_id: employeeId, domain_id: domainId, tenant_id: tenantId }] };
    }),
}));
