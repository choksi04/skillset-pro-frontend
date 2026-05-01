import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from '@/lib/audit';

export interface RegistryReviewItem {
  skill_id: string;
  manager_score: number | null;
  manager_comment: string;
}

export interface RegistryReview {
  id: string;
  tenant_id: string;
  registry_id: string;
  reviewer_id: string;
  status: 'pending' | 'approved';
  overall_comment: string;
  completed_at: string | null;
  items: RegistryReviewItem[];
}

/** Lightweight status cache for list/grid views — avoids fetching full review payloads. */
export type ReviewStatusValue = 'pending' | 'approved';

interface RegistryReviewStore {
  reviews: Map<string, RegistryReview>; // keyed by registry_id
  /** registry_id -> latest review status (pending/approved). Absent ⇒ no review row. */
  reviewStatuses: Record<string, ReviewStatusValue>;
  loading: boolean;

  fetchReviewForRegistry: (registryId: string) => Promise<RegistryReview | null>;
  /**
   * Batch-fetch the review status for many registries in a single query.
   * Skips IDs already cached in `reviewStatuses`. Safe to call repeatedly.
   */
  fetchReviewStatusesForRegistries: (registryIds: string[]) => Promise<void>;
  ensureReview: (
    registryId: string,
    reviewerId: string,
    tenantId: string,
  ) => Promise<RegistryReview>;
  setItemScore: (registryId: string, skillId: string, score: number) => Promise<void>;
  setItemComment: (registryId: string, skillId: string, comment: string) => Promise<void>;
  approveReview: (
    registryId: string,
    employeeId: string,
    tenantId: string,
  ) => Promise<void>;
}

export const useRegistryReviewStore = create<RegistryReviewStore>((set, get) => ({
  reviews: new Map(),
  reviewStatuses: {},
  loading: false,

  fetchReviewStatusesForRegistries: async (registryIds) => {
    const cache = get().reviewStatuses;
    const missing = Array.from(new Set(registryIds.filter((id) => !(id in cache))));
    if (missing.length === 0) return;
    const { data, error } = await supabase
      .from('registry_reviews')
      .select('registry_id, status')
      .in('registry_id', missing)
      .is('deleted_on', null);
    if (error) {
      console.error('fetchReviewStatusesForRegistries', error);
      return;
    }
    set((s) => {
      const next = { ...s.reviewStatuses };
      (data ?? []).forEach((r: any) => {
        next[r.registry_id] = r.status === 'approved' ? 'approved' : 'pending';
      });
      return { reviewStatuses: next };
    });
  },

  fetchReviewForRegistry: async (registryId) => {
    const { data: review, error } = await supabase
      .from('registry_reviews')
      .select('*')
      .eq('registry_id', registryId)
      .is('deleted_on', null)
      .maybeSingle();
    if (error) {
      console.error('fetchReviewForRegistry', error);
      return null;
    }
    if (!review) return null;

    const { data: items } = await supabase
      .from('registry_review_items')
      .select('*')
      .eq('review_id', (review as any).id);

    const r: RegistryReview = {
      id: (review as any).id,
      tenant_id: (review as any).tenant_id,
      registry_id: (review as any).registry_id,
      reviewer_id: (review as any).reviewer_id,
      status: (review as any).status,
      overall_comment: (review as any).overall_comment ?? '',
      completed_at: (review as any).completed_at,
      items: (items ?? []).map((i: any) => ({
        skill_id: i.skill_id,
        manager_score: i.manager_score,
        manager_comment: i.manager_comment ?? '',
      })),
    };
    set((s) => {
      const next = new Map(s.reviews);
      next.set(registryId, r);
      return { reviews: next };
    });
    return r;
  },

  ensureReview: async (registryId, reviewerId, tenantId) => {
    const existing = get().reviews.get(registryId);
    if (existing) return existing;
    const fetched = await get().fetchReviewForRegistry(registryId);
    if (fetched) return fetched;

    const userId = getCurrentUserId();
    const { data, error } = await supabase
      .from('registry_reviews')
      .insert({
        registry_id: registryId,
        reviewer_id: reviewerId,
        tenant_id: tenantId,
        status: 'pending',
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    const r: RegistryReview = {
      id: (data as any).id,
      tenant_id: (data as any).tenant_id,
      registry_id: (data as any).registry_id,
      reviewer_id: (data as any).reviewer_id,
      status: 'pending',
      overall_comment: '',
      completed_at: null,
      items: [],
    };
    set((s) => {
      const next = new Map(s.reviews);
      next.set(registryId, r);
      return {
        reviews: next,
        reviewStatuses: { ...s.reviewStatuses, [registryId]: 'pending' },
      };
    });
    return r;
  },

  setItemScore: async (registryId, skillId, score) => {
    const review = get().reviews.get(registryId);
    if (!review) return;
    const existing = review.items.find((i) => i.skill_id === skillId);

    if (existing) {
      await supabase
        .from('registry_review_items')
        .update({ manager_score: score, modified_at: new Date().toISOString() })
        .eq('review_id', review.id)
        .eq('skill_id', skillId);
    } else {
      await supabase.from('registry_review_items').insert({
        review_id: review.id,
        skill_id: skillId,
        manager_score: score,
        manager_comment: '',
      });
    }

    set((s) => {
      const next = new Map(s.reviews);
      const r = next.get(registryId);
      if (!r) return { reviews: next };
      const items = existing
        ? r.items.map((i) => (i.skill_id === skillId ? { ...i, manager_score: score } : i))
        : [...r.items, { skill_id: skillId, manager_score: score, manager_comment: '' }];
      next.set(registryId, { ...r, items });
      return { reviews: next };
    });
  },

  setItemComment: async (registryId, skillId, comment) => {
    const review = get().reviews.get(registryId);
    if (!review) return;
    const existing = review.items.find((i) => i.skill_id === skillId);

    if (existing) {
      await supabase
        .from('registry_review_items')
        .update({ manager_comment: comment, modified_at: new Date().toISOString() })
        .eq('review_id', review.id)
        .eq('skill_id', skillId);
    } else {
      await supabase.from('registry_review_items').insert({
        review_id: review.id,
        skill_id: skillId,
        manager_score: null,
        manager_comment: comment,
      });
    }

    set((s) => {
      const next = new Map(s.reviews);
      const r = next.get(registryId);
      if (!r) return { reviews: next };
      const items = existing
        ? r.items.map((i) => (i.skill_id === skillId ? { ...i, manager_comment: comment } : i))
        : [...r.items, { skill_id: skillId, manager_score: null, manager_comment: comment }];
      next.set(registryId, { ...r, items });
      return { reviews: next };
    });
  },

  approveReview: async (registryId, employeeId, tenantId) => {
    const review = get().reviews.get(registryId);
    if (!review) return;
    const now = new Date().toISOString();
    const userId = getCurrentUserId();

    await supabase
      .from('registry_reviews')
      .update({
        status: 'approved',
        completed_at: now,
        modified_at: now,
        modified_by: userId,
      })
      .eq('id', review.id);

    // Notify employee
    await supabase.from('notifications').insert({
      id: `notif-reg-approved-${Date.now()}`,
      tenant_id: tenantId,
      target_role: 'employee',
      target_user_id: employeeId,
      message: 'Your skill registry has been reviewed and approved by your manager.',
      type: 'review_completed',
      reference_id: registryId,
      action_link: '/skill-registry',
      read: false,
    });

    set((s) => {
      const next = new Map(s.reviews);
      const r = next.get(registryId);
      if (!r) {
        return { reviews: next, reviewStatuses: { ...s.reviewStatuses, [registryId]: 'approved' } };
      }
      next.set(registryId, { ...r, status: 'approved', completed_at: now });
      return {
        reviews: next,
        reviewStatuses: { ...s.reviewStatuses, [registryId]: 'approved' },
      };
    });
  },
}));
