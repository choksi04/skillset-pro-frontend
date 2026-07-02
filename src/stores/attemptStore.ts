import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Question } from './questionStore';
import { CompetencyLevel as CompetencyLevelConfig, scoreToLevelDynamic, getIdToLevelMap } from './competencyLevelStore';
import { getCurrentUserId } from '@/lib/audit';

export interface AnswerEntry {
  question_id: string;
  answer_text: string;
  time_spent_seconds: number;
}

export interface DimensionScore {
  dimension: string;
  score: number;
  comment: string;
}

export interface AIEvaluation {
  question_id: string;
  score: number;
  feedback: string;
  dimensions: DimensionScore[];
  confidence: number;
}

export interface SkillScore {
  skill_id: string;
  avg_score: number;
  calculated_level: number;
  target_level: number;
  question_count: number;
}

/**
 * Dynamic scoreToLevel: fetches competency levels from DB and uses score ranges.
 * Falls back to hardcoded thresholds if fetch fails.
 */
async function fetchAndScoreToLevel(score: number): Promise<number> {
  if (score === 0) return 1;
  try {
    const { data } = await supabase.from('competency_levels').select('*').eq('status', 'active').order('level');
    if (data && data.length > 0) {
      const levels: CompetencyLevelConfig[] = data.map((s: any) => ({
        id: s.id, tenant_id: s.tenant_id, level: s.level, name: s.name, label: s.label,
        description: s.description || '', score_range_min: s.score_range_min, score_range_max: s.score_range_max,
        min_questions: s.min_questions, status: s.status,
      }));
      return scoreToLevelDynamic(levels, score);
    }
  } catch { /* fallback */ }
  // Absolute fallback
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

/** @deprecated Use scoreToLevelDynamic from competencyLevelStore instead */
export function scoreToLevel(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

export interface AssessmentAttempt {
  id: string;
  assessment_id: string;
  tenant_id: string;
  employee_id: string;
  answers: AnswerEntry[];
  ai_evaluations: AIEvaluation[];
  skill_scores: SkillScore[];
  total_ai_score: number | null;
  status: 'in_progress' | 'submitted' | 'evaluated' | 'reviewed';
  started_at: string;
  submitted_at?: string;
  evaluated_at?: string;
  paused_at?: string | null;
  remaining_seconds?: number | null;
  evaluation_error?: string | null;
}

interface AttemptStore {
  attempts: AssessmentAttempt[];
  loading: boolean;
  initialized: boolean;
  fetchAttempts: () => Promise<void>;
  fetchAttemptsForAssessment: (assessmentId: string) => Promise<AssessmentAttempt[]>;
  startAttempt: (assessmentId: string, tenantId: string, employeeId: string, forceNew?: boolean) => Promise<string>;
  saveAnswer: (attemptId: string, answer: AnswerEntry) => Promise<void>;
  submitAttempt: (attemptId: string, questionMap: Map<string, Question>, assessmentQuestions: { question_id: string; skill_id: string; target_level: string }[]) => Promise<void>;
  getAttemptForAssessment: (assessmentId: string) => AssessmentAttempt | undefined;
  pauseAttempt: (attemptId: string, remainingSeconds: number) => Promise<void>;
  resumeAttempt: (attemptId: string) => Promise<void>;
  retryEvaluation: (attemptId: string, questionMap: Map<string, Question>, assessmentQuestions: { question_id: string; skill_id: string; target_level: string }[]) => Promise<void>;
}

/**
 * Paginated `.in()` fetch so we bypass the 1000-row PostgREST default and
 * never silently drop child rows (answers / evaluations / skill scores).
 */
async function fetchAllIn<T = any>(table: string, column: string, values: string[]): Promise<T[]> {
  if (values.length === 0) return [];
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(table as any).select('*').in(column, values).range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as any[]) ?? [];
    out.push(...(rows as T[]));
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function mapAttemptRow(a: any, answerRows: any[], evalRows: any[], scoreRows: any[]): AssessmentAttempt {
  return {
    id: a.id, assessment_id: a.assessment_id, tenant_id: a.tenant_id, employee_id: a.employee_id,
    answers: answerRows
      .filter((ans: any) => ans.attempt_id === a.id)
      .map((ans: any) => ({ question_id: ans.question_id, answer_text: ans.answer_text, time_spent_seconds: ans.time_spent_seconds })),
    ai_evaluations: evalRows
      .filter((ev: any) => ev.attempt_id === a.id)
      .map((ev: any) => ({
        question_id: ev.question_id, score: ev.score, feedback: ev.feedback,
        dimensions: ev.dimensions as DimensionScore[], confidence: Number(ev.confidence),
      })),
    skill_scores: scoreRows
      .filter((ss: any) => ss.attempt_id === a.id)
      .map((ss: any) => ({
        skill_id: ss.skill_id, avg_score: ss.avg_score,
        calculated_level: ss.calculated_level, target_level: ss.target_level ?? ss.calculated_level,
        question_count: ss.question_count,
      })),
    total_ai_score: a.total_ai_score, status: a.status,
    started_at: a.started_at, submitted_at: a.submitted_at, evaluated_at: a.evaluated_at,
    paused_at: a.paused_at ?? null, remaining_seconds: a.remaining_seconds ?? null,
    evaluation_error: a.evaluation_error ?? null,
  };
}


export const useAttemptStore = create<AttemptStore>((set, get) => ({
  attempts: [],
  loading: false,
  initialized: false,

  fetchAttempts: async () => {
    set({ loading: true });
    try {
      const { data: attemptRows, error } = await supabase
        .from('assessment_attempts')
        .select('*')
        .order('started_at', { ascending: false });
      if (error) throw error;

      const attemptIds = (attemptRows || []).map((a: any) => a.id);
      let answerRows: any[] = [];
      let evalRows: any[] = [];
      let scoreRows: any[] = [];

      if (attemptIds.length > 0) {
        const [answersRes, evalsRes, scoresRes] = await Promise.all([
          supabase.from('attempt_answers').select('*').in('attempt_id', attemptIds),
          supabase.from('ai_evaluations').select('*').in('attempt_id', attemptIds),
          supabase.from('attempt_skill_scores').select('*').in('attempt_id', attemptIds),
        ]);
        answerRows = answersRes.data || [];
        evalRows = evalsRes.data || [];
        scoreRows = scoresRes.data || [];
      }

      const attempts: AssessmentAttempt[] = (attemptRows || []).map((a: any) => ({
        id: a.id, assessment_id: a.assessment_id, tenant_id: a.tenant_id, employee_id: a.employee_id,
        answers: answerRows
          .filter((ans: any) => ans.attempt_id === a.id)
          .map((ans: any) => ({ question_id: ans.question_id, answer_text: ans.answer_text, time_spent_seconds: ans.time_spent_seconds })),
        ai_evaluations: evalRows
          .filter((ev: any) => ev.attempt_id === a.id)
          .map((ev: any) => ({
            question_id: ev.question_id, score: ev.score, feedback: ev.feedback,
            dimensions: ev.dimensions as DimensionScore[], confidence: Number(ev.confidence),
          })),
        skill_scores: scoreRows
          .filter((ss: any) => ss.attempt_id === a.id)
          .map((ss: any) => ({
            skill_id: ss.skill_id, avg_score: ss.avg_score,
            calculated_level: ss.calculated_level, target_level: ss.target_level ?? ss.calculated_level,
            question_count: ss.question_count,
          })),
        total_ai_score: a.total_ai_score, status: a.status,
        started_at: a.started_at, submitted_at: a.submitted_at, evaluated_at: a.evaluated_at,
        paused_at: a.paused_at ?? null, remaining_seconds: a.remaining_seconds ?? null,
        evaluation_error: a.evaluation_error ?? null,
      }));

      set({ attempts, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch attempts:', err);
      set({ loading: false, initialized: true });
    }
  },

  startAttempt: async (assessmentId, tenantId, employeeId, forceNew = false) => {
    if (!forceNew) {
      // Resume only if there is an active (non-terminal) attempt.
      const active = get().attempts.find(
        (a) => a.assessment_id === assessmentId && a.status === 'in_progress',
      );
      if (active) return active.id;
    }

    const userId = getCurrentUserId();
    const { data: row, error } = await supabase
      .from('assessment_attempts')
      .insert({ assessment_id: assessmentId, tenant_id: tenantId, employee_id: employeeId, status: 'in_progress', created_by: userId })
      .select()
      .single();

    if (error || !row) {
      console.error('Failed to start attempt:', error);
      return '';
    }

    const attempt: AssessmentAttempt = {
      id: (row as any).id, assessment_id: assessmentId, tenant_id: tenantId,
      employee_id: employeeId, answers: [], ai_evaluations: [], skill_scores: [],
      total_ai_score: null, status: 'in_progress', started_at: (row as any).started_at,
      paused_at: null, remaining_seconds: null,
    };

    set((state) => ({ attempts: [...state.attempts, attempt] }));
    // Sync assignment status (best-effort, non-blocking)
    import('./assignmentStore').then(({ syncAssignmentForAttempt }) =>
      syncAssignmentForAttempt(assessmentId, 'in_progress').catch(() => {}),
    );
    return (row as any).id;
  },

  saveAnswer: async (attemptId, answer) => {
    // Lock answers once submitted/evaluated/reviewed
    const current = get().attempts.find((a) => a.id === attemptId);
    if (current && current.status !== 'in_progress') return;

    const userId = getCurrentUserId();
    await supabase.from('attempt_answers').delete()
      .eq('attempt_id', attemptId).eq('question_id', answer.question_id);

    await supabase.from('attempt_answers').insert({
      attempt_id: attemptId, question_id: answer.question_id,
      answer_text: answer.answer_text, time_spent_seconds: answer.time_spent_seconds,
      created_by: userId,
    });

    set((state) => ({
      attempts: state.attempts.map((a) => {
        if (a.id !== attemptId) return a;
        const answers = a.answers.filter((ans) => ans.question_id !== answer.question_id);
        return { ...a, answers: [...answers, answer] };
      }),
    }));
  },

  pauseAttempt: async (attemptId, remainingSeconds) => {
    const now = new Date().toISOString();
    await supabase.from('assessment_attempts').update({
      paused_at: now, remaining_seconds: remainingSeconds,
    }).eq('id', attemptId);

    set((state) => ({
      attempts: state.attempts.map((a) =>
        a.id === attemptId ? { ...a, paused_at: now, remaining_seconds: remainingSeconds } : a
      ),
    }));
  },

  resumeAttempt: async (attemptId) => {
    await supabase.from('assessment_attempts').update({
      paused_at: null,
    }).eq('id', attemptId);

    set((state) => ({
      attempts: state.attempts.map((a) =>
        a.id === attemptId ? { ...a, paused_at: null } : a
      ),
    }));
  },

  submitAttempt: async (attemptId, questionMap, assessmentQuestions) => {
    const attempt = get().attempts.find((a) => a.id === attemptId);
    if (!attempt) return;
    if (attempt.status === 'evaluated' || attempt.status === 'submitted') return;

    const now = new Date().toISOString();
    const userId = getCurrentUserId();

    await supabase.from('assessment_attempts').update({
      status: 'submitted', submitted_at: now, paused_at: null,
      evaluation_error: null,
      modified_by: userId, modified_at: now,
    }).eq('id', attemptId);

    set((state) => ({
      attempts: state.attempts.map((a) =>
        a.id === attemptId ? { ...a, status: 'submitted' as const, submitted_at: now, paused_at: null, evaluation_error: null } : a
      ),
    }));
    import('./assignmentStore').then(({ syncAssignmentForAttempt }) =>
      syncAssignmentForAttempt(attempt.assessment_id, 'submitted').catch(() => {}),
    );

    try {
      const answersPayload = attempt.answers.map((ans) => {
        const q = questionMap.get(ans.question_id);
        return {
          question_id: ans.question_id, answer_text: ans.answer_text,
          question_text: q?.question_text ?? '', question_type: q?.question_type ?? 'scenario',
          evaluation_guidelines: q?.evaluation_guidelines ?? '',
          skill_id: assessmentQuestions.find((aq) => aq.question_id === ans.question_id)?.skill_id ?? '',
        };
      });

      const { data: evalData, error: evalError } = await supabase.functions.invoke('evaluate-assessment', {
        body: { attempt_id: attemptId, answers: answersPayload },
      });

      if (evalError) throw evalError;
      if (evalData?.error) throw new Error(evalData.error);

      const evaluations: AIEvaluation[] = evalData.evaluations || [];
      const totalScore = evaluations.length > 0
        ? Math.round(evaluations.reduce((sum: number, e: AIEvaluation) => sum + e.score, 0) / evaluations.length)
        : 0;

      // Calculate skill scores using dynamic level mapping
      const skillScoreMap: Record<string, { total: number; count: number }> = {};
      for (const ev of evaluations) {
        const aq = assessmentQuestions.find((q) => q.question_id === ev.question_id);
        const skillId = aq?.skill_id ?? 'unknown';
        if (!skillScoreMap[skillId]) skillScoreMap[skillId] = { total: 0, count: 0 };
        skillScoreMap[skillId].total += ev.score;
        skillScoreMap[skillId].count += 1;
      }

      // Use dynamic scoreToLevel, capped at target level
      const skillScoreEntries = Object.entries(skillScoreMap);
      const skillScores: SkillScore[] = [];

      // Build target level map per skill from assessment questions
      let idToLevelMap: Record<string, number> = {};
      try {
        const { data: clData } = await supabase.from('competency_levels').select('*').eq('status', 'active');
        if (clData && clData.length > 0) {
          const clLevels: CompetencyLevelConfig[] = clData.map((s: any) => ({
            id: s.id, tenant_id: s.tenant_id, level: s.level, name: s.name, label: s.label,
            description: s.description || '', score_range_min: s.score_range_min, score_range_max: s.score_range_max,
            min_questions: s.min_questions, status: s.status,
          }));
          idToLevelMap = getIdToLevelMap(clLevels);
        }
      } catch { /* fallback */ }

      // Determine the target level number for each skill
      const skillTargetLevelMap: Record<string, number> = {};
      for (const aq of assessmentQuestions) {
        if (!skillTargetLevelMap[aq.skill_id]) {
          const targetLevelNum = idToLevelMap[aq.target_level] ?? 5;
          skillTargetLevelMap[aq.skill_id] = targetLevelNum;
        }
      }

      for (const [skill_id, { total, count }] of skillScoreEntries) {
        const avg_score = Math.round(total / count);
        const rawLevel = await fetchAndScoreToLevel(avg_score);
        const target_level = skillTargetLevelMap[skill_id] ?? 5;
        const calculated_level = Math.min(rawLevel, target_level);
        skillScores.push({ skill_id, avg_score, calculated_level, target_level, question_count: count });
      }

      // Clean previous data and write new
      await Promise.all([
        supabase.from('ai_evaluations').delete().eq('attempt_id', attemptId),
        supabase.from('attempt_skill_scores').delete().eq('attempt_id', attemptId),
      ]);

      const evalNow = new Date().toISOString();
      await Promise.all([
        supabase.from('assessment_attempts').update({
          status: 'evaluated', total_ai_score: totalScore, evaluated_at: evalNow,
          evaluation_error: null,
          modified_by: userId, modified_at: evalNow,
        }).eq('id', attemptId),

        evaluations.length > 0
          ? supabase.from('ai_evaluations').insert(
              evaluations.map((ev) => ({
                attempt_id: attemptId, question_id: ev.question_id, score: ev.score,
                feedback: ev.feedback, dimensions: ev.dimensions as any, confidence: ev.confidence,
                created_by: userId,
              }))
            )
          : Promise.resolve(),

        skillScores.length > 0
          ? supabase.from('attempt_skill_scores').insert(
              skillScores.map((ss) => ({
                attempt_id: attemptId, skill_id: ss.skill_id, avg_score: ss.avg_score,
                calculated_level: ss.calculated_level, target_level: ss.target_level,
                question_count: ss.question_count, created_by: userId,
              }))
            )
          : Promise.resolve(),
      ]);

      set((state) => ({
        attempts: state.attempts.map((a) => {
          if (a.id !== attemptId) return a;
          return {
            ...a, ai_evaluations: evaluations, skill_scores: skillScores,
            total_ai_score: totalScore, status: 'evaluated' as const,
            submitted_at: now, evaluated_at: evalNow, evaluation_error: null,
          };
        }),
      }));
      import('./assignmentStore').then(({ syncAssignmentForAttempt }) =>
        syncAssignmentForAttempt(attempt.assessment_id, 'evaluated').catch(() => {}),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI evaluation failed. Please retry.';
      console.error('AI evaluation failed:', err);
      // Persist the error reason on the attempt so the UI can surface it.
      try {
        await supabase.from('assessment_attempts').update({
          evaluation_error: message,
          modified_by: userId, modified_at: new Date().toISOString(),
        }).eq('id', attemptId);
      } catch (persistErr) {
        console.error('Failed to persist evaluation_error:', persistErr);
      }
      set((state) => ({
        attempts: state.attempts.map((a) =>
          a.id === attemptId ? { ...a, evaluation_error: message } : a
        ),
      }));
      // Re-throw so callers can toast the user.
      throw err instanceof Error ? err : new Error(message);
    }
  },

  retryEvaluation: async (attemptId, questionMap, assessmentQuestions) => {
    const attempt = get().attempts.find((a) => a.id === attemptId);
    if (!attempt || attempt.status !== 'submitted') return;

    const userId = getCurrentUserId();
    await supabase.from('assessment_attempts').update({
      status: 'in_progress', evaluation_error: null,
      modified_by: userId, modified_at: new Date().toISOString(),
    }).eq('id', attemptId);

    set((state) => ({
      attempts: state.attempts.map((a) =>
        a.id === attemptId ? { ...a, status: 'in_progress' as const, evaluation_error: null } : a
      ),
    }));

    await get().submitAttempt(attemptId, questionMap, assessmentQuestions);
  },

  getAttemptForAssessment: (assessmentId) => {
    // Return the most recent attempt so re-attempts surface the new in-progress row
    // instead of an older terminal one.
    const matches = get().attempts.filter((a) => a.assessment_id === assessmentId);
    if (matches.length === 0) return undefined;
    return matches.slice().sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    )[0];
  },
}));
