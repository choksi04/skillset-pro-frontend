import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

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

interface SkillStore {
  categories: SkillCategory[];
  skills: Skill[];
  loading: boolean;
  initialized: boolean;
  fetchSkills: () => Promise<void>;
  addCategory: (cat: Omit<SkillCategory, 'id' | 'created_at'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<SkillCategory>) => Promise<void>;
  toggleCategoryStatus: (id: string) => Promise<void>;
  addSkill: (skill: Omit<Skill, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateSkill: (id: string, updates: Partial<Skill>) => Promise<void>;
  toggleSkillStatus: (id: string) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  categories: [],
  skills: [],
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

  addCategory: async (cat) => {
    const id = `cat-${Date.now()}`;
    const { error } = await supabase.from('skill_categories').insert({
      id, name: cat.name, description: cat.description || '', tenant_id: cat.tenant_id, status: cat.status || 'active',
    });
    if (error) { console.error('Failed to add category:', error); return; }
    set((state) => ({ categories: [...state.categories, { ...cat, id, created_at: new Date().toISOString() }] }));
  },

  updateCategory: async (id, updates) => {
    const { error } = await supabase.from('skill_categories').update({
      ...updates, modified_at: new Date().toISOString(),
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
    const { data, error } = await supabase.from('skills').insert({
      id, skill_name: skill.skill_name, skill_description: skill.skill_description,
      skill_category: skill.skill_category, tags: skill.tags || [], status: skill.status,
      tenant_id: skill.tenant_id,
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
    const { error } = await supabase.from('skills').update({
      ...updates, updated_at: new Date().toISOString(),
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

  deleteSkill: async (id) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from('skills').update({ deleted_on: now, deleted_by: 'current-user' }).eq('id', id);
    if (error) { console.error('Failed to delete skill:', error); return; }
    set((state) => ({ skills: state.skills.filter((s) => s.id !== id) }));
  },

  deleteCategory: async (id) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from('skill_categories').update({ deleted_on: now, deleted_by: 'current-user' }).eq('id', id);
    if (error) { console.error('Failed to delete category:', error); return; }
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
  },
}));
