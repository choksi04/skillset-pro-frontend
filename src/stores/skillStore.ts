import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface SkillCategory {
  id: string;
  name: string;
  description?: string;
}

export interface Skill {
  id: string;
  tenant_id: string;
  skill_name: string;
  skill_description: string;
  skill_category: string;
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
  addCategory: (cat: Omit<SkillCategory, 'id'>) => Promise<void>;
  addSkill: (skill: Omit<Skill, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateSkill: (id: string, updates: Partial<Skill>) => Promise<void>;
  toggleSkillStatus: (id: string) => Promise<void>;
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
        supabase.from('skill_categories').select('*'),
      ]);
      if (skillsRes.error) throw skillsRes.error;
      if (catsRes.error) throw catsRes.error;

      const skills: Skill[] = (skillsRes.data || []).map((s: any) => ({
        id: s.id, tenant_id: s.tenant_id, skill_name: s.skill_name,
        skill_description: s.skill_description || '', skill_category: s.skill_category || '',
        status: s.status as 'active' | 'disabled', created_at: s.created_at, updated_at: s.updated_at,
      }));
      const categories: SkillCategory[] = (catsRes.data || []).map((c: any) => ({
        id: c.id, name: c.name, description: c.description,
      }));
      set({ skills, categories, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch skills:', err);
      set({ loading: false, initialized: true });
    }
  },

  addCategory: async (cat) => {
    const id = `cat-${Date.now()}`;
    const { error } = await supabase.from('skill_categories').insert({ id, ...cat });
    if (error) { console.error('Failed to add category:', error); return; }
    set((state) => ({ categories: [...state.categories, { ...cat, id }] }));
  },

  addSkill: async (skill) => {
    const id = `skill-${Date.now()}`;
    const { data, error } = await supabase.from('skills').insert({ id, ...skill }).select().single();
    if (error) { console.error('Failed to add skill:', error); return; }
    set((state) => ({
      skills: [...state.skills, {
        ...skill, id, created_at: (data as any).created_at, updated_at: (data as any).updated_at,
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
}));
