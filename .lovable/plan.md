# Fix Template Detail Header + Revamp Fixed-Type Question Picker

## 1. Header (PageHeader) shows "Page" on template routes

`src/components/layout/PageHeader.tsx` has no entry for `/assessment-templates/...`, so the breadcrumb falls back to `"Page"`. We'll fix this for both new and edit routes, and let the edit page push a live title.

### Changes

**`src/components/layout/PageHeader.tsx`**
- Add `'/assessment-templates': { group: 'Settings', title: 'Assessment Templates' }` (already there — keep).
- Add detection for `/assessment-templates/...` detail routes:
  - If path is `/assessment-templates/new` → breadcrumb: `Settings › Assessment Templates › New Template`.
  - If path is `/assessment-templates/:id` → breadcrumb: `Settings › Assessment Templates › <live title>`.
- Read the live title from a tiny shared store (new file `src/stores/pageTitleStore.ts`) — a Zustand store with `{ title: string | null, setTitle }`. Header subscribes; pages set/clear it.

**`src/stores/pageTitleStore.ts` (new)**
- Minimal Zustand store exposing `pageTitle` and `setPageTitle`. Used as a generic override for the last breadcrumb segment.

**`src/pages/AssessmentTemplateEditPage.tsx`**
- On mount: if `isNew`, `setPageTitle(name.trim() || "New Assessment Template")`; if editing, set it to the loaded template name.
- On every `name` change (and after load), update the store so the breadcrumb updates as the user types. Default to `"New Assessment Template"` (new) or `"Edit Template"` (edit) when name is empty.
- On unmount: `setPageTitle(null)` to restore default behavior.

## 2. Revamp Fixed-type question picker

Replace the inline search list inside the Fixed Configuration card with a clean drawer-based flow.

### New UX

- Card shows: **`+ Add Questions`** button + the list of currently selected questions (formatted, not raw JSON).
- If selected count > 15, show only the first 15 with a **`View all (N)`** link that opens a separate read-only/manage drawer.
- Selected-question card per item shows:
  - Position number, rendered question text (via `getQuestionPreviewText`)
  - Skill name badge, competency level label badge, type badge
  - `X` button to remove
- Empty state: "No questions added yet. Click Add Questions to start."

### Drawer A — "Add Questions" picker (right side Sheet)

- Opens via the `Add Questions` button.
- Header: "Add Questions" + selected count chip.
- Filter bar (sticky top): Search input, Skill select, Competency level select, Question type select, Reset.
- Result list (virtualized scroll area):
  - Each row = checkbox + question preview text + skill/level/type badges + small chevron to expand.
  - Expand reveals: full question body (markdown-fence stripped), and for MCQ — list of options with the correct one highlighted; for Coding — problem statement; for Scenario — scenario body. Uses `parseQuestionContent` from `src/lib/questionContent.ts` plus a small inline MCQ option extractor (mirrors `parseQuestionText` in QuestionBankPage).
- Footer: `Cancel` and `Save (N selected)`. Save commits selections back to `pickedQuestions` and closes the drawer. Cancel discards local changes.
- State is buffered locally so toggling inside the drawer doesn't mutate the page until Save.

### Drawer B — "View all selected" manager (right side Sheet)

- Opens via `View all (N)` when selected > 15.
- Header: "Selected Questions (N)".
- Search input only (filters the already-selected list by question text / skill name).
- Each row shows the same formatted preview (text + badges) with an `X` to remove (mutates `pickedQuestions` immediately).
- Footer: `Done` (just closes).

### Implementation files

**`src/components/templates/QuestionPickerSheet.tsx` (new)** — Drawer A.
- Props: `open`, `onOpenChange`, `initialSelectedIds: string[]`, `onSave(ids: string[])`.
- Pulls `questions`, `skills`, `competencyLevels` from existing stores.
- Filters: search + skill + level + type. Only `status === 'published'` questions.
- Uses `Sheet` from `@/components/ui/sheet` with `side="right"` and `className="w-full sm:max-w-2xl"`.
- Each row uses `Collapsible` to expand/collapse details.
- Renders question body and MCQ options using a small local `formatQuestion(q)` helper that returns `{ display, options?: {text, correct}[], problemStatement? }`.

**`src/components/templates/SelectedQuestionsSheet.tsx` (new)** — Drawer B.
- Props: `open`, `onOpenChange`, `selectedIds`, `onRemove(id)`.
- Search-only filter.

**`src/components/templates/SelectedQuestionRow.tsx` (new, small)** — shared row used in the page card and in Drawer B (formatted preview + badges + remove button).

**`src/lib/questionFormat.ts` (new, small)** — extract a single helper:
- `formatQuestionForDisplay(question)` → `{ display: string, options?: {text: string, correct: boolean}[], problemStatement?: string }`. Wraps `parseQuestionContent` + the MCQ option extraction logic that currently lives privately inside `QuestionBankPage.tsx` so both the picker drawer and any future caller share it. The existing `parseQuestionText` in QuestionBankPage stays (unchanged for now) to limit blast radius.

**`src/pages/AssessmentTemplateEditPage.tsx`**
- Remove the inline "Add Questions" search list block (lines ~491–536).
- Replace the "Selected Questions" block with a card section: header + `Add Questions` button + grid of `SelectedQuestionRow` (collapsed at 15 + `View all` link).
- Wire two `useState` flags: `pickerOpen`, `viewAllOpen`.
- Render `<QuestionPickerSheet />` and `<SelectedQuestionsSheet />` at the bottom of the page.
- Keep all existing save/validation logic untouched.

## Out of scope

- Adaptive-template skill picker (already drawer-free and acceptable).
- Changes to question authoring or question store schema.
- No DB migrations — pure UI/UX.

## Files touched

- New: `src/stores/pageTitleStore.ts`
- New: `src/lib/questionFormat.ts`
- New: `src/components/templates/QuestionPickerSheet.tsx`
- New: `src/components/templates/SelectedQuestionsSheet.tsx`
- New: `src/components/templates/SelectedQuestionRow.tsx`
- Edit: `src/components/layout/PageHeader.tsx`
- Edit: `src/pages/AssessmentTemplateEditPage.tsx`
