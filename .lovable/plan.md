# Redesign: My Assessments Page

Rebuild `src/pages/AssessmentsPage.tsx` to match the attached mockup — a structured table replacing the current card list, with a filter control and pagination. Keep all underlying data/logic (status derivation, attempts, assignments, templates) untouched.

## Layout

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ My Assessments                              [🔍 Search...]   [▽ Filter]     │
│ View and take your assigned skill assessments.                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ ASSESSMENT DETAILS │ FORMAT       │ ASSIGNED BY    │ STATUS & DATE │ ACTION │
├─────────────────────────────────────────────────────────────────────────────┤
│ <name>             │ ❓ N (Type)   │ 👤 Name        │ [Status]      │ [Btn]  │
│ 🏷 <domain chip>   │ ⏱ X mins     │   sub-label    │ Due/Done date │        │
└─────────────────────────────────────────────────────────────────────────────┘
              Showing 1 to N of M assessments                [« 1 2 3 »]
```

## Columns

| Column | Source | Notes |
|---|---|---|
| **Assessment Details** | template name (or "Assessment") + domain name chip | Domain resolved from `domains` store via `assessment.domain_id`. Chip uses `Layers` icon + muted bg. |
| **Format** | `assessment_questions.length` + `is_adaptive ? 'Adaptive' : 'Fixed'` and `duration_minutes` | Two stacked rows with `HelpCircle` and `Clock` icons. Show "Pending" if no questions yet. |
| **Assigned By** | resolved via existing `assignerNames` lookup; fallback "System Auto-Assign / Automated" when no `assigned_by` | Avatar (initials) + full name + small muted sub-label (role/team if available, else "Automated"). |
| **Status & Date** | `getEffectiveStatus(...)` with existing badge config | Below the badge: `Due: <created date + duration window>` for active, `Completed: <updated_at>` for approved/evaluated, `Submitted: <date>` for submitted. |
| **Action** | Status-driven button | `Not Started/In Progress` → **Start →** (primary). `Submitted/Evaluated/Under Review/Approved` → **View Results** (outline). Click navigates to `/assessments/:id`. |

## Filter control

Add a `Popover` next to search with a `Filter` icon button. Inside:
- **Status** multi-select checkboxes (Not Started, In Progress, Submitted, Evaluated, Under Review, Approved).
- **Format** radio: All / Adaptive / Fixed.
- "Clear" + "Apply" footer.

State held locally; combined with search to drive `filteredMy`.

## Pagination

- Local `page` state, `PAGE_SIZE = 10`.
- Footer row: left `Showing X to Y of Z assessments`, right shadcn `Pagination` component with prev/next + numeric pages.
- Reset to page 1 when search/filters change.

## Visual / styling

- Use shadcn `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableCell`.
- Header row: uppercase tracking-wide muted text (matches mockup).
- Rows: subtle hover (`hover:bg-muted/30`), full row clickable (action button uses `e.stopPropagation`).
- Domain chip: small rounded pill, `bg-muted text-muted-foreground`, `Layers` icon size 11.
- Avatar: shadcn `Avatar` with initials fallback (no real images — keep neutral).
- Loading: 5 skeleton rows mirroring the table structure.
- Empty state: same icon + copy as today, rendered as a single full-width row inside the table.

## Data wiring (unchanged stores)

Keep all current `useEffect` fetches: `fetchAssessments`, `fetchQuestions`, `fetchSkills`, `fetchDomains`, `fetchAttempts`, `fetchReviews`, `fetchTemplates`, `fetchAssignments`. Continue resolving assigner full names via the existing `users` lookup. Add a `domains` map lookup for the chip.

## Files

- **Edit only**: `src/pages/AssessmentsPage.tsx` (full rewrite of the render layer; preserve hooks/data flow at the top).
- No store, schema, or route changes.
- No User Guide change required (purely visual restyle of an existing page).

## Out of scope

- Team Assessments page (manager view) stays as-is.
- No new status semantics, no new DB fields, no backend changes.
