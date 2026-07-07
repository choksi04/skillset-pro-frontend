import { supabase } from '@/integrations/supabase/client';

export interface SelfRating {
  skill_id: string;
  rating: number;
}

/**
 * Load the employee's latest self-ratings from `skill_registry_items`.
 * Prefers a registry scoped to `domainId` when provided, otherwise picks the
 * most recent non-deleted registry (submitted > draft, latest version first).
 *
 * Returns an empty array if no registry exists — callers should apply their
 * own fallback (e.g. domain skills at a default level) rather than assuming
 * every skill has a rating.
 */
export async function getLatestSelfRatings(
  employeeId: string,
  domainId?: string,
): Promise<SelfRating[]> {
  if (!employeeId) return [];

  let query = supabase
    .from('skill_registries')
    .select('id, status, version_number, submitted_at, created_at')
    .eq('employee_id', employeeId)
    .is('deleted_on', null);

  if (domainId) query = query.eq('domain_id', domainId);

  const { data: regs, error } = await query;
  if (error || !regs || regs.length === 0) return [];

  // Prefer submitted, then highest version_number, then latest created.
  const sorted = [...regs].sort((a: any, b: any) => {
    const sa = a.status === 'submitted' ? 1 : 0;
    const sb = b.status === 'submitted' ? 1 : 0;
    if (sa !== sb) return sb - sa;
    if ((b.version_number ?? 0) !== (a.version_number ?? 0)) {
      return (b.version_number ?? 0) - (a.version_number ?? 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const registryId = (sorted[0] as any).id;
  const { data: items, error: iErr } = await supabase
    .from('skill_registry_items')
    .select('skill_id, self_score')
    .eq('registry_id', registryId);

  if (iErr || !items) return [];

  return items
    .filter((i: any) => i.self_score !== null && i.self_score !== undefined)
    .map((i: any) => ({ skill_id: i.skill_id, rating: Number(i.self_score) }));
}

/** Build a `skill_id -> rating` map from the latest self-rating rows. */
export async function getLatestSelfRatingMap(
  employeeId: string,
  domainId?: string,
): Promise<Record<string, number>> {
  const rows = await getLatestSelfRatings(employeeId, domainId);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.skill_id] = r.rating;
  return out;
}
