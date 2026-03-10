import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
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

function getTargetCompetencyLevels(rating: RatingLevel): CompetencyLevel[] {
  const allLevels: CompetencyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
  const primary = ratingToCompetency[rating];
  const primaryIdx = allLevels.indexOf(primary);
  const targets = new Set<CompetencyLevel>();
  targets.add(primary);
  if (primaryIdx - 1 >= 0) targets.add(allLevels[primaryIdx - 1]);
  if (primaryIdx - 2 >= 0) targets.add(allLevels[primaryIdx - 2]);
  return Array.from(targets);
}

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
    const candidates = publishedQuestions.filter(
      (q) => q.skill_id === skill_id && targetLevels.includes(q.competency_level)
    );
    const picked = shuffle(candidates).slice(0, maxPerSkill);
    for (const q of picked) {
      selected.push({ question_id: q.id, skill_id: q.skill_id, target_level: q.competency_level });
    }
  }
  return selected;
}

interface AssessmentStore {
  assessments: Assessment[];
  loading: boolean;
  initialized: boolean;
  fetchAssessments: () => Promise<void>;
  addAssessment: (params: GenerateAssessmentParams) => Promise<string>;
  getAssessmentsForEmployee: (employeeId: string) => Assessment[];
  updateAssessmentStatus: (id: string, status: AssessmentStatus) => Promise<void>;
}

export const useAssessmentStore = create<AssessmentStore>((set, get) => ({
  assessments: [],
  loading: false,
  initialized: false,

  fetchAssessments: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const { data: assessmentRows, error } = await supabase
        .from('assessments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch all assessment questions
      const assessmentIds = (assessmentRows || []).map((a: any) => a.id);
      let questionRows: any[] = [];
      if (assessmentIds.length > 0) {
        const { data, error: qError } = await supabase
          .from('assessment_questions')
          .select('*')
          .in('assessment_id', assessmentIds);
        if (qError) throw qError;
        questionRows = data || [];
      }

      // Build assessment objects
      const assessments: Assessment[] = (assessmentRows || []).map((a: any) => {
        const aqs = questionRows
          .filter((q: any) => q.assessment_id === a.id)
          .map((q: any) => ({
            question_id: q.question_id,
            skill_id: q.skill_id,
            target_level: q.target_level as CompetencyLevel,
          }));
        const skillIds = [...new Set(aqs.map((q) => q.skill_id))];
        return {
          id: a.id,
          tenant_id: a.tenant_id,
          employee_id: a.employee_id,
          submission_id: a.submission_id,
          domain_id: a.domain_id,
          skill_ids: skillIds,
          assessment_questions: aqs,
          status: a.status as AssessmentStatus,
          duration_minutes: a.duration_minutes,
          created_at: a.created_at,
          updated_at: a.updated_at,
        };
      });

      set({ assessments, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch assessments:', err);
      set({ loading: false, initialized: true });
    }
  },

  addAssessment: async (params) => {
    const { tenant_id, employee_id, submission_id, domain_id, ratings, publishedQuestions, maxQuestionsPerSkill } = params;
    const assessmentQuestions = generateAssessmentQuestions(ratings, publishedQuestions, maxQuestionsPerSkill);
    const skillIds = [...new Set(ratings.map((r) => r.skill_id))];
    const durationMinutes = Math.max(30, assessmentQuestions.length * 10);

    // Insert assessment
    const { data: row, error } = await supabase
      .from('assessments')
      .insert({
        tenant_id,
        employee_id,
        submission_id,
        domain_id,
        status: 'pending',
        duration_minutes: durationMinutes,
      })
      .select()
      .single();

    if (error || !row) {
      console.error('Failed to create assessment:', error);
      return '';
    }

    const assessmentId = (row as any).id;

    // Insert assessment questions
    if (assessmentQuestions.length > 0) {
      const { error: qError } = await supabase
        .from('assessment_questions')
        .insert(
          assessmentQuestions.map((aq) => ({
            assessment_id: assessmentId,
            question_id: aq.question_id,
            skill_id: aq.skill_id,
            target_level: aq.target_level,
          }))
        );
      if (qError) console.error('Failed to insert assessment questions:', qError);
    }

    // Update local state
    const newAssessment: Assessment = {
      id: assessmentId,
      tenant_id,
      employee_id,
      submission_id,
      domain_id,
      skill_ids: skillIds,
      assessment_questions: assessmentQuestions,
      status: 'pending',
      duration_minutes: durationMinutes,
      created_at: (row as any).created_at,
      updated_at: (row as any).updated_at,
    };

    set((state) => ({ assessments: [newAssessment, ...state.assessments] }));
    return assessmentId;
  },

  getAssessmentsForEmployee: (employeeId) =>
    get().assessments.filter((a) => a.employee_id === employeeId),

  updateAssessmentStatus: async (id, status) => {
    const { error } = await supabase
      .from('assessments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to update assessment status:', error);
      return;
    }

    set((state) => ({
      assessments: state.assessments.map((a) =>
        a.id === id ? { ...a, status, updated_at: new Date().toISOString() } : a
      ),
    }));
  },
}));
