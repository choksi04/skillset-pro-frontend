import { create } from 'zustand';

export type CompetencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type QuestionType = 'scenario' | 'coding' | 'mcq';
export type QuestionStatus = 'draft' | 'published' | 'disabled';

export interface Question {
  id: string;
  tenant_id: string;
  skill_id: string;
  competency_level: CompetencyLevel;
  question_type: QuestionType;
  question_text: string;
  evaluation_guidelines: string;
  status: QuestionStatus;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

const defaultQuestions: Question[] = [
  {
    id: 'q-1', tenant_id: 'tenant-001', skill_id: 'skill-1', competency_level: 'intermediate',
    question_type: 'scenario', question_text: 'You are building an internal dashboard that displays real-time metrics. The component re-renders excessively when data updates. Describe your approach to optimize rendering performance using React patterns.',
    evaluation_guidelines: 'Look for: React.memo, useMemo, useCallback, virtualization, proper state structure. Bonus: mention React Profiler for diagnosis.',
    status: 'published', ai_generated: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'q-2', tenant_id: 'tenant-001', skill_id: 'skill-2', competency_level: 'advanced',
    question_type: 'coding', question_text: 'Write a Node.js middleware that implements rate limiting using a sliding window algorithm. It should support configurable limits per route and return appropriate HTTP headers.',
    evaluation_guidelines: 'Evaluate: correct sliding window implementation, proper HTTP 429 responses, X-RateLimit headers, configurable per-route limits, memory management considerations.',
    status: 'published', ai_generated: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'q-3', tenant_id: 'tenant-001', skill_id: 'skill-3', competency_level: 'beginner',
    question_type: 'mcq', question_text: 'Which of the following is the FIRST step when debugging an application error?\n\nA) Rewrite the suspected module\nB) Reproduce the error consistently\nC) Add logging everywhere\nD) Ask a colleague to fix it',
    evaluation_guidelines: 'Correct answer: B. Reproducing the error is the foundational first step in any debugging methodology.',
    status: 'published', ai_generated: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'q-4', tenant_id: 'tenant-001', skill_id: 'skill-4', competency_level: 'expert',
    question_type: 'scenario', question_text: 'Design a system for a back-office portal that needs to process and display 10 million audit log entries with full-text search, filtering, and real-time updates. Describe your architecture decisions.',
    evaluation_guidelines: 'Evaluate: data storage strategy (e.g. Elasticsearch), pagination/virtualization, event-driven architecture for real-time, caching layers, trade-offs discussed.',
    status: 'published', ai_generated: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
];

interface QuestionStore {
  questions: Question[];
  addQuestion: (q: Omit<Question, 'id' | 'created_at' | 'updated_at'>) => void;
  addQuestions: (qs: Omit<Question, 'id' | 'created_at' | 'updated_at'>[]) => void;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  toggleQuestionStatus: (id: string) => void;
  publishQuestion: (id: string) => void;
}

export const useQuestionStore = create<QuestionStore>((set) => ({
  questions: defaultQuestions,
  addQuestion: (q) =>
    set((state) => ({
      questions: [...state.questions, { ...q, id: `q-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    })),
  addQuestions: (qs) =>
    set((state) => ({
      questions: [
        ...state.questions,
        ...qs.map((q, i) => ({
          ...q,
          id: `q-${Date.now()}-${i}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      ],
    })),
  updateQuestion: (id, updates) =>
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === id ? { ...q, ...updates, updated_at: new Date().toISOString() } : q
      ),
    })),
  toggleQuestionStatus: (id) =>
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === id
          ? { ...q, status: q.status === 'disabled' ? 'draft' : 'disabled', updated_at: new Date().toISOString() }
          : q
      ),
    })),
  publishQuestion: (id) =>
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === id ? { ...q, status: 'published', updated_at: new Date().toISOString() } : q
      ),
    })),
}));

export const competencyLevels: CompetencyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
export const questionTypes: QuestionType[] = ['scenario', 'coding', 'mcq'];

export const competencyLabels: Record<CompetencyLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

export const questionTypeLabels: Record<QuestionType, string> = {
  scenario: 'Scenario',
  coding: 'Coding',
  mcq: 'MCQ',
};
