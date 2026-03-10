import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface Domain {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  status: 'active' | 'disabled';
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

interface DomainStore {
  domains: Domain[];
  mappings: DomainSkillMap[];
  loading: boolean;
  initialized: boolean;
  fetchDomains: () => Promise<void>;
  addDomain: (domain: Omit<Domain, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDomain: (id: string, updates: Partial<Domain>) => Promise<void>;
  toggleDomainStatus: (id: string) => Promise<void>;
  addMapping: (mapping: Omit<DomainSkillMap, 'id' | 'created_at'>) => Promise<void>;
  removeMapping: (id: string) => Promise<void>;
  getMappingsForDomain: (domainId: string) => DomainSkillMap[];
}

export const useDomainStore = create<DomainStore>((set, get) => ({
  domains: [],
  mappings: [],
  loading: false,
  initialized: false,

  fetchDomains: async () => {
    if (get().initialized) return;
    set({ loading: true });
    try {
      const [domainsRes, mappingsRes] = await Promise.all([
        supabase.from('domains').select('*').is('deleted_on', null).order('created_at'),
        supabase.from('domain_skill_mappings').select('*').is('deleted_on', null),
      ]);
      if (domainsRes.error) throw domainsRes.error;
      if (mappingsRes.error) throw mappingsRes.error;

      const domains: Domain[] = (domainsRes.data || []).map((d: any) => ({
        id: d.id, tenant_id: d.tenant_id, name: d.name, description: d.description || '',
        status: d.status as 'active' | 'disabled', created_at: d.created_at, updated_at: d.updated_at,
      }));
      const mappings: DomainSkillMap[] = (mappingsRes.data || []).map((m: any) => ({
        id: m.id, domain_id: m.domain_id, skill_id: m.skill_id, tenant_id: m.tenant_id,
        skill_weight: Number(m.skill_weight), created_at: m.created_at,
      }));
      set({ domains, mappings, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch domains:', err);
      set({ loading: false, initialized: true });
    }
  },

  addDomain: async (domain) => {
    const id = `dom-${Date.now()}`;
    const { data, error } = await supabase.from('domains').insert({
      id, ...domain,
    }).select().single();
    if (error) { console.error('Failed to add domain:', error); return; }
    set((state) => ({
      domains: [...state.domains, {
        id, ...domain, created_at: (data as any).created_at, updated_at: (data as any).updated_at,
      }],
    }));
  },

  updateDomain: async (id, updates) => {
    const { error } = await supabase.from('domains').update({
      ...updates, updated_at: new Date().toISOString(),
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
    const { data, error } = await supabase.from('domain_skill_mappings').insert({
      id, ...mapping,
    }).select().single();
    if (error) { console.error('Failed to add mapping:', error); return; }
    set((state) => ({
      mappings: [...state.mappings, { id, ...mapping, created_at: (data as any).created_at }],
    }));
  },

  removeMapping: async (id) => {
    const { error } = await supabase.from('domain_skill_mappings').delete().eq('id', id);
    if (error) { console.error('Failed to remove mapping:', error); return; }
    set((state) => ({ mappings: state.mappings.filter((m) => m.id !== id) }));
  },

  getMappingsForDomain: (domainId) => get().mappings.filter((m) => m.domain_id === domainId),
}));
