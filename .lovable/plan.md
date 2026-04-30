## Problem

In `src/pages/AssessmentTemplatesPage.tsx`, each template `Card` has an `onClick` handler that navigates to the detail/edit page. The action buttons rendered inside the card (Assign, Assignments count, Activate/Deactivate, Edit, Delete) do not stop event propagation, so clicking any of them bubbles the event up to the card and navigates instead of running the intended action.

## Fix

Stop click propagation on every interactive control inside the card, and prevent the card's navigate-on-click from firing when the user actually clicked an action. Two complementary changes:

1. **Wrap each action button's `onClick`** with `e.stopPropagation()` so the card's handler never sees the event:
   - Assign button → `setAssignFor(t)`
   - Assignments count button → `setViewAssignmentsFor(t)`
   - Activate/Deactivate button → `handleToggleStatus(t)`
   - Edit button → `navigate(...)` (still navigates, but explicitly)
   - Delete button → `setConfirmDelete(t)`

2. **Guard the Card's `onClick`** as a defense-in-depth: only navigate when the click target is not inside an interactive element. Use `(e.target as HTMLElement).closest("button, a, [role=button]")` — if it returns truthy, skip navigation.

Also ensure the `AlertDialog`, `AssignTemplateDialog`, and `TemplateAssignmentsSheet` triggers behave correctly (they already render outside the card, so no change needed there).

## Technical details

File: `src/pages/AssessmentTemplatesPage.tsx`

- Card:
  ```tsx
  onClick={(e) => {
    if ((e.target as HTMLElement).closest("button, a, [role=button]")) return;
    navigate(`/assessment-templates/${t.id}`);
  }}
  ```
- Each action button gets:
  ```tsx
  onClick={(e) => { e.stopPropagation(); <existing handler>; }}
  ```

No other files need to change. No styling, routing, or store changes.

## Verification

- Clicking the card body (title/description/meta area) → opens detail page.
- Clicking Assign → opens Assign dialog only.
- Clicking the assignments count → opens assignments sheet only.
- Clicking Activate/Deactivate → toggles status, no navigation.
- Clicking Edit → navigates to edit page (expected).
- Clicking Delete (trash) → opens confirm dialog only, no navigation.
