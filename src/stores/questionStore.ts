import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';

export type CompetencyLevel = string;
export type QuestionType = 'scenario' | 'coding' | 'mcq';
export type QuestionStatus = 'draft' | 'published' | 'disabled';

export interface Question {
  id: string;
  tenant_id: string;
  skill_id: string;
  topic_id: string | null;
  competency_level: CompetencyLevel;
  question_type: QuestionType;
  question_text: string;
  evaluation_guidelines: string;
  status: QuestionStatus;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionSetting {
  id: string;
  tenant_id: string;
  level: number;
  name: string;
  label: string;
  description: string;
  score_range_min: number;
  score_range_max: number;
  min_questions: number;
  status: string;
}

interface QuestionStore {
  questions: Question[];
  settings: QuestionSetting[];
  loading: boolean;
  initialized: boolean;
  settingsLoaded: boolean;
  fetchQuestions: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSetting: (id: string, updates: Partial<QuestionSetting>) => Promise<void>;
  addQuestion: (q: Omit<Question, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  addQuestions: (qs: Omit<Question, 'id' | 'created_at' | 'updated_at'>[]) => Promise<void>;
  updateQuestion: (id: string, updates: Partial<Question>) => Promise<void>;
  toggleQuestionStatus: (id: string) => Promise<void>;
  publishQuestion: (id: string) => Promise<void>;
  bulkPublish: (ids: string[]) => Promise<number>;
  deleteQuestion: (id: string) => Promise<{ success: boolean; error?: string }>;
  checkQuestionUsage: (id: string) => Promise<boolean>;
}

export const useQuestionStore = create<QuestionStore>((set, get) => ({
  questions: [],
  settings: [],
  loading: false,
  initialized: false,
  settingsLoaded: false,

  fetchQuestions: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .is('deleted_on', null)
        .order('created_at');
      if (error) throw error;

      const questions: Question[] = (data || []).map((q: any) => ({
        id: q.id, tenant_id: q.tenant_id, skill_id: q.skill_id,
        topic_id: q.topic_id || null,
        competency_level: q.competency_level as CompetencyLevel,
        question_type: q.question_type as QuestionType,
        question_text: q.question_text, evaluation_guidelines: q.evaluation_guidelines || '',
        status: q.status as QuestionStatus, ai_generated: q.ai_generated,
        created_at: q.created_at, updated_at: q.updated_at,
      }));
      set({ questions, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      set({ loading: false, initialized: true });
    }
  },

  fetchSettings: async () => {
    try {
      const { data, error } = await supabase
        .from('question_settings')
        .select('*')
        .order('level');
      if (error) throw error;
      const settings: QuestionSetting[] = (data || []).map((s: any) => ({
        id: s.id, tenant_id: s.tenant_id, level: s.level,
        name: s.name, label: s.label, description: s.description || '',
        score_range_min: s.score_range_min, score_range_max: s.score_range_max,
        min_questions: s.min_questions, status: s.status,
      }));
      set({ settings, settingsLoaded: true });
    } catch (err) {
      console.error('Failed to fetch question settings:', err);
    }
  },

  updateSetting: async (id, updates) => {
    const userId = getCurrentUserId();
    const { error } = await supabase.from('question_settings').update({
      ...updates, modified_at: new Date().toISOString(), modified_by: userId,
    }).eq('id', id);
    if (error) { console.error('Failed to update setting:', error); return; }
    set((state) => ({
      settings: state.settings.map((s) => s.id === id ? { ...s, ...updates } : s),
    }));
  },

  addQuestion: async (q) => {
    const id = `q-${Date.now()}`;
    const userId = getCurrentUserId();
    const { data, error } = await supabase.from('questions').insert({
      id, ...q, topic_id: q.topic_id || null, created_by: userId,
    }).select().single();
    if (error) { console.error('Failed to add question:', error); return; }
    set((state) => ({
      questions: [...state.questions, {
        ...q, id, created_at: (data as any).created_at, updated_at: (data as any).updated_at,
      }],
    }));
  },

  addQuestions: async (qs) => {
    const userId = getCurrentUserId();
    const rows = qs.map((q, i) => ({
      ...q, id: `q-${Date.now()}-${i}`, topic_id: q.topic_id || null, created_by: userId,
    }));
    const { data, error } = await supabase.from('questions').insert(rows).select();
    if (error) { console.error('Failed to add questions:', error); return; }
    const newQuestions: Question[] = (data || []).map((d: any) => ({
      id: d.id, tenant_id: d.tenant_id, skill_id: d.skill_id,
      topic_id: d.topic_id || null,
      competency_level: d.competency_level as CompetencyLevel,
      question_type: d.question_type as QuestionType,
      question_text: d.question_text, evaluation_guidelines: d.evaluation_guidelines || '',
      status: d.status as QuestionStatus, ai_generated: d.ai_generated,
      created_at: d.created_at, updated_at: d.updated_at,
    }));
    set((state) => ({ questions: [...state.questions, ...newQuestions] }));
  },

  updateQuestion: async (id, updates) => {
    const userId = getCurrentUserId();
    const { error } = await supabase.from('questions').update({
      ...updates, updated_at: new Date().toISOString(), modified_by: userId, modified_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { console.error('Failed to update question:', error); return; }
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === id ? { ...q, ...updates, updated_at: new Date().toISOString() } : q
      ),
    }));
  },

  toggleQuestionStatus: async (id) => {
    const q = get().questions.find((q) => q.id === id);
    if (!q) return;
    const newStatus = q.status === 'disabled' ? 'draft' : 'disabled';
    await get().updateQuestion(id, { status: newStatus });
  },

  publishQuestion: async (id) => {
    await get().updateQuestion(id, { status: 'published' });
  },

  checkQuestionUsage: async (id) => {
    const { data } = await supabase
      .from('assessment_questions')
      .select('id')
      .eq('question_id', id)
      .is('deleted_on', null)
      .limit(1);
    return (data && data.length > 0) || false;
  },

  deleteQuestion: async (id) => {
    const isUsed = await get().checkQuestionUsage(id);
    if (isUsed) {
      return { success: false, error: 'This question is used in one or more assessments and cannot be deleted.' };
    }
    const userId = getCurrentUserId();
    const { error } = await supabase.from('questions').update({
      deleted_on: new Date().toISOString(),
      deleted_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) {
      console.error('Failed to delete question:', error);
      return { success: false, error: 'Failed to delete question.' };
    }
    set((state) => ({
      questions: state.questions.filter((q) => q.id !== id),
    }));
    return { success: true };
  },
}));

/** @deprecated Use getCompetencyLevels(settings) instead */
export const competencyLevels: CompetencyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert', 'master'];
export const questionTypes: QuestionType[] = ['scenario', 'coding', 'mcq'];

/** @deprecated Use getCompetencyLabelsMap(settings) instead */
export const competencyLabels: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert', master: 'Master',
};

export const questionTypeLabels: Record<QuestionType, string> = {
  scenario: 'Scenario', coding: 'Coding', mcq: 'MCQ',
};

// ─── Dynamic helpers derived from question_settings ───

export function getCompetencyLevels(settings: QuestionSetting[]): string[] {
  return settings
    .filter(s => s.status === 'active')
    .sort((a, b) => a.level - b.level)
    .map(s => s.name);
}

export function getCompetencyLabel(settings: QuestionSetting[], name: string): string {
  return settings.find(s => s.name === name)?.label || name;
}

export function getCompetencyLabelsMap(settings: QuestionSetting[]): Record<string, string> {
  return Object.fromEntries(
    settings
      .filter(s => s.status === 'active')
      .sort((a, b) => a.level - b.level)
      .map(s => [s.name, s.label])
  );
}
