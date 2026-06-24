## Two Upload Modes + Fix False "Out of Scope" Errors

### Problem
1. The current flow forces every user through Step 0 (select skills + levels) before they can upload. Real users download the template, fill it offline over days, then come back to upload — by then the original scope is irrelevant.
2. Even when "JavaScript" is clearly in both the skill list and the file, the importer flags it as "not in this template's scope". Root cause: the upload step always reuses the in-memory `scope` state from Step 0 to validate, so any mismatch (different casing of selection, skill re-fetched with a new `id`, or skipping Step 0 entirely) triggers the scope error — even though the skill exists and is active.

### Fix — Mode Picker on Step 0

Replace the single "Configure Template" step with a two-choice entry screen:

```text
┌─ How do you want to upload? ─────────────────┐
│  ○ Upload a file I already have              │
│      → goes straight to Step 1 (Upload)      │
│  ○ Download a fresh template                 │
│      → opens skill + level selectors,        │
│        Download button, then Step 1          │
└──────────────────────────────────────────────┘
```

- **Direct Upload mode**: no scope is captured. Validation uses the full active skill list and full active competency-level list. No "not in template's scope" errors are possible.
- **Download Template mode**: same selectors as today; the generated `.xlsx` carries the chosen skills/levels on the `Selected Scope` sheet. On upload, validation again uses the full active skill/level lists — the scope sheet is purely a reference for the author, not an import-time restriction.

The user can switch modes at any time via a small "Change mode" link on the upload step.

### Fix — Remove Hard Scope Enforcement on Import

In `parseMcqWorkbook`:
- Drop the `scope?: TemplateScope` parameter usage that promotes "outside scope" to an **error**.
- A skill or level that resolves successfully against the active lists is always accepted, regardless of what was on the template sheet.
- If we still want gentle feedback, surface "Not in the template's selected scope" only as a **warning** (yellow), never as an error that blocks import. Default: skip the warning too, since templates may be days old.

This eliminates the "JavaScript not in scope" false negative entirely.

### Files

- **`src/components/questions/BulkUploadSheet.tsx`**
  - Replace Step 0 content with a mode picker (`'direct' | 'template'`).
  - Template mode reveals the existing skill/level selectors + Download button, then advances to Upload.
  - Direct mode advances straight to Upload.
  - Stop passing `scope` into `parseMcqWorkbook`.
  - Add "Change mode" affordance on Upload step.

- **`src/lib/mcqExcel.ts`**
  - Remove `scope` parameter from `parseMcqWorkbook` (or keep it for an optional non-blocking warning only).
  - Delete the `scopedSkillIds` / `scopedLevelIds` error branches.
  - `downloadMcqTemplate(scope)` stays unchanged — it's only relevant in template mode.

### Out of Scope
- Persisting last-used selections.
- Locking the Questions sheet against typing.
- Changing the template file structure.

### Result
- Users with an old template just hit "Upload a file I already have" and import succeeds as long as skills/levels are still active in the system.
- Users who want guardrails before authoring choose "Download a fresh template" and get the dropdown-loaded `.xlsx`.
- "JavaScript not in scope" no longer appears when the skill genuinely exists.
