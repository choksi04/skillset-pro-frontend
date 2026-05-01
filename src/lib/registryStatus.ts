/**
 * Single source of truth for skill-registry status.
 *
 * Used by My Registry, Team Registry, All Registries, and the registry
 * detail pages so labels, colors, and rules stay consistent everywhere.
 */

export type RegistryStatus =
  | 'not_started'      // no registry exists for the employee
  | 'draft'            // employee is still editing
  | 'incomplete'       // submitted, but not all domain skills are rated
  | 'review_pending'   // submitted + fully rated, no manager approval yet
  | 'approved';        // manager has approved/completed the review

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface RegistryStatusConfig {
  /** User-facing label shown in badges, filters, etc. */
  label: string;
  /** Tailwind classes applied to the shared <Badge> wrapper. */
  badgeClass: string;
  /** Variant passed to the underlying shadcn <Badge> (kept neutral). */
  variant: BadgeVariant;
}

export const registryStatusConfig: Record<RegistryStatus, RegistryStatusConfig> = {
  not_started: {
    label: 'Not Started',
    badgeClass: 'bg-muted text-muted-foreground border-border hover:bg-muted',
    variant: 'outline',
  },
  draft: {
    label: 'Draft',
    badgeClass: 'bg-warning/15 text-warning border-warning/20 hover:bg-warning/15',
    variant: 'outline',
  },
  incomplete: {
    label: 'Incomplete',
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/20 hover:bg-destructive/15',
    variant: 'outline',
  },
  review_pending: {
    label: 'Review Pending',
    badgeClass: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/10',
    variant: 'outline',
  },
  approved: {
    label: 'Approved',
    badgeClass: 'bg-success/15 text-success border-success/20 hover:bg-success/15',
    variant: 'outline',
  },
};

export interface DeriveRegistryStatusInput {
  /** Underlying `skill_registries.status` (`draft` or `submitted`). */
  registryStatus?: 'draft' | 'submitted' | null;
  /** How many skills have a self_score in this registry version. */
  ratedCount: number;
  /** How many skills are mapped to the employee's domain. */
  totalSkills: number;
  /** Latest `registry_reviews.status` for this registry, if any. */
  reviewStatus?: 'pending' | 'approved' | 'completed' | null;
}

/**
 * Derive the canonical status for a registry from raw data.
 * Order matters — first matching rule wins.
 */
export function deriveRegistryStatus(input: DeriveRegistryStatusInput): RegistryStatus {
  const { registryStatus, ratedCount, totalSkills, reviewStatus } = input;

  if (!registryStatus) return 'not_started';
  if (registryStatus === 'draft') return 'draft';

  // submitted from here
  if (totalSkills > 0 && ratedCount < totalSkills) return 'incomplete';
  if (reviewStatus === 'approved' || reviewStatus === 'completed') return 'approved';
  return 'review_pending';
}

/** Convenience accessor for label-only callers. */
export const getRegistryStatusLabel = (s: RegistryStatus) => registryStatusConfig[s].label;
