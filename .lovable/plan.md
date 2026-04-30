# Redesign Team Registry Detail page

Rebuild `src/pages/TeamRegistryDetailPage.tsx` to match the attached mockup: a manager-facing review of an employee's submitted Skill Registry, with a per-skill side-by-side comparison of the employee self-assessment and the manager's evaluation, plus a single "Approve & Finalize" action.

The "Request Changes" button is **hidden** for this iteration (mockup includes it as a secondary action; we'll leave a comment in code for future wiring).

## Layout (top to bottom)

```text
← Back to Team Registries
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◐ Alice Chen   [Pending Review]                  [ Approve & Finalize ]      │
│   Senior Frontend Eng · Frontend Engineering Registry                         │
│                                                                              │
│ TOTAL SKILLS  |  COMPLETION       |  EMPLOYEE AVG  |  MANAGER AVG (DRAFT)    │
│      12       |  100% (12/12)     |     ★ 4.2      |        ★ 4.0            │
└──────────────────────────────────────────────────────────────────────────────┘

Skill Review Breakdown
Compare employee self-assessments with your evaluation.

┌────────── JavaScript / TypeScript ───────────────────────────────────────────┐
│  Languages                                                                   │
│ ┌─────────── Employee Assessment ────────┬───── Manager Review ────────────┐ │
│ │ ◐ Employee Assessment      4.5 / 5.0   │ ◯ Manager Review   Score: [4.5▾]│ │
│ │ ▰▰▰▰▰▰▰▰▰▱                             │                                 │ │
│ │ "Strong proficiency in ES6+, ..."      │ Agreed. Consistent high-quality │ │
│ │                                        │ contributions in our React code.│ │
│ └────────────────────────────────────────┴─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
... one card per skill, grouped under category subtitles ...
```

Alogn with TOTAL SKILLS  |  COMPLETION       |  EMPLOYEE AVG  |  MANAGER AVG (DRAFT) , show two more data, such as "Top Rated Skill, and Lowest Rated Skill with rates"

## Header band

- Back link: `← Back to Team Registries`.
- Avatar (initials chip) + employee name + status pill:
  - `Pending Review` (warning) if registry is submitted and not yet approved.
  - `Approved` (success) once finalized.
- Subtitle: `{designation} · {Domain} Registry`.
- Right side: only `Approve & Finalize` (primary). `Request Changes` is **omitted** for now (TODO comment left in code).
- Stat strip below header (4 small KPIs, no card backgrounds, label uppercase + value):
  1. **Total Skills** — count of skills mapped to the registry's domain.
  2. **Completion** — `% (X/Y)`.
  3. **Employee Avg** — star + value scaled to /5 (`avg / maxLevel * 5`).
  4. **Manager Avg (Draft)** — star + value computed from currently entered manager scores; falls back to employee avg if manager hasn't rated yet.

## Per-skill cards

- Skills are grouped by category. Render each skill as a single rounded card with:
  - **Title row**: `Skill name` (bold), category subtitle muted.
  - **Two-column body** (1fr / 1fr; stacks on small screens):
    - **Employee Assessment** (left): icon + label, score on the right (`X.X / 5.0`), thin progress bar below, then employee's comment as italic muted text. Read-only.
    - **Manager Review** (right): icon + label, `Score:` label + numeric `Select` dropdown on the right (options pulled from `competency_levels`, displayed as numeric levels — same shape as employee scale). Below: editable single-line `Input` for the manager's comment, placeholder `+ Add Notes` styled muted when empty (renders as a button-link that focuses the input on click).
- Save behaviour: debounced auto-save per field (score on change; comment 600 ms after typing stops). Show subtle "Saved" state via toast suppression — just rely on store-driven values.

## Approve & Finalize

- Confirms in an `AlertDialog`: `Finalize this registry review? Your scores and notes will be saved as the manager-validated record. This cannot be undone.`.
- On confirm: updates the registry to `approved`, persists final manager scores/comments, sends a notification to the employee, and navigates back to `/team-registry`.
- Disabled if the registry is not `submitted` or already approved.

## Data model — new tables

Two new tables are needed. Manager edits are persisted at the granularity of a registry version, so a returning manager can resume their draft.

1. `registry_reviews` — one per `skill_registries.id`:
  - `id uuid PK`
  - `tenant_id text not null`
  - `registry_id uuid not null` (FK-by-convention to `skill_registries.id`)
  - `reviewer_id text not null`
  - `status text not null default 'pending'` (`pending` | `approved`)
  - `overall_comment text default ''`
  - `created_by`, `created_at`, `modified_by`, `modified_at`, `deleted_by`, `deleted_on` — standard audit columns
  - `completed_at timestamptz`
  - **Unique** `(registry_id)` so only one active review per version.
  - RLS: `Allow all` (MVP convention).
2. `registry_review_items` — one per skill in that review:
  - `id uuid PK`
  - `review_id uuid not null` (FK-by-convention to `registry_reviews.id`)
  - `skill_id text not null`
  - `manager_score integer` (nullable until set; 1..maxLevel)
  - `manager_comment text default ''`
  - `created_at`, `modified_at`
  - **Unique** `(review_id, skill_id)`.
  - RLS: `Allow all`.

A registry is considered "approved" when `registry_reviews.status = 'approved'`. The status pill in the header reads from this row; if no row exists yet, the manager is starting fresh and we lazy-create the review row on first edit.

The previous `manager_reviews` table (assessment-driven) stays untouched — it's a different flow (assessment scoring), not registry approval.

## Store changes

Add `src/stores/registryReviewStore.ts` (Zustand) with:

- `fetchReviewForRegistry(registryId)` — selects the review row + items.
- `ensureReview(registryId, reviewerId, tenantId)` — returns existing or inserts new pending row.
- `setItemScore(reviewId, skillId, score)` — upsert into `registry_review_items`.
- `setItemComment(reviewId, skillId, comment)` — upsert.
- `approveReview(reviewId, employeeId, tenantId)` — set status `approved`, completed_at; insert a `notifications` row for the employee.

State is kept in maps keyed by `registry_id` so the page can re-mount without refetching.

## Page wiring (`TeamRegistryDetailPage.tsx`)

- Replace the current accordion layout with the design above.
- On mount: fetch employee meta (`full_name`, `designation`), domains, skills, registry items, and the `registry_review` row.
- Maintain local `managerScores` and `managerComments` mirrors of the store; debounce writes.
- Manager Avg (draft) recomputes live from the local mirrors.
- Approve action triggers `AlertDialog`, then `approveReview`.
- Hide the Score select / comment input when the registry is already `approved`; show the saved manager values as read-only chips.

## Technical notes

- Files added:
  - `src/stores/registryReviewStore.ts`
- Files modified:
  - `src/pages/TeamRegistryDetailPage.tsx` — full rewrite
- Migrations:
  - Create `registry_reviews` and `registry_review_items` tables with `Allow all` RLS, audit columns, and the unique constraints listed above.
- No route, navigation, or other store changes.
- Reuses existing primitives: `Card`, `Badge`, `Select`, `Input`, `Button`, `AlertDialog`, `Progress`, `Tooltip`. No new deps.
- Avatar uses initials in `bg-primary/10 text-primary`. All colors via semantic tokens (no raw hex).
- A new memory note will be added: `mem://features/team-registry/manager-review-of-registry` describing this approval flow (distinct from the assessment-driven `manager_reviews`).