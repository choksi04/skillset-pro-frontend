import { create } from 'zustand';

export interface AnswerEntry {
  question_id: string;
  answer_text: string;
  time_spent_seconds: number;
}

export interface AIEvaluation {
  question_id: string;
  score: number; // 0-100
  feedback: string;
  confidence: number; // 0-1
}

export interface AssessmentAttempt {
  id: string;
  assessment_id: string;
  tenant_id: string;
  employee_id: string;
  answers: AnswerEntry[];
  ai_evaluations: AIEvaluation[];
  total_ai_score: number | null;
  status: 'in_progress' | 'submitted' | 'evaluated' | 'reviewed';
  started_at: string;
  submitted_at?: string;
  evaluated_at?: string;
}

// Mock AI evaluation
function generateMockEvaluation(answers: AnswerEntry[], questionTexts: Map<string, string>): AIEvaluation[] {
  return answers.map((a) => {
    const len = a.answer_text.trim().length;
    // Simulate scoring based on answer length and content
    let score = 0;
    if (len === 0) score = 0;
    else if (len < 20) score = Math.floor(Math.random() * 30) + 10;
    else if (len < 80) score = Math.floor(Math.random() * 25) + 40;
    else if (len < 200) score = Math.floor(Math.random() * 20) + 60;
    else score = Math.floor(Math.random() * 20) + 75;

    const feedbackTemplates = [
      score >= 75 ? 'Strong response demonstrating good understanding of the concepts. Coverage of key aspects is thorough.' :
      score >= 50 ? 'Adequate response covering fundamental aspects. Could benefit from more depth and specific examples.' :
      score >= 25 ? 'Basic response that touches on some relevant points but lacks depth and practical application.' :
      'Insufficient response. Key concepts were not addressed adequately.',
    ];

    return {
      question_id: a.question_id,
      score,
      feedback: feedbackTemplates[0],
      confidence: 0.7 + Math.random() * 0.25,
    };
  });
}

interface AttemptStore {
  attempts: AssessmentAttempt[];
  startAttempt: (assessmentId: string, tenantId: string, employeeId: string) => string;
  saveAnswer: (attemptId: string, answer: AnswerEntry) => void;
  submitAttempt: (attemptId: string, questionTexts: Map<string, string>) => void;
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

  submitAttempt: (attemptId, questionTexts) =>
    set((state) => ({
      attempts: state.attempts.map((a) => {
        if (a.id !== attemptId) return a;
        const evaluations = generateMockEvaluation(a.answers, questionTexts);
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
