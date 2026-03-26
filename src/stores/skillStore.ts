import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';
import { toast } from 'sonner';

export interface SkillCategory {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  status: 'active' | 'disabled';
  created_at?: string;
}

export interface Skill {
  id: string;
  tenant_id: string;
  skill_name: string;
  skill_description: string;
  skill_category: string;
  tags: string[];
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface SkillTopic {
  id: string;
  skill_id: string;
  tenant_id: string;
  name: string;
  description: string;
  status: 'active' | 'disabled';
  created_at?: string;
}

interface SkillStore {
  categories: SkillCategory[];
  skills: Skill[];
  topics: Record<string, SkillTopic[]>; // keyed by skill_id
  loading: boolean;
  initialized: boolean;
  fetchSkills: () => Promise<void>;
  fetchTopicsForSkill: (skillId: string) => Promise<void>;
  addCategory: (cat: Omit<SkillCategory, 'id' | 'created_at'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<SkillCategory>) => Promise<void>;
  toggleCategoryStatus: (id: string) => Promise<void>;
  addSkill: (skill: Omit<Skill, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateSkill: (id: string, updates: Partial<Skill>) => Promise<void>;
  toggleSkillStatus: (id: string) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addTopic: (topic: Omit<SkillTopic, 'id' | 'created_at'>) => Promise<void>;
  updateTopic: (id: string, updates: Partial<SkillTopic>) => Promise<void>;
  deleteTopic: (id: string, skillId: string) => Promise<void>;
  checkSkillDeletable: (id: string) => Promise<{ deletable: boolean; reason?: string }>;
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  categories: [],
  skills: [],
  topics: {},
  loading: false,
  initialized: false,

  fetchSkills: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const [skillsRes, catsRes] = await Promise.all([
        supabase.from('skills').select('*').is('deleted_on', null).order('created_at'),
        supabase.from('skill_categories').select('*').is('deleted_on', null),
      ]);
      if (skillsRes.error) throw skillsRes.error;
      if (catsRes.error) throw catsRes.error;

      const skills: Skill[] = (skillsRes.data || []).map((s: any) => ({
        id: s.id,
        tenant_id: s.tenant_id,
        skill_name: s.skill_name,
        skill_description: s.skill_description || '',
        skill_category: s.skill_category || '',
        tags: s.tags || [],
        status: s.status as 'active' | 'disabled',
        created_at: s.created_at,
        updated_at: s.updated_at,
      }));
      const categories: SkillCategory[] = (catsRes.data || []).map((c: any) => ({
        id: c.id,
        tenant_id: c.tenant_id || 'tenant-001',
        name: c.name,
        description: c.description,
        status: (c.status || 'active') as 'active' | 'disabled',
        created_at: c.created_at,
      }));
      set({ skills, categories, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch skills:', err);
      set({ loading: false, initialized: true });
    }
  },

  fetchTopicsForSkill: async (skillId: string) => {
    try {
      const { data, error } = await supabase
        .from('skill_topics')
        .select('*')
        .eq('skill_id', skillId)
        .is('deleted_on', null)
        .order('created_at');
      if (error) throw error;
      const topics: SkillTopic[] = (data || []).map((t: any) => ({
        id: t.id,
        skill_id: t.skill_id,
        tenant_id: t.tenant_id,
        name: t.name,
        description: t.description || '',
        status: (t.status || 'active') as 'active' | 'disabled',
        created_at: t.created_at,
      }));
      set((state) => ({
        topics: { ...state.topics, [skillId]: topics },
      }));
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    }
  },

  addCategory: async (cat) => {
    const id = `cat-${Date.now()}`;
    const userId = getCurrentUserId();
    const { error } = await supabase.from('skill_categories').insert({
      id, name: cat.name, description: cat.description || '', tenant_id: cat.tenant_id, status: cat.status || 'active',
      created_by: userId,
    });
    if (error) { console.error('Failed to add category:', error); return; }
    set((state) => ({ categories: [...state.categories, { ...cat, id, created_at: new Date().toISOString() }] }));
  },

  updateCategory: async (id, updates) => {
    const userId = getCurrentUserId();
    const { error } = await supabase.from('skill_categories').update({
      ...updates, modified_at: new Date().toISOString(), modified_by: userId,
    }).eq('id', id);
    if (error) { console.error('Failed to update category:', error); return; }
    set((state) => ({
      categories: state.categories.map((c) => c.id === id ? { ...c, ...updates } : c),
    }));
  },

  toggleCategoryStatus: async (id) => {
    const cat = get().categories.find((c) => c.id === id);
    if (!cat) return;
    const newStatus = cat.status === 'active' ? 'disabled' : 'active';
    await get().updateCategory(id, { status: newStatus });
  },

  addSkill: async (skill) => {
    const id = `skill-${Date.now()}`;
    const userId = getCurrentUserId();
    const { data, error } = await supabase.from('skills').insert({
      id, skill_name: skill.skill_name, skill_description: skill.skill_description,
      skill_category: skill.skill_category, tags: skill.tags || [], status: skill.status,
      tenant_id: skill.tenant_id, created_by: userId,
    }).select().single();
    if (error) { console.error('Failed to add skill:', error); return; }
    set((state) => ({
      skills: [...state.skills, {
        ...skill, id, tags: skill.tags || [],
        created_at: (data as any).created_at, updated_at: (data as any).updated_at,
      }],
    }));
  },

  updateSkill: async (id, updates) => {
    const userId = getCurrentUserId();
    const { error } = await supabase.from('skills').update({
      ...updates, updated_at: new Date().toISOString(), modified_by: userId, modified_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { console.error('Failed to update skill:', error); return; }
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s
      ),
    }));
  },

  toggleSkillStatus: async (id) => {
    const skill = get().skills.find((s) => s.id === id);
    if (!skill) return;
    const newStatus = skill.status === 'active' ? 'disabled' : 'active';
    await get().updateSkill(id, { status: newStatus });
  },

  checkSkillDeletable: async (id: string) => {
    // Check domain mappings
    const { data: mappings } = await supabase
      .from('domain_skill_mappings')
      .select('id')
      .eq('skill_id', id)
      .is('deleted_on', null)
      .limit(1);
    if (mappings && mappings.length > 0) {
      return { deletable: false, reason: 'This skill is mapped to a domain. Remove the mapping first.' };
    }
    // Check questions
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .eq('skill_id', id)
      .is('deleted_on', null)
      .limit(1);
    if (questions && questions.length > 0) {
      return { deletable: false, reason: 'This skill has questions in the question bank. Remove them first.' };
    }
    // Check registry usage
    const { data: ratings } = await supabase
      .from('skill_self_ratings')
      .select('id')
      .eq('skill_id', id)
      .limit(1);
    if (ratings && ratings.length > 0) {
      return { deletable: false, reason: 'This skill is used in skill registry submissions.' };
    }
    return { deletable: true };
  },

  deleteSkill: async (id) => {
    const check = await get().checkSkillDeletable(id);
    if (!check.deletable) {
      toast.error(check.reason);
      return;
    }
    const now = new Date().toISOString();
    const userId = getCurrentUserId();
    const { error } = await supabase.from('skills').update({ deleted_on: now, deleted_by: userId }).eq('id', id);
    if (error) { console.error('Failed to delete skill:', error); return; }
    set((state) => ({ skills: state.skills.filter((s) => s.id !== id) }));
  },

  deleteCategory: async (id) => {
    const cat = get().categories.find((c) => c.id === id);
    if (cat) {
      const skillsInCat = get().skills.filter((s) => s.skill_category === cat.name);
      if (skillsInCat.length > 0) {
        toast.error(`Cannot delete category with ${skillsInCat.length} skill(s). Remove or reassign them first.`);
        return;
      }
    }
    const now = new Date().toISOString();
    const userId = getCurrentUserId();
    const { error } = await supabase.from('skill_categories').update({ deleted_on: now, deleted_by: userId }).eq('id', id);
    if (error) { console.error('Failed to delete category:', error); return; }
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
  },

  addTopic: async (topic) => {
    const id = `topic-${Date.now()}`;
    const userId = getCurrentUserId();
    const { error } = await supabase.from('skill_topics').insert({
      id, skill_id: topic.skill_id, tenant_id: topic.tenant_id,
      name: topic.name, description: topic.description || '', status: topic.status || 'active',
      created_by: userId,
    });
    if (error) { console.error('Failed to add topic:', error); return; }
    const newTopic: SkillTopic = { ...topic, id, created_at: new Date().toISOString() };
    set((state) => ({
      topics: {
        ...state.topics,
        [topic.skill_id]: [...(state.topics[topic.skill_id] || []), newTopic],
      },
    }));
  },

  updateTopic: async (id, updates) => {
    const userId = getCurrentUserId();
    const { error } = await supabase.from('skill_topics').update({
      ...updates, modified_at: new Date().toISOString(), modified_by: userId,
    }).eq('id', id);
    if (error) { console.error('Failed to update topic:', error); return; }
    set((state) => {
      const newTopics = { ...state.topics };
      for (const skillId of Object.keys(newTopics)) {
        newTopics[skillId] = newTopics[skillId].map((t) =>
          t.id === id ? { ...t, ...updates } : t
        );
      }
      return { topics: newTopics };
    });
  },

  deleteTopic: async (id, skillId) => {
    const now = new Date().toISOString();
    const userId = getCurrentUserId();
    const { error } = await supabase.from('skill_topics').update({ deleted_on: now, deleted_by: userId }).eq('id', id);
    if (error) { console.error('Failed to delete topic:', error); return; }
    set((state) => ({
      topics: {
        ...state.topics,
        [skillId]: (state.topics[skillId] || []).filter((t) => t.id !== id),
      },
    }));
  },
}));
