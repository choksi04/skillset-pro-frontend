// Unified registry status vocabulary used across My Registry, Team Registry,
// All Registries, and registry detail pages. Keep this as the single source
// of truth so labels/colors stay consistent.

export type RegistryStatus =
  | 'draft'
  | 'incomplete'
  | 'review_pending'
  | 'approved';

export interface DeriveRegistryStatusInput {
  /** Registry row status: 'draft' | 'submitted' (or undefined when no registry exists). */
  registryStatus: 'draft' | 'submitted' | undefined;
  /** Number of skills the employee has rated in the registry. */
  ratedCount: number;
  /** Total skills mapped to the employee's domain. */
  totalSkills: number;
  /** Latest manager review status for this registry, if any. */
  reviewStatus?: 'pending' | 'approved' | 'completed' | null;
}

/**
 * Derive a single, user-facing status from the various underlying state pieces.
 * Order of precedence:
 *   draft → incomplete (submitted but not all skills rated) → approved → review_pending
 */
export function deriveRegistryStatus(input: DeriveRegistryStatusInput): RegistryStatus {
  const { registryStatus, ratedCount, totalSkills, reviewStatus } = input;
  if (registryStatus === 'draft') return 'draft';
  // Submitted but employee did not rate every domain skill
  if (totalSkills > 0 && ratedCount < totalSkills) return 'incomplete';
  if (reviewStatus === 'approved' || reviewStatus === 'completed') return 'approved';
  return 'review_pending';
}

export interface RegistryStatusMeta {
  label: string;
  /** Short label for cramped contexts (table cells, drawers). */
  shortLabel: string;
  /** Tailwind classes for badge background/text/border. */
  badgeClass: string;
}

export const registryStatusConfig: Record<RegistryStatus, RegistryStatusMeta> = {
  draft: {
    label: 'Draft',
    shortLabel: 'Draft',
    badgeClass: 'bg-warning/15 text-warning border-warning/20 hover:bg-warning/15',
  },
  incomplete: {
    label: 'Incomplete Submission',
    shortLabel: 'Incomplete',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10',
  },
  review_pending: {
    label: 'Review Pending',
    shortLabel: 'Review Pending',
    badgeClass: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/10',
  },
  approved: {
    label: 'Approved',
    shortLabel: 'Approved',
    badgeClass: 'bg-success/15 text-success border-success/20 hover:bg-success/15',
  },
};

export const getRegistryStatusBadgeClass = (s: RegistryStatus) =>
  registryStatusConfig[s].badgeClass;

export const getRegistryStatusLabel = (s: RegistryStatus, short = false) =>
  short ? registryStatusConfig[s].shortLabel : registryStatusConfig[s].label;
