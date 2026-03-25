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
}

// ---- Mock AI Evaluation ----

const EVAL_DIMENSIONS = ['Concept Understanding', 'Technical Correctness', 'Solution Practicality', 'Clarity'] as const;
type EvalDimension = typeof EVAL_DIMENSIONS[number];

function scoreDimension(answer: string, dimension: EvalDimension, questionType: string): { score: number; comment: string } {
  const len = answer.trim().length;
  const words = answer.trim().split(/\s+/).length;
  let base = 0;
  if (len === 0) base = 0;
  else if (words < 10) base = Math.floor(Math.random() * 20) + 10;
  else if (words < 30) base = Math.floor(Math.random() * 15) + 35;
  else if (words < 80) base = Math.floor(Math.random() * 15) + 55;
  else if (words < 150) base = Math.floor(Math.random() * 10) + 70;
  else base = Math.floor(Math.random() * 10) + 80;

  const modifiers: Record<EvalDimension, { bonus: number; comments: Record<string, string> }> = {
    'Concept Understanding': {
      bonus: answer.match(/because|therefore|concept|principle|pattern|approach/gi)?.length ? 8 : -5,
      comments: { high: 'Demonstrates solid grasp of core concepts.', mid: 'Shows basic understanding but misses some concepts.', low: 'Limited conceptual understanding.', zero: 'No meaningful concepts addressed.' },
    },
    'Technical Correctness': {
      bonus: questionType === 'coding'
        ? (answer.match(/function|const|let|return|async|await|import|class|interface/gi)?.length ? 10 : -8)
        : (answer.match(/implement|configure|deploy|optimize|validate|handle/gi)?.length ? 6 : -3),
      comments: { high: 'Technically accurate with correct terminology.', mid: 'Generally correct but has some gaps.', low: 'Several technical errors present.', zero: 'No technically relevant content.' },
    },
    'Solution Practicality': {
      bonus: answer.match(/production|scalab|maintain|trade-?off|real-?world|performance|cost/gi)?.length ? 7 : -4,
      comments: { high: 'Practical solution considering real-world constraints.', mid: 'Workable but lacks practical considerations.', low: 'Largely theoretical.', zero: 'No practical solution proposed.' },
    },
    'Clarity': {
      bonus: (words > 20 && answer.includes('.') && !answer.match(/(.)\1{4,}/)) ? 6 : -3,
      comments: { high: 'Well-structured with clear articulation.', mid: 'Reasonably clear but could improve.', low: 'Unclear or poorly structured.', zero: 'No meaningful content.' },
    },
  };

  const mod = modifiers[dimension];
  const score = Math.max(0, Math.min(100, base + mod.bonus));
  const tier = score === 0 ? 'zero' : score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
  return { score, comment: mod.comments[tier] };
}

function generateStructuredEvaluation(answers: AnswerEntry[], questionMap: Map<string, Question>): AIEvaluation[] {
  return answers.map((a) => {
    const question = questionMap.get(a.question_id);
    const qType = question?.question_type ?? 'scenario';

    if (qType === 'mcq' && question) {
      const guidelines = question.evaluation_guidelines.toLowerCase();
      const correctMatch = guidelines.match(/correct\s*(?:answer)?[:\s]*([A-D])/i);
      const correctAnswer = correctMatch?.[1]?.toUpperCase();
      const userAnswer = a.answer_text.trim().toUpperCase();
      const isCorrect = correctAnswer === userAnswer;
      const score = isCorrect ? 100 : 0;
      return {
        question_id: a.question_id, score,
        feedback: isCorrect ? 'Correct answer selected.' : `Incorrect. Expected answer was ${correctAnswer ?? 'not determined'}.`,
        dimensions: EVAL_DIMENSIONS.map((dim) => ({
          dimension: dim,
          score: isCorrect ? 85 + Math.floor(Math.random() * 15) : Math.floor(Math.random() * 25),
          comment: isCorrect ? `Correct selection indicates adequate ${dim.toLowerCase()}.` : `Incorrect answer suggests gaps in ${dim.toLowerCase()}.`,
        })),
        confidence: 0.95,
      };
    }

    const dimensions: DimensionScore[] = EVAL_DIMENSIONS.map((dim) => {
      const { score, comment } = scoreDimension(a.answer_text, dim, qType);
      return { dimension: dim, score, comment };
    });
    const avgScore = dimensions.length > 0
      ? Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
      : 0;

    const strongDims = dimensions.filter((d) => d.score >= 70).map((d) => d.dimension.toLowerCase());
    const weakDims = dimensions.filter((d) => d.score < 50).map((d) => d.dimension.toLowerCase());
    let feedback = '';
    if (avgScore >= 75) {
      feedback = `Strong response demonstrating good ${strongDims.slice(0, 2).join(' and ') || 'understanding'}.`;
      if (weakDims.length > 0) feedback += ` Could improve on ${weakDims.join(' and ')}.`;
    } else if (avgScore >= 50) {
      feedback = `Adequate response with reasonable ${strongDims[0] || 'coverage'}.`;
      feedback += weakDims.length > 0 ? ` Needs improvement in ${weakDims.join(' and ')}.` : ' More depth would help.';
    } else if (avgScore >= 25) {
      feedback = 'Basic response that touches on some relevant points but lacks depth.';
      feedback += weakDims.length > 0 ? ` Key gaps in ${weakDims.join(', ')}.` : ' Needs more detail.';
    } else {
      feedback = 'Insufficient response. Key concepts were not addressed.';
    }

    return { question_id: a.question_id, score: avgScore, feedback, dimensions, confidence: 0.65 + Math.random() * 0.3 };
  });
}

// ---- Store ----

interface AttemptStore {
  attempts: AssessmentAttempt[];
  loading: boolean;
  initialized: boolean;
  fetchAttempts: () => Promise<void>;
  startAttempt: (assessmentId: string, tenantId: string, employeeId: string) => Promise<string>;
  saveAnswer: (attemptId: string, answer: AnswerEntry) => Promise<void>;
  submitAttempt: (attemptId: string, questionMap: Map<string, Question>, assessmentQuestions: { question_id: string; skill_id: string }[]) => Promise<void>;
  getAttemptForAssessment: (assessmentId: string) => AssessmentAttempt | undefined;
}

export const useAttemptStore = create<AttemptStore>((set, get) => ({
  attempts: [],
  loading: false,
  initialized: false,

  fetchAttempts: async () => {
    if (get().initialized) return;
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
    };

    set((state) => ({ attempts: [...state.attempts, attempt] }));
    return (row as any).id;
  },

  saveAnswer: async (attemptId, answer) => {
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

  submitAttempt: async (attemptId, questionMap, assessmentQuestions) => {
    const attempt = get().attempts.find((a) => a.id === attemptId);
    if (!attempt) return;

    if (attempt.status === 'evaluated' || attempt.status === 'submitted') return;

    const userId = getCurrentUserId();
    const evaluations = generateStructuredEvaluation(attempt.answers, questionMap);
    const totalScore = evaluations.length > 0
      ? Math.round(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length)
      : 0;

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

    const now = new Date().toISOString();

    await Promise.all([
      supabase.from('ai_evaluations').delete().eq('attempt_id', attemptId),
      supabase.from('attempt_skill_scores').delete().eq('attempt_id', attemptId),
    ]);

    await Promise.all([
      supabase.from('assessment_attempts').update({
        status: 'evaluated', total_ai_score: totalScore, submitted_at: now, evaluated_at: now,
        modified_by: userId, modified_at: now,
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
          submitted_at: now, evaluated_at: now,
        };
      }),
    }));
  },

  getAttemptForAssessment: (assessmentId) =>
    get().attempts.find((a) => a.assessment_id === assessmentId),
}));
