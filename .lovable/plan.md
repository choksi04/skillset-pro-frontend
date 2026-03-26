

## Plan: Question Bank UX Improvements

Three changes: add AI/Manual source filter, improve AI preview to show only question titles (click to expand), and redesign the detail sheet with proper formatting per question type.

---

### 1. Add "Source" Filter (AI vs Manual)

**File:** `src/pages/QuestionBankPage.tsx`

- Add a new filter dropdown next to existing filters with options: All Sources, AI Generated, Manual
- Add state `sourceFilter` (`'all' | 'ai' | 'manual'`)
- Update the `filtered` memo to include `sourceFilter` check against `q.ai_generated`

---

### 2. Simplify AI Generation Preview

**File:** `src/pages/QuestionBankPage.tsx`

Currently the AI preview section (lines 358-378) shows raw question text including MCQ options as plain text. Changes:

- Show only the question title (extracted via `parseQuestionText`) as a one-line preview
- Add an expandable detail view (click to expand) that renders the full question with proper formatting:
  - **MCQ**: Show options as styled list items with correct answer indicator (green highlight + checkmark)
  - **Scenario**: Show question text + evaluation guidelines in labeled sections
  - **Coding**: Show problem statement + example I/O in code blocks
- Keep the accept/reject checkbox on the collapsed row

---

### 3. Redesign Question Detail Sheet

**File:** `src/pages/QuestionBankPage.tsx` (the `QuestionDetailSheet` component, lines 604-698)

Enhance the detail view with proper visual formatting:

**Scenario type:**
- Render question text in a styled card/section with proper paragraph spacing
- Render evaluation guidelines in a separate bordered section with a distinct background
- Parse markdown-like formatting (bullet points, numbered lists) if present

**MCQ type:**
- Already has decent option rendering — keep it but ensure it works for AI-generated questions where `parsed` might be null (fallback: try to parse the raw text)

**Coding type:**
- Problem statement in a readable card section
- Example Input/Output in `pre`/`code` blocks styled like a terminal/code editor with monospace font, dark background
- Show both even when only one exists (not nested inside `exampleInput` check)

**General improvements:**
- Add a "Source" badge (AI Generated / Manual) — already present
- Add created date display
- Add skill category breadcrumb context

---

### Technical Details

- All changes in a single file: `src/pages/QuestionBankPage.tsx`
- No database changes needed
- No store changes needed
- Reuses existing `parseQuestionText` helper and UI components (Badge, Sheet, etc.)

