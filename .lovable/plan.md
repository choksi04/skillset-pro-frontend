## Workstream 1 — next atomic fix: unify dashboard status call sites

### Current state (verified by reading the code)

Three dashboard call sites derive registry status themselves instead of using the shared metrics helper now used by Team Registry and the registry detail pages:

| Call site | Line(s) | How status is derived today |
|---|---|---|
| `EmployeeDashboard.tsx` | 100-117 | `deriveRegistryStatus` directly; denominator = **all** mappings for the user's domain (no active-skill filter); rated count = any non-null `self_score`, including `0` |
| `ManagerDashboard.tsx` | 125-154 | `deriveRegistryStatus` directly; denominator = `mappings.filter(domain_id === managerDomain).length` (no active-skill filter); same loose rated count |
| `DomainReadiness.tsx` | 89-101 | `deriveRegistryStatus` directly; denominator = `totalSkillsByDomain` prop, built in `AdminDashboard.tsx` (463-467) by counting **all** mappings per domain |

Team Registry (`TeamRegistryPage.tsx`, 148-161) instead uses `computeRegistryMetrics` with `domainSkillIds` filtered to skills whose `status === 'active'`, treats `self_score > 0` as rated, excludes stale items, and exposes a `loading` flag so nothing renders before items arrive.

**Root cause in simple terms:** dashboards count *every* mapped skill (including inactive/unmapped-but-stale ones) as required, and count `0` scores as rated, and render before item data has loaded. That inflates the denominator, so a submitted registry can fall into the `ratedCount < totalSkills` branch and display **Incomplete** (or a stale **Draft**) while the registry pages correctly show **Review Pending**.

Note: `/dashboard` currently renders the "under construction" card, so these three components are not mounted today. The fix is still applied so the widgets are correct when the dashboard is re-enabled.

### Changes

1. **`src/components/dashboard/employee/EmployeeDashboard.tsx`**
   - Filter `domainSkillIds` to active skills (`skills` is already in scope from `useSkillStore`).
   - Replace the inline `deriveRegistryStatus` block with `computeRegistryMetrics({ registryStatus, items: items.get(currentRegistry.id), domainSkillIds, maxLevel, reviewStatus })` and use `metrics.status`.
   - When `metrics.loading` is true, render a `Skeleton` in place of the `RegistryStatusBadge` (line 288) and skip status-driven action items, so no premature Draft/Incomplete appears.

2. **`src/components/dashboard/manager/ManagerDashboard.tsx`**
   - Build `domainSkillIds` for the manager's domain filtered to active skills, and derive each member's status via `computeRegistryMetrics` inside `latestPerMember` (keeping the existing `{ registry, status }` shape so downstream action-list code is untouched).
   - Skip a member's "stale registry" nudge while that member's metrics are still loading.

3. **`src/components/dashboard/admin/DomainReadiness.tsx`**
   - Accept `domainSkillIdsByDomain: Map<string, string[]>` in place of `totalSkillsByDomain` and derive each employee's bucket via `computeRegistryMetrics`, skipping rows whose metrics are still loading.

4. **`src/components/dashboard/admin/AdminDashboard.tsx`**
   - Replace the `totalSkillsByDomain` memo with `domainSkillIdsByDomain`, built from `mappings` filtered to active skills, and pass it to `DomainReadiness`.

No other component, store, query, or helper changes. `registryMetrics.ts` / `registryStatus.ts` stay as-is.

### Behavior after the fix

- A submitted, fully rated registry shows **Review Pending** on the employee, manager, and admin dashboards — never Draft or Incomplete.
- Inactive skills mapped to a domain no longer inflate the required-skill count, so genuine completion matches the Team Registry row.
- Dashboard status pills render a skeleton until registry items load, instead of flashing an incorrect status.

### Issue coverage

- **Issue 22 (status differs across views)** — extended to dashboards; completes the status-parity work.
- **Issues 17 / 18 (completion + average inconsistency)** — partially, via the shared denominator on dashboards.
- **Issue 21** — unchanged (My Registry detail, handled in a later step).

### Remaining in Workstream 1

1. Verify the My Registry detail badge uses `metrics.status`.
2. Verify All Registries uses the latest submitted version per employee, organization-wide.

### Manual test steps

Employee: `/dashboard` (once re-enabled) — after submitting a registry, the header pill must read Review Pending and match `/skill-registry`.

Manager: dashboard team list — no member with a submitted registry shows Incomplete; each member's pill matches their row in `/team-registry`.

Admin: Domain Readiness bars — the "approved / total" counts and the segment split match the status badges in `/team-registry` for the same domain; filtering by a domain keeps them consistent.
