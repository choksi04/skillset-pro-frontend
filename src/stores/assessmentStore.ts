import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Question, CompetencyLevel } from './questionStore';
import { SkillSelfRating, RatingLevel } from './registryStore';
import { CompetencyLevel as CompetencyLevelConfig, getLevelToCompetencyMap } from './competencyLevelStore';
import { AssessmentConfig, getQuestionLimits } from './assessmentConfigStore';
import { getCurrentUserId } from '@/lib/audit';

export type AssessmentStatus = 'pending' | 'in_progress' | 'completed' | 'evaluated' | 'review_pending' | 'approved';

export const assessmentStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Not Started', color: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', color: 'bg-info/15 text-info border-info/20' },
  completed: { label: 'Submitted', color: 'bg-primary/15 text-primary border-primary/20' },
  evaluated: { label: 'Evaluated', color: 'bg-success/15 text-success border-success/20' },
  review_pending: { label: 'Under Review', color: 'bg-warning/15 text-warning border-warning/20' },
  approved: { label: 'Approved', color: 'bg-success/15 text-success border-success/20' },
};

/**
 * For a self-rating of n, get the target competency level name.
 * Questions are picked ONLY from the exact level matching the rating.
 */
function getTargetCompetencyLevel(rating: RatingLevel, settings: CompetencyLevelConfig[]): CompetencyLevel | null {
  const levelMap = getLevelToCompetencyMap(settings);
  return levelMap[rating] || null;
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
  cycle_id: string | null;
  is_reassessment: boolean;
  parent_assessment_id: string | null;
  skill_ids: string[];
  assessment_questions: AssessmentQuestion[];
  status: string;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface GenerateAssessmentParams {
  tenant_id: string;
  employee_id: string;
  submission_id: string;
  domain_id: string;
  cycle_id?: string;
  ratings: SkillSelfRating[];
  publishedQuestions: Question[];
  maxQuestionsPerSkill?: number;
  excludeQuestionIds?: string[];
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  details?: { skill_id: string; skill_name?: string; available: number; required: number; question_type?: string }[];
}

/**
 * Validate that enough published questions exist for each skill at the exact rated level,
 * broken down by question type using assessment config limits.
 */
export async function validateQuestionAvailability(
  ratings: SkillSelfRating[],
  publishedQuestions: Question[],
  settings: CompetencyLevelConfig[] = [],
  configs: AssessmentConfig[] = [],
): Promise<ValidationResult> {
  const issues: { skill_id: string; available: number; required: number; question_type?: string }[] = [];
  const questionTypes = ['mcq', 'scenario', 'coding'];

  for (const { skill_id, rating } of ratings) {
    const targetLevel = getTargetCompetencyLevel(rating, settings);
    if (!targetLevel) continue;

    for (const qType of questionTypes) {
      const { min } = getQuestionLimits(configs, qType);
      if (min <= 0) continue;
      const candidates = publishedQuestions.filter(
        (q) => q.skill_id === skill_id && q.competency_level === targetLevel && q.question_type === qType
      );
      if (candidates.length < min) {
        issues.push({ skill_id, available: candidates.length, required: min, question_type: qType });
      }
    }
  }

  if (issues.length > 0) {
    return {
      valid: false,
      message: 'Assessment is not available at the moment. Please contact your manager.',
      details: issues,
    };
  }
  return { valid: true };
}

/**
 * Generate assessment questions using assessment config limits per question type.
 * For each skill rated at level n, pick questions ONLY from level n (exact match).
 * For each question type, pick between min and max questions as per config.
 * Questions are picked deterministically by created_at order.
 */
export function generateAssessmentQuestions(
  ratings: SkillSelfRating[],
  publishedQuestions: Question[],
  _maxPerSkill: number = 3, // kept for backward compat but now uses config
  excludeIds: string[] = [],
  settings: CompetencyLevelConfig[] = [],
  configs: AssessmentConfig[] = [],
): AssessmentQuestion[] {
  const selected: AssessmentQuestion[] = [];
  const usedIds = new Set(excludeIds);
  const questionTypes = ['mcq', 'scenario', 'coding'];

  for (const { skill_id, rating } of ratings) {
    const targetLevel = getTargetCompetencyLevel(rating, settings);
    if (!targetLevel) continue;

    for (const qType of questionTypes) {
      const { min, max } = getQuestionLimits(configs, qType);
      const targetCount = Math.max(min, Math.min(max, min)); // use min as target, up to max

      const candidates = publishedQuestions
        .filter(
          (q) => q.skill_id === skill_id && q.competency_level === targetLevel && q.question_type === qType && !usedIds.has(q.id)
        )
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const picked = candidates.slice(0, targetCount);
      for (const q of picked) {
        usedIds.add(q.id);
        selected.push({ question_id: q.id, skill_id: q.skill_id, target_level: targetLevel });
      }
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
  updateAssessmentStatus: (id: string, status: string) => Promise<void>;
}

export const useAssessmentStore = create<AssessmentStore>((set, get) => ({
  assessments: [],
  loading: false,
  initialized: false,

  fetchAssessments: async () => {
    set({ loading: true });
    try {
      const { data: assessmentRows, error } = await supabase
        .from('assessments')
        .select('*')
        .is('deleted_on', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

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
          id: a.id, tenant_id: a.tenant_id, employee_id: a.employee_id,
          submission_id: a.submission_id, domain_id: a.domain_id,
          cycle_id: a.cycle_id ?? null, is_reassessment: a.is_reassessment ?? false,
          parent_assessment_id: a.parent_assessment_id ?? null,
          skill_ids: skillIds, assessment_questions: aqs,
          status: a.status, duration_minutes: a.duration_minutes,
          created_at: a.created_at, updated_at: a.updated_at,
        };
      });

      set({ assessments, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch assessments:', err);
      set({ loading: false, initialized: true });
    }
  },

  addAssessment: async (params) => {
    const { tenant_id, employee_id, submission_id, domain_id, cycle_id, ratings, publishedQuestions, maxQuestionsPerSkill, excludeQuestionIds } = params;
    // Fetch competency levels and assessment configs for dynamic mapping
    const [{ data: levelsData }, { data: configsData }] = await Promise.all([
      supabase.from('competency_levels').select('*').order('level'),
      supabase.from('assessment_config').select('*'),
    ]);
    const clSettings: CompetencyLevelConfig[] = (levelsData || []).map((s: any) => ({
      id: s.id, tenant_id: s.tenant_id, level: s.level, name: s.name, label: s.label,
      description: s.description || '', score_range_min: s.score_range_min, score_range_max: s.score_range_max,
      min_questions: s.min_questions, status: s.status,
    }));
    const acConfigs: AssessmentConfig[] = (configsData || []).map((c: any) => ({
      id: c.id, tenant_id: c.tenant_id, config_type: c.config_type,
      reference_id: c.reference_id, question_type: c.question_type,
      min_questions: c.min_questions, max_questions: c.max_questions,
    }));
    const assessmentQuestions = generateAssessmentQuestions(ratings, publishedQuestions, maxQuestionsPerSkill, excludeQuestionIds, clSettings, acConfigs);
    const skillIds = [...new Set(ratings.map((r) => r.skill_id))];
    const durationMinutes = Math.max(30, assessmentQuestions.length * 10);
    const userId = getCurrentUserId();

    const { data: row, error } = await supabase
      .from('assessments')
      .insert({
        tenant_id, employee_id, submission_id, domain_id,
        cycle_id: cycle_id ?? null, status: 'pending',
        duration_minutes: durationMinutes, created_by: userId,
      })
      .select()
      .single();

    if (error || !row) {
      console.error('Failed to create assessment:', error);
      return '';
    }

    const assessmentId = (row as any).id;

    if (assessmentQuestions.length > 0) {
      const { error: qError } = await supabase
        .from('assessment_questions')
        .insert(
          assessmentQuestions.map((aq) => ({
            assessment_id: assessmentId,
            question_id: aq.question_id,
            skill_id: aq.skill_id,
            target_level: aq.target_level,
            created_by: userId,
          }))
        );
      if (qError) console.error('Failed to insert assessment questions:', qError);
    }

    const newAssessment: Assessment = {
      id: assessmentId, tenant_id, employee_id, submission_id, domain_id,
      cycle_id: cycle_id ?? null, is_reassessment: false, parent_assessment_id: null,
      skill_ids: skillIds, assessment_questions: assessmentQuestions,
      status: 'pending', duration_minutes: durationMinutes,
      created_at: (row as any).created_at, updated_at: (row as any).updated_at,
    };

    set((state) => ({ assessments: [newAssessment, ...state.assessments] }));
    return assessmentId;
  },

  getAssessmentsForEmployee: (employeeId) =>
    get().assessments.filter((a) => a.employee_id === employeeId),

  updateAssessmentStatus: async (id, status) => {
    const userId = getCurrentUserId();
    const { error } = await supabase
      .from('assessments')
      .update({ status, updated_at: new Date().toISOString(), modified_by: userId, modified_at: new Date().toISOString() })
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
