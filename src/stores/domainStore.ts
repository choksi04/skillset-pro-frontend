import { create } from 'zustand';

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

const defaultDomains: Domain[] = [
  { id: 'dom-1', tenant_id: 'tenant-001', name: 'Frontend Engineering', description: 'Client-side application development including web and mobile interfaces.', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dom-2', tenant_id: 'tenant-001', name: 'Backend Engineering', description: 'Server-side services, APIs, databases, and infrastructure.', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dom-3', tenant_id: 'tenant-001', name: 'Quality Assurance', description: 'Testing strategies, automation, and quality processes.', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'dom-4', tenant_id: 'tenant-001', name: 'Product Management', description: 'Product strategy, roadmapping, and stakeholder management.', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const defaultMappings: DomainSkillMap[] = [
  { id: 'dsm-1', domain_id: 'dom-1', skill_id: 'skill-1', tenant_id: 'tenant-001', skill_weight: 1, created_at: new Date().toISOString() },
  { id: 'dsm-2', domain_id: 'dom-1', skill_id: 'skill-5', tenant_id: 'tenant-001', skill_weight: 1, created_at: new Date().toISOString() },
  { id: 'dsm-3', domain_id: 'dom-2', skill_id: 'skill-2', tenant_id: 'tenant-001', skill_weight: 1, created_at: new Date().toISOString() },
  { id: 'dsm-4', domain_id: 'dom-2', skill_id: 'skill-3', tenant_id: 'tenant-001', skill_weight: 1, created_at: new Date().toISOString() },
  { id: 'dsm-5', domain_id: 'dom-2', skill_id: 'skill-4', tenant_id: 'tenant-001', skill_weight: 1, created_at: new Date().toISOString() },
];

interface DomainStore {
  domains: Domain[];
  mappings: DomainSkillMap[];
  addDomain: (domain: Omit<Domain, 'id' | 'created_at' | 'updated_at'>) => void;
  updateDomain: (id: string, updates: Partial<Domain>) => void;
  toggleDomainStatus: (id: string) => void;
  addMapping: (mapping: Omit<DomainSkillMap, 'id' | 'created_at'>) => void;
  removeMapping: (id: string) => void;
  getMappingsForDomain: (domainId: string) => DomainSkillMap[];
}

export const useDomainStore = create<DomainStore>((set, get) => ({
  domains: defaultDomains,
  mappings: defaultMappings,
  addDomain: (domain) =>
    set((state) => ({
      domains: [...state.domains, { ...domain, id: `dom-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    })),
  updateDomain: (id, updates) =>
    set((state) => ({
      domains: state.domains.map((d) =>
        d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d
      ),
    })),
  toggleDomainStatus: (id) =>
    set((state) => ({
      domains: state.domains.map((d) =>
        d.id === id ? { ...d, status: d.status === 'active' ? 'disabled' : 'active', updated_at: new Date().toISOString() } : d
      ),
    })),
  addMapping: (mapping) =>
    set((state) => ({
      mappings: [...state.mappings, { ...mapping, id: `dsm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, created_at: new Date().toISOString() }],
    })),
  removeMapping: (id) =>
    set((state) => ({
      mappings: state.mappings.filter((m) => m.id !== id),
    })),
  getMappingsForDomain: (domainId) => get().mappings.filter((m) => m.domain_id === domainId),
}));
