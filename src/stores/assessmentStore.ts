import { create } from 'zustand';
import { Question, CompetencyLevel } from './questionStore';
import { SkillSelfRating, RatingLevel } from './registryStore';

export type AssessmentStatus = 'pending' | 'in_progress' | 'completed' | 'reviewed';

// Map self-rating levels (1-5) to question competency levels
const ratingToCompetency: Record<RatingLevel, CompetencyLevel> = {
  1: 'beginner',
  2: 'beginner',
  3: 'intermediate',
  4: 'advanced',
  5: 'expert',
};

// For a given rating, return the competency levels to pull questions from
// self_level, self_level - 1, self_level - 2 (optional)
function getTargetCompetencyLevels(rating: RatingLevel): CompetencyLevel[] {
  const allLevels: CompetencyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
  const primary = ratingToCompetency[rating];
  const primaryIdx = allLevels.indexOf(primary);

  const targets = new Set<CompetencyLevel>();
  targets.add(primary); // self_level
  if (primaryIdx - 1 >= 0) targets.add(allLevels[primaryIdx - 1]); // self_level - 1
  if (primaryIdx - 2 >= 0) targets.add(allLevels[primaryIdx - 2]); // self_level - 2

  return Array.from(targets);
}

// Shuffle array (Fisher-Yates)
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface AssessmentQuestion {
  question_id: string;
  skill_id: string;
  target_level: CompetencyLevel;
}

export interface Assessment {
  id: string;
  tenant_id: string;
  employee_id: string;
  submission_id: string;
  domain_id: string;
  skill_ids: string[];
  assessment_questions: AssessmentQuestion[];
  status: AssessmentStatus;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface GenerateAssessmentParams {
  tenant_id: string;
  employee_id: string;
  submission_id: string;
  domain_id: string;
  ratings: SkillSelfRating[];
  publishedQuestions: Question[];
  maxQuestionsPerSkill?: number;
}

export function generateAssessmentQuestions(
  ratings: SkillSelfRating[],
  publishedQuestions: Question[],
  maxPerSkill: number = 3,
): AssessmentQuestion[] {
  const selected: AssessmentQuestion[] = [];

  for (const { skill_id, rating } of ratings) {
    const targetLevels = getTargetCompetencyLevels(rating);

    // Get published questions for this skill at target levels
    const candidates = publishedQuestions.filter(
      (q) => q.skill_id === skill_id && targetLevels.includes(q.competency_level)
    );

    // Shuffle and pick up to maxPerSkill
    const picked = shuffle(candidates).slice(0, maxPerSkill);

    for (const q of picked) {
      selected.push({
        question_id: q.id,
        skill_id: q.skill_id,
        target_level: q.competency_level,
      });
    }
  }

  return selected;
}

interface AssessmentStore {
  assessments: Assessment[];
  addAssessment: (params: GenerateAssessmentParams) => string;
  getAssessmentsForEmployee: (employeeId: string) => Assessment[];
  updateAssessmentStatus: (id: string, status: AssessmentStatus) => void;
}

export const useAssessmentStore = create<AssessmentStore>((set, get) => ({
  assessments: [],

  addAssessment: (params) => {
    const { tenant_id, employee_id, submission_id, domain_id, ratings, publishedQuestions, maxQuestionsPerSkill } = params;

    const assessmentQuestions = generateAssessmentQuestions(ratings, publishedQuestions, maxQuestionsPerSkill);
    const skillIds = [...new Set(ratings.map((r) => r.skill_id))];
    const id = `assess-${Date.now()}`;

    set((state) => ({
      assessments: [
        ...state.assessments,
        {
          id,
          tenant_id,
          employee_id,
          submission_id,
          domain_id,
          skill_ids: skillIds,
          assessment_questions: assessmentQuestions,
          status: 'pending' as AssessmentStatus,
          duration_minutes: Math.max(30, assessmentQuestions.length * 10),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    }));

    return id;
  },

  getAssessmentsForEmployee: (employeeId) =>
    get().assessments.filter((a) => a.employee_id === employeeId),

  updateAssessmentStatus: (id, status) =>
    set((state) => ({
      assessments: state.assessments.map((a) =>
        a.id === id ? { ...a, status, updated_at: new Date().toISOString() } : a
      ),
    })),
}));
