# Refactor Skill Registry: Independent, Versioned, No Assessment

## Summary

Decouple the Skill Registry from Review Cycles and Assessments. Introduce versioned registries (v1, v2, v3...) backed by new database tables. Employees can update their registry anytime, with full version history. Submission notifies the manager but does NOT trigger assessment generation.

---

## Database Changes

### New tables (via migration)

`**skill_registries**` — one row per version:


| Column                                                       | Type             | Notes                         |
| ------------------------------------------------------------ | ---------------- | ----------------------------- |
| id                                                           | uuid PK          | gen_random_uuid()             |
| tenant_id                                                    | text NOT NULL    | &nbsp;                        |
| employee_id                                                  | text NOT NULL    | &nbsp;                        |
| domain_id                                                    | text NOT NULL    | &nbsp;                        |
| version_number                                               | integer NOT NULL | Auto-incremented per employee |
| status                                                       | text NOT NULL    | 'draft' or 'submitted'        |
| submitted_at                                                 | timestamptz      | NULL until submitted          |
| created_at                                                   | timestamptz      | now()                         |
| created_by, modified_by, deleted_by, deleted_on, modified_at | audit cols       | Standard pattern              |


Constraint: unique(employee_id, version_number) — one version number per employee.
Constraint: Only ONE draft per employee (enforced via app logic + DB trigger).

`**skill_registry_items**` — ratings per version:


| Column      | Type                          | Notes             |
| ----------- | ----------------------------- | ----------------- |
| id          | uuid PK                       | gen_random_uuid() |
| registry_id | uuid FK → skill_registries.id | &nbsp;            |
| skill_id    | text NOT NULL                 | &nbsp;            |
| self_score  | integer NOT NULL              | 1-5               |
| comment     | text                          | Optional          |


RLS: permissive `true` (matching existing pattern).

Enable realtime on `skill_registries` for live status updates.

### Migration also creates:

- A trigger to enforce max ONE draft per employee
- Index on `skill_registries(employee_id, version_number)`

### Existing tables remain untouched

The old `skill_registry_submissions`, `skill_self_ratings` tables stay for backward compatibility with existing assessment/review pipelines. No data migration needed — the new module uses new tables exclusively.

---

## Store Changes

### New: `src/stores/skillRegistryStore.ts`

Clean store with no cycle/assessment dependencies:

```
State:
  registries: SkillRegistry[]
  items: Map<string, SkillRegistryItem[]>  // keyed by registry_id
  loading, initialized

Methods:
  fetchRegistries(employeeId?)     // load registries (latest first)
  fetchItems(registryId)           // lazy-load items for a version
  getLatest(employeeId)            // returns latest version
  getDraft(employeeId)             // returns current draft or null
  createNewVersion(employeeId, tenantId, domainId)  // copies latest → new draft
  saveDraft(registryId, items[])   // upsert items
  submitRegistry(registryId)       // lock + notify manager
```

On `submitRegistry`:

- Update status to 'submitted', set submitted_at
- Insert notification for domain manager with employee name, version, time

### Old `registryStore.ts` stays

Existing assessment pipeline still uses it. No changes needed there.

---

## Page Changes

### `src/pages/SkillRegistryPage.tsx` — Complete rewrite

Remove ALL imports of cycleStore, assessmentStore, attemptStore, reviewStore, questionStore.

New layout:

**Section 1: Current Registry**

- If draft exists → show card with "Continue Editing" CTA
- If latest is submitted → show card with "Create New Version" CTA
- If no registry exists → show "Start Your First Registry" CTA

**Section 2: Version History**

- Table with columns: Version (v1, v2...), Date, Status (badge), Action (View)
- Lazy-loaded, sorted newest first

**Validation before submit:**

- All domain skills must be rated → "Please rate all skills"
- No domain assigned → "No domain assigned"
- No skills in domain → "No skills configured for your domain"

**Confirmation popup** on submit (user confirmed): Dialog showing skill summary, "Confirm & Submit" button with loader when clicked.

### `src/pages/SkillRegistryDetailPage.tsx` — Rewrite

Remove cycle/assessment/review dependencies. Two modes:

- **Draft**: Self-review form with auto-save (reuse existing SelfReviewForm component pattern)
- **Submitted**: Read-only skill table showing self scores only (no assessment/final columns)

Remove: "Submit & Generate Assessment" button text → just "Submit Registry"
Remove: Success dialog mentioning assessment
Remove: "Go to Assessment" CTA

### `src/pages/TeamRegistryPage.tsx` — Update

Remove cycleStore dependency. Show all team registries grouped by employee, with version numbers. Remove assessment/final score columns (those belong to the assessment pipeline).

### `src/pages/TeamRegistryDetailPage.tsx` — Update

Remove assessment/review score cards. Show only self-score breakdown per version.

---

## Notification on Submit

When employee submits, insert into `notifications`:

```
target_user_id: domain_lead_id (from domains table)
target_role: 'manager'
message: "{employee_name} submitted Skill Registry v{version} on {date}"
type: 'registry_submitted'
reference_id: registry_id
action_link: '/team-registry/{registry_id}'
```

---

## Role-Based Access

- **Employee**: sees own registries + history at `/skill-registry`
- **Manager**: sees team registries at `/team-registry` (filtered by domain)
- **Admin**: sees all registries at `/team-registry` + `/all-registries`

No route changes needed — existing guards already handle this.

---

## Edge Cases

1. **User without domain**: Block submission, show "No domain assigned" message
2. **Domain without skills**: Block submission, show "No skills configured"
3. **Editing submitted version**: NOT allowed — status check prevents it
4. **Multiple drafts**: DB trigger prevents >1 draft per employee
5. **Create New Version**: Copies all items from latest submitted version into new draft

---

## Performance

- Load only latest registry on page mount
- Lazy-load version history (fetch on section expand or scroll)
- Items fetched per-version on detail page open

---

## Documentation Update

Update `src/pages/UserGuidePage.tsx`:

- **Employee section**: How to update skills, how versioning works (v1, v2...), draft vs submitted
- **Manager section**: How to review team skill registry updates
- Remove references to "cycle-dependent registry submission"

---

## Files Modified/Created


| File                                         | Action                                                     |
| -------------------------------------------- | ---------------------------------------------------------- |
| New migration                                | Create `skill_registries`, `skill_registry_items`, trigger |
| `src/stores/skillRegistryStore.ts`           | **New** — clean versioned store                            |
| `src/pages/SkillRegistryPage.tsx`            | **Rewrite** — remove cycle dependency                      |
| `src/pages/SkillRegistryDetailPage.tsx`      | **Rewrite** — remove assessment refs                       |
| `src/pages/TeamRegistryPage.tsx`             | **Update** — use new store                                 |
| `src/pages/TeamRegistryDetailPage.tsx`       | **Update** — use new store                                 |
| `src/components/registry/registryHelpers.ts` | **Update** — simplified status (draft/submitted only)      |
| `src/pages/UserGuidePage.tsx`                | **Update** — new instructions                              |
| `src/pages/AllRegistriesPage.tsx`            | **Update** — use new store                                 |


Existing stores (`registryStore.ts`, `cycleStore.ts`, `assessmentStore.ts`) remain unchanged — they still serve the assessment pipeline.