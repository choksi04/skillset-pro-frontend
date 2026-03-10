import { create } from 'zustand';

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

const defaultCategories: SkillCategory[] = [
  { id: 'cat-1', name: 'Technology', description: 'Programming languages, frameworks, and tools' },
  { id: 'cat-2', name: 'Core Engineering', description: 'Fundamental engineering practices' },
  { id: 'cat-3', name: 'Architecture', description: 'System and software architecture' },
  { id: 'cat-4', name: 'PMO', description: 'Project management and operations' },
  { id: 'cat-5', name: 'Soft Skills', description: 'Communication and interpersonal skills' },
];

const defaultSkills: Skill[] = [
  { id: 'skill-1', tenant_id: 'tenant-001', skill_name: 'React', skill_description: 'Building user interfaces with React library including hooks, state management, and component patterns.', skill_category: 'Technology', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'skill-2', tenant_id: 'tenant-001', skill_name: 'Node.js', skill_description: 'Server-side JavaScript runtime for building scalable backend services and APIs.', skill_category: 'Technology', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'skill-3', tenant_id: 'tenant-001', skill_name: 'Debugging', skill_description: 'Systematic approach to identifying and resolving software defects and issues.', skill_category: 'Core Engineering', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'skill-4', tenant_id: 'tenant-001', skill_name: 'System Design', skill_description: 'Designing scalable, reliable, and maintainable software systems and architectures.', skill_category: 'Architecture', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'skill-5', tenant_id: 'tenant-001', skill_name: 'Communication', skill_description: 'Effective verbal and written communication in professional settings.', skill_category: 'Soft Skills', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'skill-6', tenant_id: 'tenant-001', skill_name: 'Problem Solving', skill_description: 'Analytical thinking and structured approaches to solving complex problems.', skill_category: 'Soft Skills', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

interface SkillStore {
  categories: SkillCategory[];
  skills: Skill[];
  addCategory: (cat: Omit<SkillCategory, 'id'>) => void;
  addSkill: (skill: Omit<Skill, 'id' | 'created_at' | 'updated_at'>) => void;
  updateSkill: (id: string, updates: Partial<Skill>) => void;
  toggleSkillStatus: (id: string) => void;
}

export const useSkillStore = create<SkillStore>((set) => ({
  categories: defaultCategories,
  skills: defaultSkills,
  addCategory: (cat) =>
    set((state) => ({
      categories: [...state.categories, { ...cat, id: `cat-${Date.now()}` }],
    })),
  addSkill: (skill) =>
    set((state) => ({
      skills: [
        ...state.skills,
        { ...skill, id: `skill-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
    })),
  updateSkill: (id, updates) =>
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s
      ),
    })),
  toggleSkillStatus: (id) =>
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id ? { ...s, status: s.status === 'active' ? 'disabled' : 'active', updated_at: new Date().toISOString() } : s
      ),
    })),
}));
