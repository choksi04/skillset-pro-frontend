/** Domains a manager may view: domains they lead plus their own assigned (home) domain. */
export function getManagerDomainIds(
  user: { id: string; domain_id: string | null } | null,
  domains: { id: string; domain_lead_id?: string | null }[],
): Set<string> {
  if (!user) return new Set();
  const ids = new Set(domains.filter((d) => d.domain_lead_id === user.id).map((d) => d.id));
  if (user.domain_id) ids.add(user.domain_id);
  return ids;
}
