# Redesign: Team Assessments Page

Rebuild `src/pages/TeamAssessmentsPage.tsx` as a structured table matching the mockup, mirroring the new My Assessments visual language. Keep all existing data, manager-domain filtering, and "Assign from Template" behaviour intact.

## Layout

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Team Assessments                            [🔍 Search...] [▽ Filter] [+ Assign]     │
│ Track and review your team's ongoing and completed skill assessments.                │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ EMPLOYEE        │ ASSESSMENT INFO  │ FORMAT DETAILS │ SKILL LEVEL │ STATUS │ ACTION  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ 👤 Name         │ <Template>       │ ❓ N Qs (Type) │ Advanced    │ [badge]│ [Btn]   │
│   designation   │ 🏷 <Domain>      │ ⏱ X mins      │ ✓ Verified  │        │         │
└──────────────────────────────────────────────────────────────────────────────────────┘
              Showing 1 to N of M assessments                       [« 1 2 3 »]
```

## Columns


| Column              | Source                                                                                                                                                                                                                                                | Notes                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employee**        | `users.full_name` + `users.designation`                                                                                                                                                                                                               | Avatar with initials. Sub-line muted, falls back to "—" if no designation.                                                                         |
| **Assessment Info** | template name + domain chip                                                                                                                                                                                                                           | Same `Layers` chip style as My Assessments.                                                                                                        |
| **Format Details**  | `assessment_questions.length` "Qs" + `(Adaptive|Fixed)` and `duration_minutes`                                                                                                                                                                        | Two-line stacked with `HelpCircle` and `Clock`.                                                                                                    |
| **Skill Level**     | derived from latest attempt's `total_ai_score` mapped through `competency_levels.score_range_*` to a level label. Below: ✓ "Verified" if a `manager_reviews` row for this assessment is `completed`, else ⚠ "Unverified". `N/A` when no attempt yet.  | Use `scoreToLevel` helper from `competencyLevelStore`. Verified pill = success tone, Unverified = muted.                                           |
| **Status**          | `getEffectiveStatus(...)` with shared `assessmentStatusConfig` badge.                                                                                                                                                                                 | Same canonical status lifecycle.                                                                                                                   |
| **Action**          | Status-driven primary button: • `Not Started` → **Send Reminder** (outline + Bell icon) • `In Progress` / `Submitted` → **View Progress** (outline) • `Evaluated` / `Under Review` → **Review →** (primary) • `Approved` → **View Results** (outline) | Click navigates to `/team-assessments/:id`. Reminder button uses `e.stopPropagation` and inserts a notification (see below) instead of navigating. |


## Send Reminder

When the action is `Send Reminder`:

- Insert a `notifications` row: `target_role: 'employee'`, `target_user_id: a.employee_id`, `type: 'assessment_reminder'`, `reference_id: a.id`, `action_link: '/assessments/${a.id}'`, message `Reminder: please complete your assessment "<name>"`.
- Toast `"Reminder sent to <employee name>"`.
- Disable the button briefly to prevent double-fires.
- Fully self-contained — no new store needed; uses `supabase.from('notifications').insert(...)` (matches pattern in `assignmentStore.createAssignments`).

## Filter popover

Same pattern as My Assessments. Sections:

- **Status** (multi-select): Not Started, In Progress, Submitted, Evaluated, Under Review, Approved.
- **Format** (radio): All / Adaptive / Fixed.
- **Verification** (radio): All / Verified / Unverified.
- "Clear" footer button.

## Pagination

`PAGE_SIZE = 10`, shadcn `Pagination`, `Showing X to Y of Z assessments` summary, resets on filter/search change. Same component used in My Assessments.

## Visual / styling

- Wrap table in a `rounded-xl border bg-card` card; header row uses `bg-muted/40` with uppercase tracking-wider muted labels.
- Cells `align-top`; rows clickable with `hover:bg-muted/30`.
- Avatar: shadcn `Avatar` + `AvatarFallback` initials.
- Verified pill: green check + "Verified"; Unverified: amber alert + "Unverified".
- Loading: 5 skeleton rows.
- Empty state inside table colspan when no rows match.

## Data wiring (existing stores)

- Continue fetching the same set of stores in one `useEffect`.
- Extend the existing `users` lookup to include `designation` along with `full_name, domain_id`.
- Add `competency_levels` via `useCompetencyLevelStore` (already used elsewhere) to translate scores → level label.
- Manager visibility logic (filter by employee's `domain_id`) stays unchanged.

## Files

- **Edit**: `src/pages/TeamAssessmentsPage.tsx` (full render rewrite; preserve fetch hooks and manager-scope filter at top).
- No store/schema/route changes.

## Out of scope

- No changes to detail page (`/team-assessments/:id`), AssignTemplateDialog, or any review logic.
- No new database migrations; reminder reuses existing `notifications` table & pre-declared `assessment_reminder` type.