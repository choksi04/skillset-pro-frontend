## Plan: Skill Library Micro-Feature Improvements

Seven targeted changes to improve forms, topic display, delete confirmations, and dropdown styling across the Skill Library module.

---

### 1. Convert CategoryFormDialog to Sheet

**File: `src/components/skills/CategoryFormDialog.tsx**`

- Replace `Dialog/DialogContent/DialogHeader/DialogTitle` with `Sheet/SheetContent/SheetHeader/SheetTitle` from `@/components/ui/sheet`.
- Sheet opens from the right (`side="right"`), max-width `sm:max-w-md`.
- Same form fields, same validation logic — just a different container.

### 2. Navigate to new category after creation

**File: `src/pages/SkillFrameworkPage.tsx**`

- Pass a callback `onCreated?: (categoryId: string) => void` to `CategoryFormDialog`.
- In `CategoryFormDialog`, after `addCategory()` succeeds, call `onCreated(newCategoryId)`.
- In `SkillFrameworkPage`, the callback calls `navigate(\`/skill-library/{id})`.
- The store's `addCategory` must return the new category ID — update its return type from `Promise<void>` to `Promise<string>` in `skillStore.ts`.

### 3. Convert SkillFormDialog to Sheet + auto-open detail

**File: `src/components/skills/SkillFormDialog.tsx**`

- Replace `Dialog` with `Sheet` (right drawer).
- Remove the "existing tags suggestions" section below the tag input field (per requirement).
- Add `onCreated?: (skillId: string) => void` callback prop.

**File: `src/pages/CategoryDetailPage.tsx**`

- After skill creation, call `setSelectedSkill(newSkill)` to auto-open the detail drawer.
- Store's `addSkill` must return the new skill ID — update return type from `Promise<void>` to `Promise<string>`.

### 4. Convert TopicFormDialog to Sheet

**File: `src/components/skills/TopicFormDialog.tsx**`

- Replace `Dialog` with `Sheet` (right drawer).
- Same form fields, same validation.

### 5. Delete Topic confirmation alert

**File: `src/components/skills/SkillDetailDrawer.tsx**`

- Add an `AlertDialog` for topic deletion (same pattern as category/skill delete alerts).
- On click "Delete" in topic dropdown, set a `deleteTopicTarget` state instead of calling `deleteTopic` directly.
- Show confirmation dialog: "Are you sure you want to delete [topic name]?"

### 6. Topics as cards instead of table

**File: `src/components/skills/SkillDetailDrawer.tsx**`

- Replace the `Table` rendering of topics with a grid of cards.
- Each card: title (bold), description (2 lines max with `line-clamp-2`), actions dropdown in top-right corner.
- Use `title` attribute on the description `<p>` for native browser tooltip on hover.
- Layout: `grid grid-cols-1 gap-3` (cards stack vertically in the drawer).
- Card structure: `rounded-lg border border-border p-3` with title and description stacked.

### 7. Searchable Select dropdowns with proper theme colors

**File: Multiple files** — All `Select` dropdowns in Skill Library pages need to be replaced with a searchable `Command`-based popover pattern (Popover + Command from shadcn).

Create a reusable `SearchableSelect` component at `src/components/ui/searchable-select.tsx`:

- Props: `options: {value, label}[]`, `value`, `onValueChange`, `placeholder`, `className`.
- Uses `Popover` + `Command` + `CommandInput` + `CommandList` + `CommandItem`.
- Styled with theme colors (`bg-popover`, `text-popover-foreground`, `border-input`) — no green accents.

Replace `Select` usage in:

- `src/pages/SkillFrameworkPage.tsx` (status filter)
- `src/pages/CategoryDetailPage.tsx` (tag filter, status filter)
- `src/components/skills/SkillFormDialog.tsx` (status dropdown)

Status badge color can have green color to provide proper context as green for success, and so on. No need to replace green with blue or primary for status badges.

---

### Files Summary


| Action  | File                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------- |
| Rewrite | `src/components/skills/CategoryFormDialog.tsx` (Dialog → Sheet + onCreated callback)              |
| Rewrite | `src/components/skills/SkillFormDialog.tsx` (Dialog → Sheet + remove tag suggestions + onCreated) |
| Rewrite | `src/components/skills/TopicFormDialog.tsx` (Dialog → Sheet)                                      |
| Rewrite | `src/components/skills/SkillDetailDrawer.tsx` (topic cards + delete alert)                        |
| Modify  | `src/pages/SkillFrameworkPage.tsx` (navigate after create + searchable select)                    |
| Modify  | `src/pages/CategoryDetailPage.tsx` (auto-open skill detail + searchable select)                   |
| Modify  | `src/stores/skillStore.ts` (addCategory/addSkill return ID)                                       |
| Create  | `src/components/ui/searchable-select.tsx`                                                         |
