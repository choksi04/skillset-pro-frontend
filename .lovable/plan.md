## Goal
Force admins to manually pick skills when creating an adaptive assessment template. The "Top N skills (auto-pick)" option will be visible but disabled with a "Coming Soon" label, preventing confusion until the auto-pick logic is properly defined.

## Changes

**File: `src/pages/AssessmentTemplateEditPage.tsx`**

1. Default `skillMode` initial state from `'top_n'` → `'custom'` (line 56).
2. When loading an existing template, if `skill_selection_mode` is `'top_n'` or null, default to `'custom'` (line 90).
3. In the Skill Selection Mode dropdown (lines 313–321):
   - Make `top_n` SelectItem `disabled` and append a "Coming Soon" badge to its label.
   - Reorder so `custom` appears first as the default/active option.
   - Relabel "Custom (pick specific skills)" to just "Manual (pick specific skills)" for clarity.

## Out of scope
- No DB schema changes — `top_n` remains a valid enum for future use.
- No changes to runtime adaptive engine logic.
- Existing templates already saved with `top_n` will be auto-coerced to `custom` on edit (admin must re-save and pick skills).
