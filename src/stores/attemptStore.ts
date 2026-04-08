import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Question } from './questionStore';
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
  question_count: number;
}

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
}

interface AttemptStore {
  attempts: AssessmentAttempt[];
  loading: boolean;
  initialized: boolean;
  fetchAttempts: () => Promise<void>;
  startAttempt: (assessmentId: string, tenantId: string, employeeId: string) => Promise<string>;
  saveAnswer: (attemptId: string, answer: AnswerEntry) => Promise<void>;
  submitAttempt: (attemptId: string, questionMap: Map<string, Question>, assessmentQuestions: { question_id: string; skill_id: string }[]) => Promise<void>;
  getAttemptForAssessment: (assessmentId: string) => AssessmentAttempt | undefined;
  pauseAttempt: (attemptId: string, remainingSeconds: number) => Promise<void>;
  resumeAttempt: (attemptId: string) => Promise<void>;
  retryEvaluation: (attemptId: string, questionMap: Map<string, Question>, assessmentQuestions: { question_id: string; skill_id: string }[]) => Promise<void>;
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
        id: a.id,
        assessment_id: a.assessment_id,
        tenant_id: a.tenant_id,
        employee_id: a.employee_id,
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
            calculated_level: ss.calculated_level, question_count: ss.question_count,
          })),
        total_ai_score: a.total_ai_score,
        status: a.status,
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        evaluated_at: a.evaluated_at,
        paused_at: a.paused_at ?? null,
        remaining_seconds: a.remaining_seconds ?? null,
      }));

      set({ attempts, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch attempts:', err);
      set({ loading: false, initialized: true });
    }
  },

  startAttempt: async (assessmentId, tenantId, employeeId) => {
    const existing = get().attempts.find((a) => a.assessment_id === assessmentId);
    if (existing) return existing.id;

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
    return (row as any).id;
  },

  saveAnswer: async (attemptId, answer) => {
    const userId = getCurrentUserId();
    // Upsert: delete old then insert new
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

    // First set status to submitted
    await supabase.from('assessment_attempts').update({
      status: 'submitted', submitted_at: now, paused_at: null,
      modified_by: userId, modified_at: now,
    }).eq('id', attemptId);

    set((state) => ({
      attempts: state.attempts.map((a) =>
        a.id === attemptId ? { ...a, status: 'submitted' as const, submitted_at: now, paused_at: null } : a
      ),
    }));

    // Call edge function for AI evaluation
    try {
      const answersPayload = attempt.answers.map((ans) => {
        const q = questionMap.get(ans.question_id);
        return {
          question_id: ans.question_id,
          answer_text: ans.answer_text,
          question_text: q?.question_text ?? '',
          question_type: q?.question_type ?? 'scenario',
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

      // Calculate skill scores
      const skillScoreMap: Record<string, { total: number; count: number }> = {};
      for (const ev of evaluations) {
        const aq = assessmentQuestions.find((q) => q.question_id === ev.question_id);
        const skillId = aq?.skill_id ?? 'unknown';
        if (!skillScoreMap[skillId]) skillScoreMap[skillId] = { total: 0, count: 0 };
        skillScoreMap[skillId].total += ev.score;
        skillScoreMap[skillId].count += 1;
      }
      const skillScores: SkillScore[] = Object.entries(skillScoreMap).map(([skill_id, { total, count }]) => {
        const avg_score = Math.round(total / count);
        return { skill_id, avg_score, calculated_level: scoreToLevel(avg_score), question_count: count };
      });

      // Clean previous data and write new
      await Promise.all([
        supabase.from('ai_evaluations').delete().eq('attempt_id', attemptId),
        supabase.from('attempt_skill_scores').delete().eq('attempt_id', attemptId),
      ]);

      const evalNow = new Date().toISOString();
      await Promise.all([
        supabase.from('assessment_attempts').update({
          status: 'evaluated', total_ai_score: totalScore, evaluated_at: evalNow,
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
                calculated_level: ss.calculated_level, question_count: ss.question_count,
                created_by: userId,
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
            submitted_at: now, evaluated_at: evalNow,
          };
        }),
      }));
    } catch (err) {
      console.error('AI evaluation failed:', err);
      // Status stays as 'submitted' — user can retry
    }
  },

  retryEvaluation: async (attemptId, questionMap, assessmentQuestions) => {
    const attempt = get().attempts.find((a) => a.id === attemptId);
    if (!attempt || attempt.status !== 'submitted') return;

    // Re-use submitAttempt logic but reset status first
    const userId = getCurrentUserId();
    await supabase.from('assessment_attempts').update({
      status: 'in_progress', modified_by: userId, modified_at: new Date().toISOString(),
    }).eq('id', attemptId);

    set((state) => ({
      attempts: state.attempts.map((a) =>
        a.id === attemptId ? { ...a, status: 'in_progress' as const } : a
      ),
    }));

    await get().submitAttempt(attemptId, questionMap, assessmentQuestions);
  },

  getAttemptForAssessment: (assessmentId) =>
    get().attempts.find((a) => a.assessment_id === assessmentId),
}));
