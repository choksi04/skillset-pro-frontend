# Discard Draft Registry

Add the ability to discard a draft skill registry — soft-deleting it and returning the user to their last submitted version (or the empty state if none exists).

## Behaviour

- Visible only when the current registry is in `draft` status.
- Confirmation dialog before discarding (action is destructive and irreversible).
- Discard performs a **soft delete**: sets `deleted_on = now()` and `deleted_by = currentUserId` on the `skill_registries` row. Items in `skill_registry_items` are kept untouched (orphaned but reachable via the soft-deleted parent), consistent with the project's audit policy.
- After discard, the user is routed back to `/skill-registry`. The list page already auto-features the latest submitted version when no draft exists, so the previous submission becomes the active one again.
- A toast confirms the discard.
- If the draft is the **only** registry the user has (no prior submission), the discard still works — the My Registry page falls through to the existing "Start Your First Registry" empty state.

## Where the action appears

1. **My Registry → Detail (Draft / Self Review)** — `src/pages/SkillRegistryDetailPage.tsx`
   - In the right-side `Registry Summary` panel, below the existing `Submit Registry` and `Save as Draft` buttons, add a destructive ghost-style button: `Discard Draft`.
   - Styled with `text-destructive hover:bg-destructive/10` so it reads as the destructive option but doesn't compete visually with Submit.

2. **My Registry list page** — `src/pages/SkillRegistryPage.tsx`
   - When the featured card is in draft status, add a small `Discard` outline button next to `Continue Editing` in the hero card footer (same destructive styling).

Both entry points open the same confirmation dialog and call the same store action.

## Confirmation dialog

Reuse `AlertDialog` (already in the project). Title: `Discard this draft?`. Body: `Your unsaved changes for v{N} will be permanently removed and cannot be restored. Your last submitted version will remain unchanged.`. Buttons: `Cancel` / `Discard Draft` (destructive variant).

## Store change — `src/stores/skillRegistryStore.ts`

Add a new action:

```ts
discardDraft: (registryId: string) => Promise<void>;
```

Implementation:
- Soft-delete the row: `update({ deleted_on: now, deleted_by: userId })` on `skill_registries`.
- Cancel any pending auto-save before invoking (handled by the page).
- Remove the discarded registry from local `registries` state and drop its `items` cache entry.
- No notification is emitted (drafts are private to the employee).

## Page wiring — `SkillRegistryDetailPage.tsx`

- Add `discardOpen` local state and a `handleDiscard` callback that:
  1. Clears the auto-save timeout (`saveTimeoutRef`).
  2. Calls `discardDraft(registry.id)`.
  3. Shows a success toast (`Draft discarded`).
  4. Navigates to `/skill-registry`.
- Pass `onDiscard` into `SelfReviewForm`; render the `Discard Draft` button + `AlertDialog` inside the summary panel.
- Guard: only render the button when `isDraft` is true (already the case for this view).

## Page wiring — `SkillRegistryPage.tsx`

- Reuse the same store action and an `AlertDialog`. Render the small `Discard` button only when `featured.status === 'draft'`.
- After successful discard, no navigation is needed (the list page already re-renders with the latest submitted registry as featured).

## Technical notes
- Files modified:
  - `src/stores/skillRegistryStore.ts` — new `discardDraft` action.
  - `src/pages/SkillRegistryDetailPage.tsx` — Discard button + dialog in the summary panel; cancel pending auto-save before discard.
  - `src/pages/SkillRegistryPage.tsx` — Discard button + dialog on the hero card when draft is featured.
- No DB migration required — `deleted_on`/`deleted_by` already exist on `skill_registries` and queries already filter by `.is('deleted_on', null)`.
- No routing or RLS changes.
- Memory update: append a one-liner to `mem://logic/skill-registry/independence` (or add a new `mem://features/skill-registry/discard-draft` note) describing the soft-delete semantics so future work doesn't accidentally hard-delete.
