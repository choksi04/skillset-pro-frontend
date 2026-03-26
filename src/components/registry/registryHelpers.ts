import { SkillRegistrySubmission, RatingLevel } from '@/stores/registryStore';
import type { ReviewerInfo } from './ManagerAvatar';

// ── Status derivation ──
export type EmployeeStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'assessment_pending'
  | 'assessment_completed'
  | 'review_pending'
  | 'approved'
  | 'incomplete';

export interface EnrichedSubmission {
  submission: SkillRegistrySubmission;
  selfAvg: number;
  assessmentAvg: number | null;
  finalAvg: number | null;
  status: EmployeeStatus;
  reviewer: ReviewerInfo | null;
  isActive: boolean;
}

export function deriveStatus(
  submission: SkillRegistrySubmission | undefined,
  assessments: { submission_id: string; id: string }[],
  attempts: { assessment_id: string; id: string; status: string }[],
  reviews: { attempt_id: string; id: string; status: string }[],
  isCycleClosed?: boolean,
): EmployeeStatus {
  if (!submission) return 'not_started';
  if (submission.status === 'draft') {
    return isCycleClosed ? 'incomplete' : 'in_progress';
  }
  const assessment = assessments.find((a) => a.submission_id === submission.id);
  if (!assessment) return 'submitted';
  const attempt = attempts.find((a) => a.assessment_id === assessment.id);
  if (!attempt || attempt.status === 'in_progress') return 'assessment_pending';
  const review = reviews.find((r) => r.attempt_id === attempt.id);
  if (!review) return 'assessment_completed';
  if (review.status === 'completed') return 'approved';
  return 'review_pending';
}

export const statusConfig: Record<EmployeeStatus, { label: string; color: string; cta: string; ctaDisabled?: boolean }> = {
  not_started: { label: 'Not Started', color: 'bg-muted text-muted-foreground', cta: 'Start Self Review' },
  in_progress: { label: 'In Progress', color: 'bg-warning/15 text-warning border-warning/20', cta: 'Continue Self Review' },
  submitted: { label: 'Self Review Submitted', color: 'bg-primary/15 text-primary border-primary/20', cta: 'Attempt Assessment' },
  assessment_pending: { label: 'Assessment Pending', color: 'bg-accent text-accent-foreground', cta: 'Attempt Assessment' },
  assessment_completed: { label: 'Assessment Completed', color: 'bg-success/15 text-success border-success/20', cta: 'View Assessment Results' },
  review_pending: { label: 'Manager Review Pending', color: 'bg-warning/15 text-warning border-warning/20', cta: 'Waiting for Review', ctaDisabled: true },
  approved: { label: 'Approved', color: 'bg-success/15 text-success border-success/20', cta: 'View Final Results' },
  incomplete: { label: 'Incomplete — Cycle Closed', color: 'bg-destructive/15 text-destructive border-destructive/20', cta: 'View Draft' },
};

export const statusLabel = (status: EmployeeStatus) => statusConfig[status].label;
export const statusColor = (status: EmployeeStatus) => statusConfig[status].color;

export function avgRound(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}
