## Pre-Configured Excel Template for MCQ Upload

Enhance the bulk upload flow so users pick skills and competency levels **before** downloading the template. The generated `.xlsx` is pre-scoped to their selection — eliminating typos in `skill_name` and `competency_level`.

### UX Flow (new Step 0 in BulkUploadSheet)

Add a "Configure Template" step before "Upload File":

1. **Select Skills** — Multi-select combobox listing active skills (grouped by category, searchable). At least 1 required.
2. **Select Competency Levels** — Multi-select chips (Level 1–5, labels pulled dynamically from `competency_levels` table). At least 1 required.
3. **Download Template** button — generates a tailored `.xlsx` and advances to Step 1 (Upload).

Existing steps (Upload → Review → Import) remain unchanged.

### Template Structure (revised)

The downloaded `.xlsx` will contain **3 sheets**:

1. **`Questions`** (data entry sheet)
   - Same columns as today: `skill_name`, `topic_name`, `competency_level`, `question_text`, `option_1..option_4`, `correct_option`, `evaluation_guidelines`.
   - `skill_name` column → Excel data validation dropdown sourced from selected skills.
   - `competency_level` column → dropdown sourced from selected levels (e.g. "Level 2 - Beginner").
   - Pre-seed ~3 empty rows with dropdowns applied for the first 200 rows.

2. **`Selected Scope`** (new reference sheet)
   - Two tables:
     - **Selected Skills**: `skill_name`, `category`, `domain` (if any).
     - **Selected Competency Levels**: `level_number`, `label`, `description`.
   - Read-only reference for the author; also used as the source range for the dropdowns in `Questions`.

3. **`Instructions`** (existing) — updated text noting the dropdowns and that values outside the selected scope will be rejected on import.

### Validation on Import (Review step)

- Reject rows whose `skill_name` is not in the selected skills list (error: "Skill not in template scope").
- Reject rows whose `competency_level` is not in the selected levels (error: "Level not in template scope").
- All other current validations (required fields, exactly 4 options, single correct index 1–4, duplicate detection as warning) remain.

### Files

- **`src/lib/mcqExcel.ts`** — extend `buildTemplate()` to accept `{ skills, levels }`, add the `Selected Scope` sheet, attach `dataValidation` ranges on `skill_name` and `competency_level` columns (SheetJS `!dataValidation` / formula references to `Selected Scope` ranges).
- **`src/components/questions/BulkUploadSheet.tsx`** — add Step 0 UI (skill multi-select + level multi-select + Download button), wire selection state, gate the existing upload step behind a successful template download (or allow skip with confirm), and enforce scope validation in the review step.
- No backend, schema, or store changes.

### Out of Scope

- Pre-seeding question rows with skill/level combinations.
- Locking the `Questions` sheet against manual typing — Excel dropdowns guide but don't prevent paste-overrides; import-side validation is the safety net.
- Persisting the user's last selection across sessions.
