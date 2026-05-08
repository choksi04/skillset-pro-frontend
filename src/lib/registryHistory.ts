import type { SkillRegistry, SkillRegistryItem } from '@/stores/skillRegistryStore';

/**
 * Returns the latest APPROVED submitted registry per employee.
 * Assumes `registries` is pre-sorted by version_number desc (skillRegistryStore does this).
 */
export function getLatestApprovedPerEmployee(
  registries: SkillRegistry[],
  reviewStatuses: Record<string, string | undefined>,
): Map<string, SkillRegistry> {
  const out = new Map<string, SkillRegistry>();
  registries.forEach((r) => {
    if (r.status !== 'submitted') return;
    if (reviewStatuses[r.id] !== 'approved') return;
    if (out.has(r.employee_id)) return;
    out.set(r.employee_id, r);
  });
  return out;
}

/**
 * Returns the previous approved registry per employee — i.e. the second-most-recent
 * approved version. Used for delta calculations vs the latest approved.
 */
export function getPreviousApprovedPerEmployee(
  registries: SkillRegistry[],
  reviewStatuses: Record<string, string | undefined>,
): Map<string, SkillRegistry> {
  const out = new Map<string, SkillRegistry>();
  const seen = new Map<string, number>();
  registries.forEach((r) => {
    if (r.status !== 'submitted') return;
    if (reviewStatuses[r.id] !== 'approved') return;
    const seenCount = seen.get(r.employee_id) ?? 0;
    if (seenCount === 1) out.set(r.employee_id, r);
    seen.set(r.employee_id, seenCount + 1);
  });
  return out;
}

/**
 * Builds a Map keyed by `${employeeId}|${skillId}` → self_score, drawn from the
 * provided registry-per-employee map.
 */
export function levelByEmployeeSkill(
  registriesByEmployee: Map<string, SkillRegistry>,
  items: Map<string, SkillRegistryItem[]>,
): Map<string, number> {
  const out = new Map<string, number>();
  registriesByEmployee.forEach((reg, employeeId) => {
    const its = items.get(reg.id) ?? [];
    its.forEach((i) => {
      if (i.self_score === null || i.self_score === undefined) return;
      out.set(`${employeeId}|${i.skill_id}`, i.self_score);
    });
  });
  return out;
}

/** Average level across all entries in a per-employee registry map. */
export function avgLevelAcrossRegistries(
  registriesByEmployee: Map<string, SkillRegistry>,
  items: Map<string, SkillRegistryItem[]>,
): number | null {
  let sum = 0;
  let n = 0;
  registriesByEmployee.forEach((reg) => {
    (items.get(reg.id) ?? []).forEach((i) => {
      if (i.self_score === null || i.self_score === undefined) return;
      sum += i.self_score;
      n += 1;
    });
  });
  return n === 0 ? null : sum / n;
}
