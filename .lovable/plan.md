## Goal

Restore the **All Registries** page to show all **submitted** registries (latest version per employee), regardless of manager approval. Surface the review status alongside each row so users can tell what's been approved vs. still pending.

## Changes — `src/pages/AllRegistriesPage.tsx`

### 1. Drop the approval filter

- Remove `approvedIds` state and the `useEffect` that filters by `registry_reviews.status = 'approved'`.
- Remove `approvedRegistries` derived list.
- All downstream pipelines (items fetch, user-name fetch, latest-per-employee, skill aggregation, employee aggregation) use `submittedRegistries` directly.

### 2. Fetch review status (not as a filter, just for display)

- New `useEffect` that fetches `registry_reviews` rows for current submitted registry IDs and stores a `Map<registryId, 'approved' | 'pending'>`. Registries with no review row → treated as `pending`.

### 3. Surface status in both views

- **By Skills** view: add a small "Approved / Pending" indicator inside the employees drill-down drawer next to each employee row (since a skill aggregates many employees with different statuses).
- **By Employee** view: add a new "Status" column showing a `Badge`:
  - `Approved` — neutral/success styling
  - `Pending review` — muted/outline styling
- CSV export for the employees view includes the new Status column.

### 4. Copy updates

- Page subtitle: "Organization-wide skill registry data from latest **submitted** versions."
- Empty states revert to: "No submitted registry data found." / "No submitted employee registry data found."

5. UI enhacements
  1. In Avg. Level column there is still background hover effect, remove that. and for L1 & L3, it is showing the grayout like color for L1 & L3 only, make it better color to show properly. Refer the attached screenshot to review and refer:  


## Out of scope

- No DB schema or migration changes.
- No changes to Team Registry / approval flow.
- No filter toggle for status (kept minimal per project UI principles); can be added later if needed.