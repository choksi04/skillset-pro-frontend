import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';

export interface Domain {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  status: 'active' | 'disabled';
  domain_lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainSkillMap {
  id: string;
  domain_id: string;
  skill_id: string;
  tenant_id: string;
  skill_weight: number;
  created_at: string;
}

interface FetchOptions { force?: boolean }

interface DomainStore {
  domains: Domain[];
  mappings: DomainSkillMap[];
  loading: boolean;
  initialized: boolean;
  fetchDomains: (options?: FetchOptions) => Promise<void>;
  addDomain: (domain: Omit<Domain, 'id' | 'created_at' | 'updated_at'>) => Promise<string | undefined>;
  updateDomain: (id: string, updates: Partial<Domain>) => Promise<void>;
  toggleDomainStatus: (id: string) => Promise<void>;
  addMapping: (mapping: Omit<DomainSkillMap, 'id' | 'created_at'>) => Promise<void>;
  removeMapping: (id: string) => Promise<void>;
  getMappingsForDomain: (domainId: string) => DomainSkillMap[];
  checkDomainDeletable: (id: string) => Promise<{ deletable: boolean; reason?: string }>;
  deleteDomain: (id: string) => Promise<boolean>;
}

let fetchDomainsInFlight: Promise<void> | null = null;

export const useDomainStore = create<DomainStore>((set, get) => ({
  domains: [],
  mappings: [],
  loading: false,
  initialized: false,

  fetchDomains: async (options = {}) => {
    const { force = false } = options;
    const state = get();
    if (!force && state.initialized) return;
    if (!force && fetchDomainsInFlight) return fetchDomainsInFlight;

    fetchDomainsInFlight = (async () => {
      set({ loading: true });
      try {
      const [domainsRes, mappingsRes] = await Promise.all([
        supabase.from('domains').select('id, tenant_id, name, description, status, domain_lead_id, created_at, updated_at').is('deleted_on', null).order('created_at'),
        supabase.from('domain_skill_mappings').select('id, domain_id, skill_id, tenant_id, skill_weight, created_at').is('deleted_on', null),
      ]);
      if (domainsRes.error) throw domainsRes.error;
      if (mappingsRes.error) throw mappingsRes.error;

      const domains: Domain[] = (domainsRes.data || []).map((d: any) => ({
        id: d.id, tenant_id: d.tenant_id, name: d.name, description: d.description || '',
        status: d.status as 'active' | 'disabled', domain_lead_id: d.domain_lead_id || null,
        created_at: d.created_at, updated_at: d.updated_at,
      }));
      const mappings: DomainSkillMap[] = (mappingsRes.data || []).map((m: any) => ({
        id: m.id, domain_id: m.domain_id, skill_id: m.skill_id, tenant_id: m.tenant_id,
        skill_weight: Number(m.skill_weight), created_at: m.created_at,
      }));
        set({ domains, mappings, loading: false, initialized: true });
      } catch (err) {
        console.error('Failed to fetch domains:', err);
        set({ loading: false, initialized: true });
      } finally {
        fetchDomainsInFlight = null;
      }
    })();

    return fetchDomainsInFlight;
  },

  addDomain: async (domain) => {
    const id = `dom-${Date.now()}`;
    const userId = getCurrentUserId();
    const { data, error } = await supabase.from('domains').insert({
      id, ...domain, created_by: userId,
    }).select().single();
    if (error) { console.error('Failed to add domain:', error); return undefined; }
    set((state) => ({
      domains: [...state.domains, {
        id, ...domain, created_at: (data as any).created_at, updated_at: (data as any).updated_at,
      }],
    }));
    return id;
  },

  updateDomain: async (id, updates) => {
    const userId = getCurrentUserId();
    const { error } = await supabase.from('domains').update({
      ...updates, updated_at: new Date().toISOString(), modified_by: userId, modified_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { console.error('Failed to update domain:', error); return; }
    set((state) => ({
      domains: state.domains.map((d) =>
        d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d
      ),
    }));
  },

  toggleDomainStatus: async (id) => {
    const domain = get().domains.find((d) => d.id === id);
    if (!domain) return;
    const newStatus = domain.status === 'active' ? 'disabled' : 'active';
    await get().updateDomain(id, { status: newStatus });
  },

  addMapping: async (mapping) => {
    const id = `dsm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const userId = getCurrentUserId();
    const now = new Date().toISOString();

    const { data: existing, error: existingError } = await supabase
      .from('domain_skill_mappings')
      .select('id, domain_id, skill_id, tenant_id, skill_weight, created_at, deleted_on')
      .eq('domain_id', mapping.domain_id)
      .eq('skill_id', mapping.skill_id)
      .order('deleted_on', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('Failed to check existing mapping:', existingError);
      throw existingError;
    }

    if (existing && !(existing as any).deleted_on) {
      set((state) => {
        if (state.mappings.some((m) => m.id === (existing as any).id)) return state;
        return {
          mappings: [...state.mappings, {
            id: (existing as any).id,
            domain_id: (existing as any).domain_id,
            skill_id: (existing as any).skill_id,
            tenant_id: (existing as any).tenant_id,
            skill_weight: Number((existing as any).skill_weight),
            created_at: (existing as any).created_at,
          }],
        };
      });
      return;
    }

    if (existing && (existing as any).deleted_on) {
      const { data, error } = await supabase
        .from('domain_skill_mappings')
        .update({
          tenant_id: mapping.tenant_id,
          skill_weight: mapping.skill_weight,
          deleted_on: null,
          deleted_by: null,
          modified_by: userId,
          modified_at: now,
        })
        .eq('id', (existing as any).id)
        .select('id, domain_id, skill_id, tenant_id, skill_weight, created_at')
        .single();
      if (error) { console.error('Failed to restore mapping:', error); throw error; }
      set((state) => ({
        mappings: [
          ...state.mappings.filter((m) => m.id !== (data as any).id),
          {
            id: (data as any).id,
            domain_id: (data as any).domain_id,
            skill_id: (data as any).skill_id,
            tenant_id: (data as any).tenant_id,
            skill_weight: Number((data as any).skill_weight),
            created_at: (data as any).created_at,
          },
        ],
      }));
      return;
    }

    const { data, error } = await supabase.from('domain_skill_mappings').insert({
      id, ...mapping, created_by: userId,
    }).select('id, domain_id, skill_id, tenant_id, skill_weight, created_at').single();
    if (error) { console.error('Failed to add mapping:', error); throw error; }
    set((state) => ({
      mappings: [...state.mappings, { id, ...mapping, created_at: (data as any).created_at }],
    }));
  },

  removeMapping: async (id) => {
    const now = new Date().toISOString();
    const userId = getCurrentUserId();
    const { error } = await supabase.from('domain_skill_mappings').update({
      deleted_on: now, deleted_by: userId,
    }).eq('id', id);
    if (error) { console.error('Failed to remove mapping:', error); throw error; }
    set((state) => ({ mappings: state.mappings.filter((m) => m.id !== id) }));
  },

  getMappingsForDomain: (domainId) => get().mappings.filter((m) => m.domain_id === domainId),

  checkDomainDeletable: async (id) => {
    const mappingCount = get().mappings.filter((m) => m.domain_id === id).length;
    if (mappingCount > 0) {
      return { deletable: false, reason: `Domain has ${mappingCount} mapped skill(s). Remove them first.` };
    }
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('domain_id', id)
      .is('deleted_on', null);
    if (count && count > 0) {
      return { deletable: false, reason: `Domain has ${count} assigned user(s). Remove them first.` };
    }
    return { deletable: true };
  },

  deleteDomain: async (id) => {
    const check = await get().checkDomainDeletable(id);
    if (!check.deletable) return false;
    const now = new Date().toISOString();
    const userId = getCurrentUserId();
    const { error } = await supabase.from('domains').update({
      deleted_on: now, deleted_by: userId, modified_at: now, modified_by: userId,
    }).eq('id', id);
    if (error) { console.error('Failed to delete domain:', error); return false; }
    set((state) => ({ domains: state.domains.filter((d) => d.id !== id) }));
    return true;
  },
}));
