# Fix Assign Assessment flow

Four related issues in `AssignTemplateDialog` and `assignmentStore`:

1. Assignment fails with "Employee has not submitted a registry for this domain yet" — registry submission was made a hard prerequisite, but per spec it is **optional**.
2. The Assign UI is a centered modal — should be a **right-side Sheet** (consistent with rest of app) with a **sticky footer**.
3. No **Select All / Deselect All** control.
4. The **current user (creator)** is filtered out of the candidate list, so an admin/manager creating an assessment can't assign one to themselves.

---

## Changes

### 1. `src/stores/assignmentStore.ts` — registry no longer required

In `generateAssessmentForTemplate` (adaptive branch):

- **Remove** the hard block that returns `"Employee has not submitted a registry for this domain yet"`.
- Still attempt to look up the latest submitted registry to use its `id` as `submission_id` and to pull self-ratings when `skill_selection_mode !== 'custom'`.
- If **no submission exists**:
  - Use a synthetic `submission_id` like `tmpl-<templateId>` (mirrors the fixed branch).
  - For `skill_selection_mode === 'custom'`, proceed with the template's explicit skill list (no registry needed).
  - For default mode (registry-driven skill picking), fall back to **all skills mapped to the template's domain** via `domain_skill_mappings`, capped at `template.skills_per_assessment`. If still empty → fail with `"No skills available for this domain"`.
- Keep the existing MCQ availability pre-flight check.

The adaptive engine (`adaptiveEngineStore.ts`) already handles a missing submission gracefully (`if (submission)` guard), so runtime is safe.

### 2. `src/components/templates/AssignTemplateDialog.tsx` — Sheet + sticky footer

- Replace `Dialog`/`DialogContent`/`DialogHeader`/`DialogFooter` with `Sheet`/`SheetContent` (`side="right"`, width ~`w-[560px] sm:max-w-[560px]`).
- Layout `SheetContent` as a flex column: `flex flex-col h-full`.
  - `SheetHeader` — fixed at top (no scroll).
  - Scrollable middle region: `<div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">` containing template summary, mode tabs, domain/search inputs, candidate list, duplicates checkbox, summary line.
  - Footer: `<div className="border-t bg-background px-6 py-3 flex justify-end gap-2 shrink-0">` with Cancel + Assign buttons. Always visible.
- The candidate list inside loses its own `max-h-72` — it can grow naturally because the parent already scrolls. Keep a sensible min height for empty state.
- Rename component file usage stays the same; export name unchanged.

### 3. Select All / Deselect All

Above the candidate list, add a small toolbar row showing:

- Left: `"<n> of <total> selected"` text.
- Right: a single ghost button that toggles between **Select all** and **Deselect all** based on whether all currently visible candidates are selected.

Selection respects the current filter (search / picked domain) — only operates on `candidateUsers`.

Remove the auto-pre-select-all `useEffect` that runs when domain mode loads (it surprises the user); rely on the explicit Select all button instead. Keep `pickedUsers` reset on dialog open.

### 4. Include the creator in the candidate list

In the user fetch effect:

- **Remove** the `rows = rows.filter((u) => u.id !== user?.id)` line so the current user appears.
- Render a small `(You)` badge next to the creator's name in the row for clarity.
- Manager scope filter (`u.domain_id === user.domain_id`) is preserved — the manager's own domain assignment already includes themselves.

No store changes needed for this; assignment logic already supports any `employee_id`.

---

## Files touched

- `src/stores/assignmentStore.ts` — relax adaptive registry requirement; add domain-skill fallback.
- `src/components/templates/AssignTemplateDialog.tsx` — Sheet conversion, sticky footer, Select All toggle, include self with `(You)` badge.

No DB migration. No changes to other callers — `AssignTemplateDialog` is invoked from `AssessmentTemplatesPage` and `TeamAssessmentsPage` with the same props.

---

## Out of scope

- Reworking the registry-driven skill ranking algorithm beyond the simple "fall back to domain skills" path.
- Changing `TemplateAssignmentsSheet` (already a Sheet).
- Touching the unrelated `UsersPage` Badge ref warning visible in console logs.
