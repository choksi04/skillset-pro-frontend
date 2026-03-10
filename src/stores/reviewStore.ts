import { create } from 'zustand';
import { RatingLevel } from './registryStore';
import { SkillScore } from './attemptStore';

export type ReviewAction = 'approve' | 'adjust' | 'reassess';

export interface SkillReviewEntry {
  skill_id: string;
  self_rating: RatingLevel;
  ai_calculated_level: number; // 1-5
  ai_score: number; // 0-100
  manager_action: ReviewAction | null;
  manager_adjusted_level: number | null; // 1-5, only if action = 'adjust'
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
  target_role: 'manager' | 'hr' | 'employee';
  target_user_id?: string;
  message: string;
  type: 'assessment_completed' | 'review_completed' | 'reassessment_requested';
  reference_id: string; // review or assessment id
  read: boolean;
  created_at: string;
}

export interface OfficialSkillEntry {
  id: string;
  employee_id: string;
  tenant_id: string;
  skill_id: string;
  final_level: number; // 1-5, manager-validated
  assessment_reference: string; // assessment_id
  manager_comments: string;
  timestamp: string;
  // Additional context (kept for analytics)
  cycle: string;
  self_rating: RatingLevel;
  ai_level: number;
  review_id: string;
}

interface ReviewStore {
  reviews: ManagerReview[];
  notifications: Notification[];
  officialEntries: OfficialSkillEntry[];

  // Create review when assessment is evaluated
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
  }) => string;

  // Manager actions
  setSkillAction: (reviewId: string, skillId: string, action: ReviewAction, adjustedLevel?: number) => void;
  setSkillComment: (reviewId: string, skillId: string, comment: string) => void;
  setOverallComment: (reviewId: string, comment: string) => void;
  completeReview: (reviewId: string, cycle: string) => void;

  // Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  getUnreadCount: (role: string) => number;

  // Queries
  getReviewsForManager: (reviewerId: string) => ManagerReview[];
  getReviewForAssessment: (assessmentId: string) => ManagerReview | undefined;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  reviews: [],
  notifications: [],
  officialEntries: [],

  createReview: (params) => {
    const id = `review-${Date.now()}`;
    const skillReviews: SkillReviewEntry[] = params.skill_scores.map((ss) => {
      const selfRating = params.self_ratings.find((r) => r.skill_id === ss.skill_id);
      return {
        skill_id: ss.skill_id,
        self_rating: (selfRating?.rating ?? 3) as RatingLevel,
        ai_calculated_level: ss.calculated_level,
        ai_score: ss.avg_score,
        manager_action: null,
        manager_adjusted_level: null,
        manager_comment: '',
      };
    });

    const review: ManagerReview = {
      id,
      tenant_id: params.tenant_id,
      assessment_id: params.assessment_id,
      attempt_id: params.attempt_id,
      employee_id: params.employee_id,
      employee_name: params.employee_name,
      domain_id: params.domain_id,
      reviewer_id: params.reviewer_id,
      skill_reviews: skillReviews,
      overall_comment: '',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({ reviews: [...state.reviews, review] }));

    // Auto-create notification for manager
    get().addNotification({
      tenant_id: params.tenant_id,
      target_role: 'manager',
      target_user_id: params.reviewer_id,
      message: `Assessment completed for ${params.employee_name}. Ready for review.`,
      type: 'assessment_completed',
      reference_id: id,
    });

    return id;
  },

  setSkillAction: (reviewId, skillId, action, adjustedLevel) =>
    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              status: 'in_progress' as const,
              updated_at: new Date().toISOString(),
              skill_reviews: r.skill_reviews.map((sr) =>
                sr.skill_id === skillId
                  ? { ...sr, manager_action: action, manager_adjusted_level: action === 'adjust' ? (adjustedLevel ?? sr.ai_calculated_level) : null }
                  : sr
              ),
            }
          : r
      ),
    })),

  setSkillComment: (reviewId, skillId, comment) =>
    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              updated_at: new Date().toISOString(),
              skill_reviews: r.skill_reviews.map((sr) =>
                sr.skill_id === skillId ? { ...sr, manager_comment: comment } : sr
              ),
            }
          : r
      ),
    })),

  setOverallComment: (reviewId, comment) =>
    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === reviewId ? { ...r, overall_comment: comment, updated_at: new Date().toISOString() } : r
      ),
    })),

  completeReview: (reviewId, cycle) =>
    set((state) => {
      const review = state.reviews.find((r) => r.id === reviewId);
      if (!review) return state;

      // Generate official entries
      const newEntries: OfficialSkillEntry[] = review.skill_reviews
        .filter((sr) => sr.manager_action === 'approve' || sr.manager_action === 'adjust')
        .map((sr) => ({
          id: `entry-${Date.now()}-${sr.skill_id}`,
          employee_id: review.employee_id,
          tenant_id: review.tenant_id,
          skill_id: sr.skill_id,
          final_level: sr.manager_action === 'adjust' ? (sr.manager_adjusted_level ?? sr.ai_calculated_level) : sr.ai_calculated_level,
          assessment_reference: review.assessment_id,
          manager_comments: sr.manager_comment || review.overall_comment || '',
          timestamp: new Date().toISOString(),
          cycle,
          self_rating: sr.self_rating,
          ai_level: sr.ai_calculated_level,
          review_id: reviewId,
        }));

      return {
        reviews: state.reviews.map((r) =>
          r.id === reviewId
            ? { ...r, status: 'completed' as const, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }
            : r
        ),
        officialEntries: [...state.officialEntries, ...newEntries],
        notifications: [
          ...state.notifications,
          {
            id: `notif-${Date.now()}`,
            tenant_id: review.tenant_id,
            target_role: 'employee' as const,
            target_user_id: review.employee_id,
            message: `Your skill assessment has been reviewed and approved.`,
            type: 'review_completed' as const,
            reference_id: reviewId,
            read: false,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: `notif-${Date.now()}`, read: false, created_at: new Date().toISOString() },
      ],
    })),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  getUnreadCount: (role) => get().notifications.filter((n) => n.target_role === role && !n.read).length,

  getReviewsForManager: (reviewerId) => get().reviews.filter((r) => r.reviewer_id === reviewerId),

  getReviewForAssessment: (assessmentId) => get().reviews.find((r) => r.assessment_id === assessmentId),
}));
