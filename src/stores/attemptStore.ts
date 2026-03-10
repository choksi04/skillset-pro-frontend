import { create } from 'zustand';
import { Question } from './questionStore';

export interface AnswerEntry {
  question_id: string;
  answer_text: string;
  time_spent_seconds: number;
}

export interface DimensionScore {
  dimension: string;
  score: number; // 0-100
  comment: string;
}

export interface AIEvaluation {
  question_id: string;
  score: number; // 0-100
  feedback: string;
  dimensions: DimensionScore[];
  confidence: number; // 0-1
}

export interface SkillScore {
  skill_id: string;
  avg_score: number; // 0-100
  calculated_level: number; // 1-5
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

// ---- Structured AI Evaluation (mock) ----

const EVAL_DIMENSIONS = [
  'Concept Understanding',
  'Technical Correctness',
  'Solution Practicality',
  'Clarity',
] as const;

type EvalDimension = typeof EVAL_DIMENSIONS[number];

// Deterministic-ish scoring based on answer content
function scoreDimension(answer: string, dimension: EvalDimension, questionType: string): { score: number; comment: string } {
  const len = answer.trim().length;
  const words = answer.trim().split(/\s+/).length;

  // Base score from length/depth
  let base = 0;
  if (len === 0) base = 0;
  else if (words < 10) base = Math.floor(Math.random() * 20) + 10;
  else if (words < 30) base = Math.floor(Math.random() * 15) + 35;
  else if (words < 80) base = Math.floor(Math.random() * 15) + 55;
  else if (words < 150) base = Math.floor(Math.random() * 10) + 70;
  else base = Math.floor(Math.random() * 10) + 80;

  // Dimension-specific modifiers
  const modifiers: Record<EvalDimension, { bonus: number; comments: Record<string, string> }> = {
    'Concept Understanding': {
      bonus: answer.match(/because|therefore|concept|principle|pattern|approach/gi)?.length ? 8 : -5,
      comments: {
        high: 'Demonstrates solid grasp of core concepts and underlying principles.',
        mid: 'Shows basic understanding but misses some foundational concepts.',
        low: 'Limited conceptual understanding evident in the response.',
        zero: 'No meaningful concepts addressed.',
      },
    },
    'Technical Correctness': {
      bonus: questionType === 'coding'
        ? (answer.match(/function|const|let|return|async|await|import|class|interface/gi)?.length ? 10 : -8)
        : (answer.match(/implement|configure|deploy|optimize|validate|handle/gi)?.length ? 6 : -3),
      comments: {
        high: 'Technically accurate with correct use of terminology and approaches.',
        mid: 'Generally correct but contains some technical inaccuracies or gaps.',
        low: 'Several technical errors or misconceptions present.',
        zero: 'No technically relevant content provided.',
      },
    },
    'Solution Practicality': {
      bonus: answer.match(/production|scalab|maintain|trade-?off|real-?world|performance|cost/gi)?.length ? 7 : -4,
      comments: {
        high: 'Proposed solution is practical and considers real-world constraints effectively.',
        mid: 'Solution is workable but lacks consideration of practical constraints.',
        low: 'Solution is largely theoretical and may not work in practice.',
        zero: 'No practical solution proposed.',
      },
    },
    'Clarity': {
      bonus: (words > 20 && answer.includes('.') && !answer.match(/(.)\1{4,}/)) ? 6 : -3,
      comments: {
        high: 'Well-structured response with clear articulation and logical flow.',
        mid: 'Reasonably clear but could be better organized or more concise.',
        low: 'Response is unclear or poorly structured, making it hard to follow.',
        zero: 'No meaningful content to evaluate for clarity.',
      },
    },
  };

  const mod = modifiers[dimension];
  const score = Math.max(0, Math.min(100, base + mod.bonus));
  const tier = score === 0 ? 'zero' : score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';

  return { score, comment: mod.comments[tier] };
}

function generateStructuredEvaluation(
  answers: AnswerEntry[],
  questionMap: Map<string, Question>,
): AIEvaluation[] {
  return answers.map((a) => {
    const question = questionMap.get(a.question_id);
    const qType = question?.question_type ?? 'scenario';

    // MCQ: simple correct/incorrect
    if (qType === 'mcq' && question) {
      const guidelines = question.evaluation_guidelines.toLowerCase();
      const correctMatch = guidelines.match(/correct\s*(?:answer)?[:\s]*([A-D])/i);
      const correctAnswer = correctMatch?.[1]?.toUpperCase();
      const userAnswer = a.answer_text.trim().toUpperCase();
      const isCorrect = correctAnswer === userAnswer;

      const score = isCorrect ? 100 : 0;
      return {
        question_id: a.question_id,
        score,
        feedback: isCorrect
          ? 'Correct answer selected. Demonstrates knowledge of the concept.'
          : `Incorrect. The expected answer was ${correctAnswer ?? 'not determined'}. Review the underlying concept for improvement.`,
        dimensions: EVAL_DIMENSIONS.map((dim) => ({
          dimension: dim,
          score: isCorrect ? 85 + Math.floor(Math.random() * 15) : Math.floor(Math.random() * 25),
          comment: isCorrect
            ? `Correct selection indicates adequate ${dim.toLowerCase()}.`
            : `Incorrect answer suggests gaps in ${dim.toLowerCase()}.`,
        })),
        confidence: 0.95,
      };
    }

    // Scenario / Coding: multi-dimension evaluation
    const dimensions: DimensionScore[] = EVAL_DIMENSIONS.map((dim) => {
      const { score, comment } = scoreDimension(a.answer_text, dim, qType);
      return { dimension: dim, score, comment };
    });

    const avgScore = dimensions.length > 0
      ? Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
      : 0;

    // Generate contextual feedback
    const strongDims = dimensions.filter((d) => d.score >= 70).map((d) => d.dimension.toLowerCase());
    const weakDims = dimensions.filter((d) => d.score < 50).map((d) => d.dimension.toLowerCase());
    const skillName = question ? '' : '';

    let feedback = '';
    if (avgScore >= 75) {
      feedback = `Strong response demonstrating good ${strongDims.slice(0, 2).join(' and ') || 'understanding'}.`;
      if (weakDims.length > 0) feedback += ` Could improve on ${weakDims.join(' and ')}.`;
    } else if (avgScore >= 50) {
      feedback = `Adequate response with reasonable ${strongDims[0] || 'coverage'}.`;
      feedback += weakDims.length > 0
        ? ` Needs improvement in ${weakDims.join(' and ')}.`
        : ' More depth and specific examples would strengthen the answer.';
    } else if (avgScore >= 25) {
      feedback = `Basic response that touches on some relevant points but lacks depth.`;
      feedback += weakDims.length > 0
        ? ` Key gaps in ${weakDims.join(', ')}.`
        : ' Needs significantly more detail and practical application.';
    } else {
      feedback = 'Insufficient response. Key concepts were not addressed adequately across evaluation dimensions.';
    }

    return {
      question_id: a.question_id,
      score: avgScore,
      feedback,
      dimensions,
      confidence: 0.65 + Math.random() * 0.3,
    };
  });
}

// ---- Store ----

interface AttemptStore {
  attempts: AssessmentAttempt[];
  startAttempt: (assessmentId: string, tenantId: string, employeeId: string) => string;
  saveAnswer: (attemptId: string, answer: AnswerEntry) => void;
  submitAttempt: (attemptId: string, questionMap: Map<string, Question>, assessmentQuestions: { question_id: string; skill_id: string }[]) => void;
  getAttemptForAssessment: (assessmentId: string) => AssessmentAttempt | undefined;
}

export const useAttemptStore = create<AttemptStore>((set, get) => ({
  attempts: [],

  startAttempt: (assessmentId, tenantId, employeeId) => {
    const existing = get().attempts.find((a) => a.assessment_id === assessmentId);
    if (existing) return existing.id;

    const id = `attempt-${Date.now()}`;
    set((state) => ({
      attempts: [...state.attempts, {
        id,
        assessment_id: assessmentId,
        tenant_id: tenantId,
        employee_id: employeeId,
        answers: [],
        ai_evaluations: [],
        total_ai_score: null,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      }],
    }));
    return id;
  },

  saveAnswer: (attemptId, answer) =>
    set((state) => ({
      attempts: state.attempts.map((a) => {
        if (a.id !== attemptId) return a;
        const answers = a.answers.filter((ans) => ans.question_id !== answer.question_id);
        return { ...a, answers: [...answers, answer] };
      }),
    })),

  submitAttempt: (attemptId, questionMap) =>
    set((state) => ({
      attempts: state.attempts.map((a) => {
        if (a.id !== attemptId) return a;
        const evaluations = generateStructuredEvaluation(a.answers, questionMap);
        const totalScore = evaluations.length > 0
          ? Math.round(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length)
          : 0;
        return {
          ...a,
          ai_evaluations: evaluations,
          total_ai_score: totalScore,
          status: 'evaluated' as const,
          submitted_at: new Date().toISOString(),
          evaluated_at: new Date().toISOString(),
        };
      }),
    })),

  getAttemptForAssessment: (assessmentId) =>
    get().attempts.find((a) => a.assessment_id === assessmentId),
}));
