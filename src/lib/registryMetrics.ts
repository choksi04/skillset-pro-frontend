/**
 * Single source of truth for skill-registry METRICS.
 *
 * Companion to `registryStatus.ts` (which owns the status vocabulary).
 * Every registry view — My Registry (landing + detail) and Team Registry
 * (list + detail) — must derive completion / rated counts / averages from
 * this helper so the same registry never shows two different numbers.
 *
 * Canonical rules:
 *  - Denominator  = ACTIVE skills currently mapped to the registry's domain.
 *  - Numerator    = rated items restricted to that same active skill set.
 *                   Stale items (skills no longer mapped/active) are excluded
 *                   from both sides and reported via `staleItemCount`.
 *  - Averages     = `null` when there are no ratings (never 0.0).
 *  - Status       = derived through `deriveRegistryStatus` with these inputs.
 */

import { deriveRegistryStatus, type RegistryStatus } from '@/lib/registryStatus';

export interface RegistryMetricsInput {
  /** Underlying `skill_registries.status`, or null/undefined when no registry exists. */
  registryStatus?: 'draft' | 'submitted' | null;
  /**
   * Rated items for this registry. Pass `undefined` while items are still
   * loading so callers can render a skeleton instead of a misleading `0`.
   */
  items?: { skill_id: string; self_score: number | null }[];
  /** Active skills mapped to the registry's domain (already filtered by caller). */
  domainSkillIds: string[];
  /** Highest active competency level (used to scale the /5 display average). */
  maxLevel: number;
  /** Latest review status for this registry, if any. */
  reviewStatus?: 'pending' | 'approved' | 'completed' | null;
}

export interface RegistryMetrics {
  /** True while `items` has not been provided yet. */
  loading: boolean;
  totalSkills: number;
  ratedCount: number;
  completionPct: number;
  /** Average on the raw competency scale, or null when nothing is rated. */
  avgRaw: number | null;
  /** Average normalised to a 0–5 display scale, or null when nothing is rated. */
  avgOnFive: number | null;
  /** Rated items whose skill is no longer an active domain skill. */
  staleItemCount: number;
  status: RegistryStatus;
}

export function computeRegistryMetrics(input: RegistryMetricsInput): RegistryMetrics {
  const { registryStatus, items, domainSkillIds, maxLevel, reviewStatus } = input;

  const totalSkills = domainSkillIds.length;
  const loading = items === undefined;
  const list = items ?? [];

  const domainSet = new Set(domainSkillIds);
  const scored = list.filter(
    (i) => i.self_score !== null && i.self_score !== undefined && Number(i.self_score) > 0,
  );
  const inDomain = scored.filter((i) => domainSet.has(i.skill_id));

  const ratedCount = inDomain.length;
  const staleItemCount = scored.length - inDomain.length;
  const completionPct = totalSkills > 0 ? Math.round((ratedCount / totalSkills) * 100) : 0;

  const avgRaw =
    ratedCount > 0
      ? Math.round((inDomain.reduce((s, i) => s + Number(i.self_score), 0) / ratedCount) * 10) / 10
      : null;

  const avgOnFive =
    avgRaw !== null && maxLevel > 0 ? Math.round((avgRaw / maxLevel) * 5 * 10) / 10 : null;

  const status = deriveRegistryStatus({
    registryStatus: registryStatus ?? null,
    ratedCount,
    totalSkills,
    reviewStatus: reviewStatus ?? null,
  });

  return { loading, totalSkills, ratedCount, completionPct, avgRaw, avgOnFive, staleItemCount, status };
}

/** Convenience: build the metrics input `items` shape from a ratings map. */
export function itemsFromRatingsMap(
  ratings: Record<string, number | null | undefined>,
): { skill_id: string; self_score: number | null }[] {
  return Object.entries(ratings).map(([skill_id, self_score]) => ({
    skill_id,
    self_score: self_score === undefined || self_score === null ? null : Number(self_score),
  }));
}
