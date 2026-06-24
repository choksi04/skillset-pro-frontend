# Plan: Excel MCQ Upload + Demo Login

## 1. Excel MCQ Bulk Upload

A new "Upload from Excel" entry in the Question Bank toolbar. MCQs only.

### Standard Excel template

Downloadable `.xlsx` template with one sheet `Questions`:

| Column | Required | Notes |
|---|---|---|
| skill_name | yes | Must match an existing active skill (case-insensitive) |
| topic_name | no | Optional; must belong to the resolved skill if provided |
| competency_level | yes | Level name (e.g. "Beginner") or numeric order |
| question_text | yes | The MCQ stem |
| option_1 … option_6 | ≥2 required | Empty options ignored |
| correct_options | yes | Comma-separated indices (`1` or `1,3`) — single = single-answer, multiple = multi-answer |
| evaluation_guidelines | no | Free text (typically blank for MCQs per project memory) |

A second `Instructions` sheet documents each column.

### Upload + Review UX (right-side Sheet)

1. **File** — drop/select `.xlsx`; "Download template" button. Parsed client-side via SheetJS (`xlsx`).
2. **Review** — table of parsed rows with badges:
   - `Valid` (green) — ready to import
   - `Error` (red) — row-level message (unknown skill, bad level, <2 options, no correct option, etc.)
   - Inline edit for `competency_level`, `skill`, `correct_options` to fix without re-uploading.
   - Header summary: `X valid · Y errors`. Only valid rows are importable.
3. **Approve & Import** — pick default status (Draft recommended, or Published) → inserts via existing `addQuestions` store method with `question_text` serialized in the same JSON shape the MCQ form uses (`{ questionText, options:[{text,correct}], multipleAnswer }`). Toast `Imported N questions`, list refreshes.

### Validation & safety
- Hard cap 500 rows per upload.
- Skill / level resolution against in-memory stores already loaded on the page.
- Duplicate detection within the file (same skill + question_text) → warning, non-blocking.
- No backend schema changes — existing `questions` table + `addQuestions` insert path.

### Files
- `src/lib/excelTemplate.ts` (new) — build/download template, parse uploads, row validators.
- `src/components/questions/BulkUploadSheet.tsx` (new) — the 3-step sheet.
- `src/pages/QuestionBankPage.tsx` — toolbar button + sheet wiring.
- `package.json` — add `xlsx`.

## 2. Demo Login (testing only)

`LoginPage.tsx` currently shows only the Microsoft SSO button. Restore the email-based demo login that already exists in `AuthContext.login()` so the preview can be tested without publishing.

- Collapsible "Sign in with demo account" section under the SSO button.
- Quick-pick buttons for the persistent demo accounts (Admin, John Emp, John Manager) + free-form email fallback.
- Calls `useAuth().login(email)` — no backend changes.
- Matches existing memory (`auth/login-methods`): SSO primary, demo login as collapsible fallback.

### Files
- `src/pages/LoginPage.tsx` only.

## Out of scope
- CSV upload (Excel only, as confirmed).
- Coding / Scenario question import.
- Server-side parsing — all parsing client-side, no edge function.
