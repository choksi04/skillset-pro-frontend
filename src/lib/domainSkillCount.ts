/**
 * Domain skill count rule: distinct skills linked to the domain whose skill is
 * active and not deleted (deleted skills are absent from the loaded skill list).
 */
export function eligibleDomainSkillIds(
  domainId: string,
  mappings: { domain_id: string; skill_id: string }[],
  skills: { id: string; status: string }[],
): Set<string> {
  const active = new Set(skills.filter((s) => s.status === 'active').map((s) => s.id));
  return new Set(mappings.filter((m) => m.domain_id === domainId && active.has(m.skill_id)).map((m) => m.skill_id));
}
