import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';

export interface AssessmentConfig {
  id: string;
  tenant_id: string;
  config_type: string;
  reference_id: string | null;
  question_type: string;
  min_questions: number;
  max_questions: number;
}

interface AssessmentConfigStore {
  configs: AssessmentConfig[];
  loading: boolean;
  initialized: boolean;
  fetchConfigs: () => Promise<void>;
  updateConfig: (id: string, updates: Partial<AssessmentConfig>) => Promise<void>;
}

export const useAssessmentConfigStore = create<AssessmentConfigStore>((set, get) => ({
  configs: [],
  loading: false,
  initialized: false,

  fetchConfigs: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('assessment_config')
        .select('*')
        .order('question_type');
      if (error) throw error;
      const configs: AssessmentConfig[] = (data || []).map((c: any) => ({
        id: c.id,
        tenant_id: c.tenant_id,
        config_type: c.config_type,
        reference_id: c.reference_id,
        question_type: c.question_type,
        min_questions: c.min_questions,
        max_questions: c.max_questions,
      }));
      set({ configs, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch assessment configs:', err);
      set({ loading: false, initialized: true });
    }
  },

  updateConfig: async (id, updates) => {
    const userId = getCurrentUserId();
    const { error } = await supabase.from('assessment_config').update({
      ...updates,
      modified_at: new Date().toISOString(),
      modified_by: userId,
    }).eq('id', id);
    if (error) {
      console.error('Failed to update assessment config:', error);
      return;
    }
    set((state) => ({
      configs: state.configs.map((c) => c.id === id ? { ...c, ...updates } : c),
    }));
  },
}));

/** Get global config for a specific question type */
export function getGlobalConfig(configs: AssessmentConfig[], questionType: string): AssessmentConfig | undefined {
  return configs.find(c => c.config_type === 'global' && c.question_type === questionType);
}

/** Get min/max for a question type, with defaults */
export function getQuestionLimits(configs: AssessmentConfig[], questionType: string): { min: number; max: number } {
  const config = getGlobalConfig(configs, questionType);
  return {
    min: config?.min_questions ?? 2,
    max: config?.max_questions ?? 6,
  };
}
