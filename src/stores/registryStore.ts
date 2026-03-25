import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';

export type RatingLevel = 1 | 2 | 3 | 4 | 5;

export const ratingLabels: Record<RatingLevel, string> = {
  1: 'Basic Awareness', 2: 'Working Knowledge', 3: 'Independent Contributor', 4: 'Advanced', 5: 'Expert',
};

export const ratingDescriptions: Record<RatingLevel, string> = {
  1: 'Aware of concepts but needs guidance for most tasks',
  2: 'Can perform basic tasks with some supervision',
  3: 'Works independently on standard tasks and problems',
  4: 'Handles complex scenarios and mentors others',
  5: 'Deep expertise, drives best practices and innovation',
};

export interface SkillSelfRating {
  skill_id: string;
  rating: RatingLevel;
}

export interface SkillRegistrySubmission {
  id: string;
  tenant_id: string;
  employee_id: string;
  domain_id: string;
  cycle: string;
  ratings: SkillSelfRating[];
  status: 'draft' | 'submitted' | 'assessment_generated';
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDomainAssignment {
  employee_id: string;
  domain_id: string;
  tenant_id: string;
}

interface RegistryStore {
  submissions: SkillRegistrySubmission[];
  assignments: EmployeeDomainAssignment[];
  currentCycle: string;
  loading: boolean;
  initialized: boolean;
  fetchRegistry: () => Promise<void>;
  getSubmission: (employeeId: string, cycle: string) => SkillRegistrySubmission | undefined;
  createOrUpdateDraft: (employeeId: string, tenantId: string, domainId: string, ratings: SkillSelfRating[]) => Promise<void>;
  submitRegistry: (submissionId: string) => Promise<void>;
  markAssessmentGenerated: (submissionId: string) => Promise<void>;
  assignEmployeeToDomain: (employeeId: string, domainId: string, tenantId: string) => Promise<void>;
}

export const useRegistryStore = create<RegistryStore>((set, get) => ({
  submissions: [],
  assignments: [],
  currentCycle: '2026-Q1',
  loading: false,
  initialized: false,

  fetchRegistry: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const [subsRes, assignRes] = await Promise.all([
        supabase.from('skill_registry_submissions').select('*').is('deleted_on', null).order('created_at', { ascending: false }),
        supabase.from('employee_domain_assignments').select('*'),
      ]);
      if (subsRes.error) throw subsRes.error;
      if (assignRes.error) throw assignRes.error;

      const subIds = (subsRes.data || []).map((s: any) => s.id);
      let ratingsData: any[] = [];
      if (subIds.length > 0) {
        const { data, error } = await supabase.from('skill_self_ratings').select('*').in('submission_id', subIds);
        if (error) throw error;
        ratingsData = data || [];
      }

      const submissions: SkillRegistrySubmission[] = (subsRes.data || []).map((s: any) => ({
        id: s.id, tenant_id: s.tenant_id, employee_id: s.employee_id, domain_id: s.domain_id,
        cycle: s.cycle, status: s.status as any,
        ratings: ratingsData.filter((r: any) => r.submission_id === s.id).map((r: any) => ({
          skill_id: r.skill_id, rating: r.rating as RatingLevel,
        })),
        submitted_at: s.submitted_at, created_at: s.created_at, updated_at: s.updated_at,
      }));

      const assignments: EmployeeDomainAssignment[] = (assignRes.data || []).map((a: any) => ({
        employee_id: a.employee_id, domain_id: a.domain_id, tenant_id: a.tenant_id,
      }));

      set({ submissions, assignments, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch registry:', err);
      set({ loading: false, initialized: true });
    }
  },

  getSubmission: (employeeId, cycle) =>
    get().submissions.find((s) => s.employee_id === employeeId && s.cycle === cycle),

  createOrUpdateDraft: async (employeeId, tenantId, domainId, ratings) => {
    const state = get();
    const userId = getCurrentUserId();
    const existing = state.submissions.find(
      (s) => s.employee_id === employeeId && s.cycle === state.currentCycle
    );
    if (existing && existing.status !== 'draft') return;

    if (existing) {
      await supabase.from('skill_registry_submissions').update({
        domain_id: domainId, updated_at: new Date().toISOString(), modified_by: userId, modified_at: new Date().toISOString(),
      }).eq('id', existing.id);

      await supabase.from('skill_self_ratings').delete().eq('submission_id', existing.id);
      if (ratings.length > 0) {
        await supabase.from('skill_self_ratings').insert(
          ratings.map((r) => ({ submission_id: existing.id, skill_id: r.skill_id, rating: r.rating }))
        );
      }

      set((state) => ({
        submissions: state.submissions.map((s) =>
          s.id === existing.id ? { ...s, ratings, domain_id: domainId, updated_at: new Date().toISOString() } : s
        ),
      }));
    } else {
      const id = `sub-${Date.now()}`;
      const { error } = await supabase.from('skill_registry_submissions').insert({
        id, tenant_id: tenantId, employee_id: employeeId, domain_id: domainId,
        cycle: state.currentCycle, status: 'draft', created_by: userId,
      });
      if (error) { console.error('Failed to create submission:', error); return; }

      if (ratings.length > 0) {
        await supabase.from('skill_self_ratings').insert(
          ratings.map((r) => ({ submission_id: id, skill_id: r.skill_id, rating: r.rating }))
        );
      }

      const newSub: SkillRegistrySubmission = {
        id, tenant_id: tenantId, employee_id: employeeId, domain_id: domainId,
        cycle: state.currentCycle, ratings, status: 'draft',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      set((state) => ({ submissions: [...state.submissions, newSub] }));
    }
  },

  submitRegistry: async (submissionId) => {
    const now = new Date().toISOString();
    const userId = getCurrentUserId();
    await supabase.from('skill_registry_submissions').update({
      status: 'submitted', submitted_at: now, updated_at: now, modified_by: userId, modified_at: now,
    }).eq('id', submissionId);

    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === submissionId && s.status === 'draft'
          ? { ...s, status: 'submitted' as const, submitted_at: now, updated_at: now }
          : s
      ),
    }));
  },

  markAssessmentGenerated: async (submissionId) => {
    const now = new Date().toISOString();
    const userId = getCurrentUserId();
    await supabase.from('skill_registry_submissions').update({
      status: 'assessment_generated', updated_at: now, modified_by: userId, modified_at: now,
    }).eq('id', submissionId);

    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === submissionId ? { ...s, status: 'assessment_generated' as const, updated_at: now } : s
      ),
    }));
  },

  assignEmployeeToDomain: async (employeeId, domainId, tenantId) => {
    const exists = get().assignments.find((a) => a.employee_id === employeeId && a.domain_id === domainId);
    if (exists) return;

    const userId = getCurrentUserId();
    const { error } = await supabase.from('employee_domain_assignments').insert({
      employee_id: employeeId, domain_id: domainId, tenant_id: tenantId, created_by: userId,
    });
    if (error) { console.error('Failed to assign domain:', error); return; }

    set((state) => ({
      assignments: [...state.assignments, { employee_id: employeeId, domain_id: domainId, tenant_id: tenantId }],
    }));
  },
}));
