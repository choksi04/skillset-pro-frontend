# Plan: Fix 4 Question Bank & Domain Mapping Issues

## Issue 1: Competency Levels Mismatch (5 in Registry, 4 in Questions)

The question_settings table has 5 levels (Beginner, Intermediate, Advanced, Expert, Master) but the hardcoded `competencyLevels` array in `questionStore.ts` only has 4. The question form and AI generation both use this array.

**Changes:**

- `**src/stores/questionStore.ts**`: Add `'master'` to the `CompetencyLevel` type, `competencyLevels` array, and `competencyLabels` map.
- **Database migration**: Add `'master'` to the `competency_level` enum (or verify the column accepts it — the column likely uses text, not an enum). If it's a check constraint or enum, update it.

---

## Issue 2: Domain Skill Mapping — Buffered Save with Save Button

Currently, checking/unchecking a skill in `DomainSkillManager` immediately calls `addMapping`/`removeMapping` (writes to DB). Users want a "Save" button so changes are only committed on explicit save.

**Changes in `src/components/domains/DomainSkillManager.tsx`:**

- Add local state `pendingSkillIds: Set<string>` initialized from current `mappedSkillIds` on open.
- Checkbox toggles update `pendingSkillIds` only (no store calls).
- Category checkbox toggles update `pendingSkillIds` for all category skills.
- Replace "Done" button with "Save" button that diffs `pendingSkillIds` vs `mappedSkillIds`:
  - New IDs → call `addMapping`
  - Removed IDs → call `removeMapping`
- Add a "Cancel" button that closes without saving.
- Show a dirty indicator (e.g., changed count) near the Save button.

---

## Issue 3: Preserve Previously Selected Filters in Question Form

When creating a new question (not editing), the form resets all fields. Users want skill, topic, level, and type to persist across creates.

**Changes in `src/components/questions/QuestionFormSheet.tsx`:**

- Only reset content fields (text, options, guidelines) when the sheet opens for a new question (no `editQuestion`).
- Keep `skillId`, `topicId`, `level`, and `qType` as-is when `editQuestion` is null (i.e., don't reset them in the `useEffect`).
- On first open (all empty), they'll still show placeholders — no change in initial behavior.

---

## Issue 4: Coverage Gaps — Show All, Below Filters, Respect Filters

Currently, coverage gaps are above filters and capped at 5. They should:

1. Move below the filter bar with 5 capped
2. Show all gaps in the right drawer panel with search, with lazy-loaded pagination,
3. Filter by the active skill and level filters

**Changes in `src/pages/QuestionBankPage.tsx`:**

- Move the coverage gaps section from above the filters to below them.
- Update `coverageData` memo to respect `skillFilter` and `levelFilter`:
  - If `skillFilter !== 'all'`, only show that skill.
  - If `levelFilter !== 'all'`, only flag gaps for that specific level.
- Remove the `.slice(0, 5)` limit and the "...and N more" text.
- Make the section scrollable if many gaps exist (max-height with overflow).

---

## Technical Details


| File                                             | Change                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `src/stores/questionStore.ts`                    | Add `master` to type/array/labels                                  |
| `src/components/domains/DomainSkillManager.tsx`  | Buffer selections in local state, add Save/Cancel buttons          |
| `src/components/questions/QuestionFormSheet.tsx` | Preserve skill/topic/level/type across new question creates        |
| `src/pages/QuestionBankPage.tsx`                 | Move coverage gaps below filters, remove cap, add filter-awareness |
| DB migration (if needed)                         | Ensure `competency_level` column accepts `'master'` value          |
