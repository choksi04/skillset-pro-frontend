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

export interface QuestionCounts {
  total: number;
  published: number;
  draft: number;
  disabled: number;
  aiGenerated: number;
}

export interface QuestionPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  skillId?: string;
  skillIds?: string[];
  levelId?: string;
  questionType?: QuestionType | 'all';
  status?: QuestionStatus | 'all';
  source?: 'all' | 'ai' | 'manual';
  sortOrder?: 'recent' | 'oldest';
  excludeIds?: string[];
}

export interface QuestionPageResult {
  questions: Question[];
  total: number;
}

interface QuestionStore {
  questions: Question[];
  counts: QuestionCounts;
  loading: boolean;
  initialized: boolean;
  /** Full preload (~all rows, paginated). Prefer scoped fetchers below. */
  fetchQuestions: () => Promise<void>;
  /** Runs fetchQuestions() only if not yet initialized. Cheap on repeat. */
  ensureQuestionsLoaded: () => Promise<void>;
  /** Scoped fetch by question IDs — merges into store, returns rows. */
  fetchQuestionsByIds: (ids: string[]) => Promise<Question[]>;
  fetchQuestionPage: (params?: QuestionPageParams) => Promise<QuestionPageResult>;
  fetchQuestionCounts: (options?: { force?: boolean }) => Promise<void>;
  addQuestion: (q: Omit<Question, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  addQuestions: (qs: Omit<Question, 'id' | 'created_at' | 'updated_at'>[]) => Promise<void>;
  updateQuestion: (id: string, updates: Partial<Question>) => Promise<void>;
  toggleQuestionStatus: (id: string) => Promise<void>;
  publishQuestion: (id: string) => Promise<void>;
  bulkPublish: (ids: string[]) => Promise<number>;
  deleteQuestion: (id: string) => Promise<{ success: boolean; error?: string }>;
  checkQuestionUsage: (id: string) => Promise<boolean>;
}


const BATCH_SIZE = 1000;
const QUESTION_SELECT = 'id, tenant_id, skill_id, topic_id, competency_level, question_type, question_text, evaluation_guidelines, status, ai_generated, created_at, updated_at';
const QUESTION_COUNTS_TTL_MS = 60_000;

let fetchQuestionsInFlight: Promise<void> | null = null;
let fetchQuestionCountsInFlight: Promise<void> | null = null;
let questionCountsFetchedAt = 0;

function mapQuestionRow(q: any): Question {
  return {
    id: q.id, tenant_id: q.tenant_id, skill_id: q.skill_id,
    topic_id: q.topic_id || null,
    competency_level: q.competency_level as CompetencyLevel,
    question_type: q.question_type as QuestionType,
    question_text: q.question_text, evaluation_guidelines: q.evaluation_guidelines || '',
    status: q.status as QuestionStatus, ai_generated: q.ai_generated,
    created_at: q.created_at, updated_at: q.updated_at,
  };
}


export const useQuestionStore = create<QuestionStore>((set, get) => ({
  questions: [],
  counts: { total: 0, published: 0, draft: 0, disabled: 0, aiGenerated: 0 },
  loading: false,
  initialized: false,

  fetchQuestionCounts: async (options = {}) => {
    const { force = false } = options;
    if (!force && Date.now() - questionCountsFetchedAt < QUESTION_COUNTS_TTL_MS) return;
    if (!force && fetchQuestionCountsInFlight) return fetchQuestionCountsInFlight;

    fetchQuestionCountsInFlight = (async () => {
      try {
      const { data, error } = await supabase.rpc('get_question_counts');
      if (error) throw error;
      if (data) {
        const d = data as any;
        set({
          counts: {
            total: d.total ?? 0,
            published: d.published ?? 0,
            draft: d.draft ?? 0,
            disabled: d.disabled ?? 0,
            aiGenerated: d.ai_generated ?? 0,
          },
        });
        questionCountsFetchedAt = Date.now();
      }
      } catch (err) {
        console.error('Failed to fetch question counts:', err);
      } finally {
        fetchQuestionCountsInFlight = null;
      }
    })();

    return fetchQuestionCountsInFlight;
  },

  fetchQuestionPage: async (params = {}) => {
    const {
      page = 1,
      pageSize = 50,
      search = '',
      skillId = 'all',
      skillIds,
      levelId = 'all',
      questionType = 'all',
      status = 'all',
      source = 'all',
      sortOrder = 'recent',
      excludeIds = [],
    } = params;
    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize - 1;

    let query = supabase
      .from('questions')
      .select(QUESTION_SELECT, { count: 'exact' })
      .is('deleted_on', null);

    const term = search.trim();
    if (term) query = query.ilike('question_text', `%${term.replace(/[%_]/g, '\\$&')}%`);
    if (skillId !== 'all') query = query.eq('skill_id', skillId);
    if (skillIds && skillIds.length > 0) query = query.in('skill_id', skillIds);
    if (levelId !== 'all') query = query.eq('competency_level', levelId);
    if (questionType !== 'all') query = query.eq('question_type', questionType);
    if (status !== 'all') query = query.eq('status', status);
    if (source === 'ai') query = query.eq('ai_generated', true);
    if (source === 'manual') query = query.eq('ai_generated', false);
    if (excludeIds.length > 0) query = query.not('id', 'in', `(${excludeIds.join(',')})`);

    const { data, error, count } = await query
      .order('created_at', { ascending: sortOrder === 'oldest' })
      .range(from, to);

    if (error) {
      console.error('Failed to fetch question page:', error);
      return { questions: [], total: 0 };
    }

    const rows = (data || []).map(mapQuestionRow);
    set((state) => {
      const map = new Map(state.questions.map((q) => [q.id, q]));
      for (const q of rows) map.set(q.id, q);
      return { questions: Array.from(map.values()) };
    });
    return { questions: rows, total: count ?? rows.length };
  },

  fetchQuestions: async () => {
    const state = get();
    if (state.initialized) return;
    if (fetchQuestionsInFlight) return fetchQuestionsInFlight;

    fetchQuestionsInFlight = (async () => {
      set({ loading: true });
      try {
      const allRows: any[] = [];
      let offset = 0;
      let keepFetching = true;

      while (keepFetching) {
        const { data, error } = await supabase
          .from('questions')
          .select(QUESTION_SELECT)
          .is('deleted_on', null)
          .order('created_at')
          .range(offset, offset + BATCH_SIZE - 1);
        if (error) throw error;
        const rows = data || [];
        allRows.push(...rows);
        if (rows.length < BATCH_SIZE) {
          keepFetching = false;
        } else {
          offset += BATCH_SIZE;
        }
      }

      const questions: Question[] = allRows.map(mapQuestionRow);
      set({ questions, loading: false, initialized: true });
      } catch (err) {
        console.error('Failed to fetch questions:', err);
        set({ loading: false, initialized: true });
      } finally {
        fetchQuestionsInFlight = null;
      }
    })();

    return fetchQuestionsInFlight;
  },

  /** Only preload the full list if we haven't already. In-flight-safe. */
  ensureQuestionsLoaded: async () => {
    const state = get();
    if (state.initialized || state.loading) return;
    await state.fetchQuestions();
  },

  /**
   * Scoped fetch by IDs — used by detail pages/runners that only care about
   * the ~4–10 questions in one assessment. Chunked to stay under URL limits.
   * Merges into state.questions (dedupe) so lookups keep working.
   */
  fetchQuestionsByIds: async (ids) => {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return [];
    const CHUNK = 200;
    const collected: any[] = [];
    try {
      for (let i = 0; i < uniqueIds.length; i += CHUNK) {
        const slice = uniqueIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('questions')
          .select(QUESTION_SELECT)
          .in('id', slice)
          .is('deleted_on', null);
        if (error) throw error;
        collected.push(...(data || []));
      }
    } catch (err) {
      console.error('Failed to fetch questions by ids:', err);
      return [];
    }
    const rows: Question[] = collected.map(mapQuestionRow);
    set((state) => {
      const map = new Map(state.questions.map((q) => [q.id, q]));
      for (const q of rows) map.set(q.id, q);
      return { questions: Array.from(map.values()) };
    });
    return rows;
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
    // Refresh counts
    get().fetchQuestionCounts({ force: true });
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
    // Refresh counts
    get().fetchQuestionCounts({ force: true });
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
    // Refresh counts if status changed
    if (updates.status) get().fetchQuestionCounts({ force: true });
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

  bulkPublish: async (ids) => {
    if (ids.length === 0) return 0;
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await supabase.from('questions').update({
      status: 'published', updated_at: now, modified_by: userId, modified_at: now,
    }).in('id', ids);
    if (error) { console.error('Failed to bulk publish:', error); return 0; }
    set((state) => ({
      questions: state.questions.map((q) =>
        ids.includes(q.id) ? { ...q, status: 'published' as const, updated_at: now } : q
      ),
    }));
    // Refresh counts
    get().fetchQuestionCounts({ force: true });
    return ids.length;
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
    // Refresh counts
    get().fetchQuestionCounts({ force: true });
    return { success: true };
  },
}));

export const questionTypes: QuestionType[] = ['scenario', 'coding', 'mcq'];

export const questionTypeLabels: Record<QuestionType, string> = {
  scenario: 'Scenario', coding: 'Coding', mcq: 'MCQ',
};
