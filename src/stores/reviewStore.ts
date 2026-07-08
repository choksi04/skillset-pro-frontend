import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RatingLevel } from './registryStore';
import { SkillScore } from './attemptStore';
import { getCurrentUserId } from '@/lib/audit';

export interface SkillReviewEntry {
  skill_id: string;
  self_rating: RatingLevel;
  ai_calculated_level: number;
  ai_score: number;
  verified_level: number;
  manager_comment: string;
}

export interface ManagerReview {
  id: string;
  tenant_id: string;
  assessment_id: string;
  attempt_id: string;
  employee_id: string;
  employee_name: string;
  domain_id: string;
  reviewer_id: string;
  skill_reviews: SkillReviewEntry[];
  overall_comment: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  target_role: 'manager' | 'admin' | 'employee';
  target_user_id?: string;
  message: string;
  type: 'assessment_completed' | 'review_completed' | 'reassessment_requested' | 'cycle_activated' | 'submission_reminder' | 'assessment_reminder';
  reference_id: string;
  action_link?: string;
  read: boolean;
  created_at: string;
}

export interface OfficialSkillEntry {
  id: string;
  employee_id: string;
  tenant_id: string;
  skill_id: string;
  final_level: number;
  assessment_reference: string;
  manager_comments: string;
  timestamp: string;
  cycle: string;
  self_rating: RatingLevel;
  ai_level: number;
  review_id: string;
}

interface FetchOptions { force?: boolean }

interface ReviewStore {
  reviews: ManagerReview[];
  notifications: Notification[];
  officialEntries: OfficialSkillEntry[];
  loading: boolean;
  initialized: boolean;

  fetchReviews: (options?: FetchOptions) => Promise<void>;
  createReview: (params: {
    tenant_id: string;
    assessment_id: string;
    attempt_id: string;
    employee_id: string;
    employee_name: string;
    domain_id: string;
    reviewer_id: string;
    skill_scores: SkillScore[];
    self_ratings: { skill_id: string; rating: RatingLevel }[];
  }) => Promise<string>;

  setVerifiedLevel: (reviewId: string, skillId: string, level: number) => Promise<void>;
  setSkillComment: (reviewId: string, skillId: string, comment: string) => Promise<void>;
  setOverallComment: (reviewId: string, comment: string) => Promise<void>;
  verifyReview: (reviewId: string, cycle: string) => Promise<void>;

  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read'>) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  getUnreadCount: (role: string) => number;

  getReviewsForManager: (reviewerId: string) => ManagerReview[];
  getReviewForAssessment: (assessmentId: string) => ManagerReview | undefined;
  reassignReviewer: (reviewId: string, newReviewerId: string) => Promise<void>;
}

let fetchReviewsInFlight: Promise<void> | null = null;

export const useReviewStore = create<ReviewStore>((set, get) => ({
  reviews: [],
  notifications: [],
  officialEntries: [],
  loading: false,
  initialized: false,

  fetchReviews: async (options = {}) => {
    const { force = false } = options;
    const state = get();
    if (!force && state.initialized) return;
    if (!force && fetchReviewsInFlight) return fetchReviewsInFlight;

    fetchReviewsInFlight = (async () => {
      set({ loading: true });
      try {
      const [reviewsRes, notifsRes, entriesRes] = await Promise.all([
        supabase.from('manager_reviews').select('id, tenant_id, assessment_id, attempt_id, employee_id, employee_name, domain_id, reviewer_id, overall_comment, status, created_at, updated_at, completed_at').is('deleted_on', null).order('created_at', { ascending: false }),
        supabase.from('notifications').select('id, tenant_id, target_role, target_user_id, message, type, reference_id, action_link, read, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('official_skill_entries').select('id, employee_id, tenant_id, skill_id, final_level, assessment_reference, manager_comments, created_at, cycle, self_rating, ai_level, review_id').is('deleted_on', null),
      ]);
      if (reviewsRes.error) throw reviewsRes.error;

      const reviewIds = (reviewsRes.data || []).map((r: any) => r.id);
      let skillEntries: any[] = [];
      if (reviewIds.length > 0) {
        const { data, error } = await supabase.from('review_skill_entries').select('review_id, skill_id, self_rating, ai_calculated_level, ai_score, verified_level, manager_comment').in('review_id', reviewIds);
        if (error) throw error;
        skillEntries = data || [];
      }

      const reviews: ManagerReview[] = (reviewsRes.data || []).map((r: any) => ({
        id: r.id, tenant_id: r.tenant_id, assessment_id: r.assessment_id, attempt_id: r.attempt_id,
        employee_id: r.employee_id, employee_name: r.employee_name, domain_id: r.domain_id,
        reviewer_id: r.reviewer_id, overall_comment: r.overall_comment || '',
        status: r.status as any, created_at: r.created_at, updated_at: r.updated_at, completed_at: r.completed_at,
        skill_reviews: skillEntries.filter((se: any) => se.review_id === r.id).map((se: any) => ({
          skill_id: se.skill_id,
          self_rating: se.self_rating as RatingLevel,
          ai_calculated_level: se.ai_calculated_level,
          ai_score: se.ai_score,
          verified_level: (se as any).verified_level ?? se.ai_calculated_level,
          manager_comment: se.manager_comment || '',
        })),
      }));

      const notifications: Notification[] = (notifsRes.data || []).map((n: any) => ({
        id: n.id, tenant_id: n.tenant_id, target_role: n.target_role as any,
        target_user_id: n.target_user_id, message: n.message, type: n.type as any,
        reference_id: n.reference_id, action_link: n.action_link, read: n.read, created_at: n.created_at,
      }));

      const officialEntries: OfficialSkillEntry[] = (entriesRes.data || []).map((e: any) => ({
        id: e.id, employee_id: e.employee_id, tenant_id: e.tenant_id, skill_id: e.skill_id,
        final_level: e.final_level, assessment_reference: e.assessment_reference,
        manager_comments: e.manager_comments || '', timestamp: e.created_at, cycle: e.cycle,
        self_rating: e.self_rating as RatingLevel, ai_level: e.ai_level, review_id: e.review_id,
      }));

        set({ reviews, notifications, officialEntries, loading: false, initialized: true });
      } catch (err) {
        console.error('Failed to fetch reviews:', err);
        set({ loading: false, initialized: true });
      } finally {
        fetchReviewsInFlight = null;
      }
    })();

    return fetchReviewsInFlight;
  },

  createReview: async (params) => {
    const existing = get().reviews.find((r) => r.assessment_id === params.assessment_id);
    if (existing) return existing.id;

    const id = `review-${Date.now()}`;
    const userId = getCurrentUserId();
    const skillReviews: SkillReviewEntry[] = params.skill_scores.map((ss) => {
      const selfRating = params.self_ratings.find((r) => r.skill_id === ss.skill_id);
      return {
        skill_id: ss.skill_id,
        self_rating: (selfRating?.rating ?? 3) as RatingLevel,
        ai_calculated_level: ss.calculated_level,
        ai_score: ss.avg_score,
        verified_level: ss.calculated_level,
        manager_comment: '',
      };
    });

    const { error: reviewError } = await supabase.from('manager_reviews').insert({
      id, tenant_id: params.tenant_id, assessment_id: params.assessment_id,
      attempt_id: params.attempt_id, employee_id: params.employee_id,
      employee_name: params.employee_name, domain_id: params.domain_id,
      reviewer_id: params.reviewer_id, status: 'pending', created_by: userId,
    });
    if (reviewError) {
      if (reviewError.code === '23505') {
        const existing = get().reviews.find((r) => r.assessment_id === params.assessment_id);
        return existing?.id ?? '';
      }
      console.error('Failed to create review:', reviewError);
      return '';
    }

    if (skillReviews.length > 0) {
      await supabase.from('review_skill_entries').insert(
        skillReviews.map((sr) => ({
          review_id: id, skill_id: sr.skill_id, self_rating: sr.self_rating,
          ai_calculated_level: sr.ai_calculated_level, ai_score: sr.ai_score,
          verified_level: sr.verified_level,
        } as any))
      );
    }

    const review: ManagerReview = {
      id, tenant_id: params.tenant_id, assessment_id: params.assessment_id,
      attempt_id: params.attempt_id, employee_id: params.employee_id,
      employee_name: params.employee_name, domain_id: params.domain_id,
      reviewer_id: params.reviewer_id, skill_reviews: skillReviews,
      overall_comment: '', status: 'pending',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };

    set((state) => ({ reviews: [...state.reviews, review] }));

    await get().addNotification({
      tenant_id: params.tenant_id, target_role: 'manager', target_user_id: params.reviewer_id,
      message: `Assessment completed for ${params.employee_name}. Ready for review.`,
      type: 'assessment_completed', reference_id: id,
    });

    return id;
  },

  setVerifiedLevel: async (reviewId, skillId, level) => {
    const userId = getCurrentUserId();
    await supabase.from('review_skill_entries').update({
      verified_level: level,
    } as any).eq('review_id', reviewId).eq('skill_id', skillId);

    await supabase.from('manager_reviews').update({
      status: 'in_progress', updated_at: new Date().toISOString(), modified_by: userId, modified_at: new Date().toISOString(),
    }).eq('id', reviewId);

    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === reviewId ? {
          ...r,
          status: r.status === 'completed' ? r.status : 'in_progress' as const,
          updated_at: new Date().toISOString(),
          skill_reviews: r.skill_reviews.map((sr) =>
            sr.skill_id === skillId ? { ...sr, verified_level: level } : sr
          ),
        } : r
      ),
    }));
  },

  setSkillComment: async (reviewId, skillId, comment) => {
    await supabase.from('review_skill_entries').update({ manager_comment: comment })
      .eq('review_id', reviewId).eq('skill_id', skillId);

    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === reviewId ? {
          ...r, updated_at: new Date().toISOString(),
          skill_reviews: r.skill_reviews.map((sr) =>
            sr.skill_id === skillId ? { ...sr, manager_comment: comment } : sr
          ),
        } : r
      ),
    }));
  },

  setOverallComment: async (reviewId, comment) => {
    const userId = getCurrentUserId();
    await supabase.from('manager_reviews').update({
      overall_comment: comment, updated_at: new Date().toISOString(), modified_by: userId, modified_at: new Date().toISOString(),
    }).eq('id', reviewId);

    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === reviewId ? { ...r, overall_comment: comment, updated_at: new Date().toISOString() } : r
      ),
    }));
  },

  verifyReview: async (reviewId, cycle) => {
    const review = get().reviews.find((r) => r.id === reviewId);
    if (!review) return;

    const now = new Date().toISOString();
    const userId = getCurrentUserId();

    const newEntries: OfficialSkillEntry[] = review.skill_reviews.map((sr) => ({
      id: `entry-${Date.now()}-${sr.skill_id}`,
      employee_id: review.employee_id, tenant_id: review.tenant_id, skill_id: sr.skill_id,
      final_level: sr.verified_level,
      assessment_reference: review.assessment_id,
      manager_comments: sr.manager_comment || review.overall_comment || '',
      timestamp: now, cycle, self_rating: sr.self_rating, ai_level: sr.ai_calculated_level, review_id: reviewId,
    }));

    await supabase.from('manager_reviews').update({
      status: 'completed', completed_at: now, updated_at: now, modified_by: userId, modified_at: now,
    }).eq('id', reviewId);

    if (newEntries.length > 0) {
      await supabase.from('official_skill_entries').insert(
        newEntries.map((e) => ({
          id: e.id, employee_id: e.employee_id, tenant_id: e.tenant_id, skill_id: e.skill_id,
          final_level: e.final_level, assessment_reference: e.assessment_reference,
          manager_comments: e.manager_comments, cycle: e.cycle, self_rating: e.self_rating,
          ai_level: e.ai_level, review_id: e.review_id, created_by: userId,
        }))
      );
    }

    await get().addNotification({
      tenant_id: review.tenant_id, target_role: 'employee', target_user_id: review.employee_id,
      message: 'Your skill assessment has been verified by your manager.',
      type: 'review_completed', reference_id: reviewId,
    });

    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === reviewId ? { ...r, status: 'completed' as const, completed_at: now, updated_at: now } : r
      ),
      officialEntries: [...state.officialEntries, ...newEntries],
    }));

    // Mark assignment as verified
    import('./assignmentStore').then(({ syncAssignmentForReview }) =>
      syncAssignmentForReview(review.assessment_id).catch(() => {}),
    );
  },

  addNotification: async (notification) => {
    const id = `notif-${Date.now()}`;
    const now = new Date().toISOString();
    await supabase.from('notifications').insert({
      id, ...notification, read: false,
    });
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id, read: false, created_at: now }],
    }));
  },

  markNotificationRead: async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  getUnreadCount: (role) => get().notifications.filter((n) => n.target_role === role && !n.read).length,
  getReviewsForManager: (reviewerId) => get().reviews.filter((r) => r.reviewer_id === reviewerId),
  getReviewForAssessment: (assessmentId) => get().reviews.find((r) => r.assessment_id === assessmentId),

  reassignReviewer: async (reviewId, newReviewerId) => {
    const review = get().reviews.find((r) => r.id === reviewId);
    if (!review) return;
    const userId = getCurrentUserId();
    const now = new Date().toISOString();

    await supabase.from('manager_reviews').update({
      reviewer_id: newReviewerId, modified_by: userId, modified_at: now,
    }).eq('id', reviewId);

    const notifId = `notif-reassign-${Date.now()}`;
    await supabase.from('notifications').insert({
      id: notifId, tenant_id: review.tenant_id, target_role: 'manager',
      target_user_id: newReviewerId,
      message: `You have been assigned to review ${review.employee_name}'s assessment.`,
      type: 'assessment_completed', reference_id: reviewId,
      action_link: '/reviews', read: false,
    });

    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === reviewId ? { ...r, reviewer_id: newReviewerId } : r
      ),
      notifications: [...state.notifications, {
        id: notifId, tenant_id: review.tenant_id, target_role: 'manager',
        target_user_id: newReviewerId,
        message: `You have been assigned to review ${review.employee_name}'s assessment.`,
        type: 'assessment_completed' as const, reference_id: reviewId,
        action_link: '/reviews', read: false, created_at: now,
      }],
    }));
  },
}));
