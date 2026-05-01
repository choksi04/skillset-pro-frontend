import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';

export interface SkillRegistry {
  id: string;
  tenant_id: string;
  employee_id: string;
  domain_id: string;
  version_number: number;
  status: 'draft' | 'submitted';
  submitted_at: string | null;
  created_at: string;
  created_by: string | null;
  modified_by: string | null;
  modified_at: string | null;
}

export interface SkillRegistryItem {
  id: string;
  registry_id: string;
  skill_id: string;
  self_score: number;
  comment: string | null;
}

interface SkillRegistryStore {
  registries: SkillRegistry[];
  items: Map<string, SkillRegistryItem[]>;
  loading: boolean;
  initialized: boolean;

  fetchRegistries: (employeeId?: string) => Promise<void>;
  fetchItems: (registryId: string) => Promise<SkillRegistryItem[]>;
  getLatest: (employeeId: string) => SkillRegistry | undefined;
  getDraft: (employeeId: string) => SkillRegistry | undefined;
  createNewVersion: (employeeId: string, tenantId: string, domainId: string) => Promise<SkillRegistry | null>;
  fetchItemsForRegistries: (ids: string[]) => Promise<void>;
  saveDraft: (registryId: string, items: Omit<SkillRegistryItem, 'id' | 'registry_id'>[]) => Promise<void>;
  submitRegistry: (registryId: string, employeeName: string, domainLeadId: string | null) => Promise<void>;
  discardDraft: (registryId: string) => Promise<void>;
}

export const useSkillRegistryStore = create<SkillRegistryStore>((set, get) => ({
  registries: [],
  items: new Map(),
  loading: false,
  initialized: false,

  fetchRegistries: async (employeeId?: string) => {
    set({ loading: true });
    try {
      let query = supabase
        .from('skill_registries')
        .select('*')
        .is('deleted_on', null)
        .order('version_number', { ascending: false });

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const registries: SkillRegistry[] = (data || []).map((r: any) => ({
        id: r.id,
        tenant_id: r.tenant_id,
        employee_id: r.employee_id,
        domain_id: r.domain_id,
        version_number: r.version_number,
        status: r.status as 'draft' | 'submitted',
        submitted_at: r.submitted_at,
        created_at: r.created_at,
        created_by: r.created_by,
        modified_by: r.modified_by,
        modified_at: r.modified_at,
      }));

      set({ registries, loading: false, initialized: true });
    } catch (err) {
      console.error('Failed to fetch skill registries:', err);
      set({ loading: false, initialized: true });
    }
  },

  fetchItems: async (registryId: string) => {
    const cached = get().items.get(registryId);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('skill_registry_items')
      .select('*')
      .eq('registry_id', registryId);

    if (error) {
      console.error('Failed to fetch registry items:', error);
      return [];
    }

    const items: SkillRegistryItem[] = (data || []).map((i: any) => ({
      id: i.id,
      registry_id: i.registry_id,
      skill_id: i.skill_id,
      self_score: i.self_score,
      comment: i.comment,
    }));

    set((state) => {
      const newMap = new Map(state.items);
      newMap.set(registryId, items);
      return { items: newMap };
    });

    return items;
  },

  getLatest: (employeeId: string) => {
    const regs = get().registries.filter((r) => r.employee_id === employeeId);
    return regs.length > 0 ? regs[0] : undefined; // already sorted desc
  },

  getDraft: (employeeId: string) => {
    return get().registries.find((r) => r.employee_id === employeeId && r.status === 'draft');
  },

  createNewVersion: async (employeeId: string, tenantId: string, domainId: string) => {
    const userId = getCurrentUserId();
    const existing = get().registries.filter((r) => r.employee_id === employeeId);
    const nextVersion = existing.length > 0 ? Math.max(...existing.map((r) => r.version_number)) + 1 : 1;

    // Check for existing draft
    const draft = get().getDraft(employeeId);
    if (draft) return draft;

    const { data, error } = await supabase
      .from('skill_registries')
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        domain_id: domainId,
        version_number: nextVersion,
        status: 'draft',
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create new version:', error);
      return null;
    }

    const newReg: SkillRegistry = {
      id: data.id,
      tenant_id: data.tenant_id,
      employee_id: data.employee_id,
      domain_id: data.domain_id,
      version_number: data.version_number,
      status: 'draft',
      submitted_at: null,
      created_at: data.created_at,
      created_by: data.created_by,
      modified_by: null,
      modified_at: null,
    };

    // Copy items from latest submitted version
    const latestSubmitted = existing.find((r) => r.status === 'submitted');
    if (latestSubmitted) {
      const prevItems = await get().fetchItems(latestSubmitted.id);
      if (prevItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('skill_registry_items')
          .insert(prevItems.map((i) => ({
            registry_id: newReg.id,
            skill_id: i.skill_id,
            self_score: i.self_score,
            comment: i.comment,
          })));
        if (itemsError) console.error('Failed to copy items:', itemsError);
      }
    }

    set((state) => ({ registries: [newReg, ...state.registries] }));
    return newReg;
  },

  saveDraft: async (registryId: string, items: Omit<SkillRegistryItem, 'id' | 'registry_id'>[]) => {
    const userId = getCurrentUserId();

    // Delete existing items and re-insert
    await supabase.from('skill_registry_items').delete().eq('registry_id', registryId);

    if (items.length > 0) {
      const { error } = await supabase.from('skill_registry_items').insert(
        items.map((i) => ({
          registry_id: registryId,
          skill_id: i.skill_id,
          self_score: i.self_score,
          comment: i.comment,
        }))
      );
      if (error) console.error('Failed to save draft items:', error);
    }

    // Update modified timestamp
    await supabase.from('skill_registries').update({
      modified_by: userId,
      modified_at: new Date().toISOString(),
    }).eq('id', registryId);

    // Update local cache
    const newItems: SkillRegistryItem[] = items.map((i, idx) => ({
      id: `temp-${idx}`,
      registry_id: registryId,
      skill_id: i.skill_id,
      self_score: i.self_score,
      comment: i.comment,
    }));

    set((state) => {
      const newMap = new Map(state.items);
      newMap.set(registryId, newItems);
      return { items: newMap };
    });
  },

  fetchItemsForRegistries: async (ids: string[]) => {
    const uncached = ids.filter((id) => !get().items.has(id));
    if (uncached.length === 0) return;

    const { data, error } = await supabase
      .from('skill_registry_items')
      .select('*')
      .in('registry_id', uncached);

    if (error) {
      console.error('Failed to batch fetch registry items:', error);
      return;
    }

    const grouped = new Map<string, SkillRegistryItem[]>();
    (data || []).forEach((i: any) => {
      const item: SkillRegistryItem = {
        id: i.id,
        registry_id: i.registry_id,
        skill_id: i.skill_id,
        self_score: i.self_score,
        comment: i.comment,
      };
      if (!grouped.has(i.registry_id)) grouped.set(i.registry_id, []);
      grouped.get(i.registry_id)!.push(item);
    });

    // Also set empty arrays for registries with no items
    uncached.forEach((id) => {
      if (!grouped.has(id)) grouped.set(id, []);
    });

    set((state) => {
      const newMap = new Map(state.items);
      grouped.forEach((items, id) => newMap.set(id, items));
      return { items: newMap };
    });
  },

  submitRegistry: async (registryId: string, employeeName: string, domainLeadId: string | null) => {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const registry = get().registries.find((r) => r.id === registryId);
    if (!registry) return;

    const { error } = await supabase.from('skill_registries').update({
      status: 'submitted',
      submitted_at: now,
      modified_by: userId,
      modified_at: now,
    }).eq('id', registryId);

    if (error) {
      console.error('Failed to submit registry:', error);
      throw error;
    }

    // Send notification to manager
    if (domainLeadId) {
      const notifId = `notif-${Date.now()}`;
      const dateStr = new Date().toLocaleDateString();
      await supabase.from('notifications').insert({
        id: notifId,
        tenant_id: registry.tenant_id,
        target_user_id: domainLeadId,
        target_role: 'manager',
        type: 'registry_submitted',
        reference_id: registryId,
        message: `${employeeName} submitted Skill Registry v${registry.version_number} on ${dateStr}`,
        action_link: `/team-registry/${registryId}`,
      });
    }

    set((state) => ({
      registries: state.registries.map((r) =>
        r.id === registryId ? { ...r, status: 'submitted' as const, submitted_at: now } : r
      ),
    }));
  },

  discardDraft: async (registryId: string) => {
    // Safety: only hard-delete drafts
    const reg = get().registries.find((r) => r.id === registryId);
    if (!reg || reg.status !== 'draft') {
      throw new Error('Only draft registries can be discarded');
    }

    // 1. Delete child items first (no FK cascade defined)
    const { error: itemsErr } = await supabase
      .from('skill_registry_items')
      .delete()
      .eq('registry_id', registryId);

    if (itemsErr) {
      console.error('Failed to delete registry items:', itemsErr);
      throw itemsErr;
    }

    // 2. Hard-delete the draft registry
    const { error } = await supabase
      .from('skill_registries')
      .delete()
      .eq('id', registryId)
      .eq('status', 'draft');

    if (error) {
      console.error('Failed to discard draft:', error);
      throw error;
    }

    set((state) => {
      const newItems = new Map(state.items);
      newItems.delete(registryId);
      return {
        registries: state.registries.filter((r) => r.id !== registryId),
        items: newItems,
      };
    });
  },
}));
