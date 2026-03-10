import { create } from 'zustand';

export type AssessmentStatus = 'pending' | 'in_progress' | 'completed' | 'reviewed';

export interface Assessment {
  id: string;
  tenant_id: string;
  employee_id: string;
  submission_id: string;
  domain_id: string;
  skill_ids: string[];
  question_ids: string[];
  status: AssessmentStatus;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}

interface AssessmentStore {
  assessments: Assessment[];
  addAssessment: (a: Omit<Assessment, 'id' | 'created_at' | 'updated_at'>) => string;
  getAssessmentsForEmployee: (employeeId: string) => Assessment[];
}

export const useAssessmentStore = create<AssessmentStore>((set, get) => ({
  assessments: [],
  addAssessment: (a) => {
    const id = `assess-${Date.now()}`;
    set((state) => ({
      assessments: [
        ...state.assessments,
        { ...a, id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
    }));
    return id;
  },
  getAssessmentsForEmployee: (employeeId) =>
    get().assessments.filter((a) => a.employee_id === employeeId),
}));
