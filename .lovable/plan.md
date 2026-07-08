
## Diagnosis

Lovable Cloud backend is healthy (status check passed). The `57014 canceling statement due to statement timeout` errors are coming from **our own queries hitting Postgres' statement timeout**, not a provider outage.

Evidence from `pg_stat_statements` (top offenders by total time):

| Query | Calls | Mean | Max |
|---|---|---|---|
| `SELECT * FROM questions WHERE deleted_on IS NULL ORDER BY created_at` | 20,277 | 59 ms | **2827 ms** |
| `SELECT * FROM skills WHERE deleted_on IS NULL ORDER BY created_at` | 11,929 | 34 ms | 2478 ms |
| `SELECT * FROM domain_skill_mappings WHERE deleted_on IS NULL` | 16,420 | 16 ms | 2778 ms |
| `SELECT * FROM ai_evaluations WHERE attempt_id = ANY($1)` | 7,165 | 28 ms | 2105 ms |
| `SELECT * FROM attempt_answers WHERE attempt_id = ANY($1)` | 7,168 | 22 ms | 2458 ms |
| `SELECT * FROM notifications ORDER BY created_at DESC` | 8,339 | 17 ms | 2106 ms |
| `SELECT * FROM assessment_attempts ORDER BY started_at DESC` | 5,682 | 18 ms | 1976 ms |

The failing request in your screenshot (`questions?select=skill_id&skill_id=in.(…)&type=eq.mcq&status=eq.published`) is a sequential scan on `questions` filtered by `skill_id + type + status` — no supporting index, and the table has grown enough that peak latency crosses the 2s cancel threshold under load.

So: **not an outage. Missing indexes + a few over-broad fetches in our stores.**

## Plan

### 1. Add indexes (single migration)

Partial indexes scoped to `deleted_on IS NULL` where applicable to match our query patterns:

- `questions (skill_id, question_type, status) WHERE deleted_on IS NULL` — fixes the failing call
- `questions (created_at) WHERE deleted_on IS NULL`
- `skills (created_at) WHERE deleted_on IS NULL`
- `domain_skill_mappings (domain_id) WHERE deleted_on IS NULL`
- `domain_skill_mappings (skill_id) WHERE deleted_on IS NULL`
- `ai_evaluations (attempt_id)`
- `attempt_answers (attempt_id)`
- `attempt_skill_scores (attempt_id)`
- `assessment_questions (assessment_id)` (batched fetch in `assessmentStore.fetchAssessments`)
- `assessment_attempts (started_at DESC)`
- `assessment_attempts (employee_id, assessment_id)`
- `notifications (user_id, created_at DESC)` (currently unfiltered `SELECT * ORDER BY created_at`)
- `review_skill_entries (review_id)`
- `skill_registry_items (registry_id)`

All via one `supabase--migration` call. Plain `CREATE INDEX IF NOT EXISTS` (not CONCURRENTLY — migrations run in a transaction).

### 2. Tighten hot queries (frontend only, no logic change)

- **NotificationDropdown / notifications store**: filter by `user_id = auth.uid()` and add `.limit(50)` — right now we pull the whole table.
- **assessmentStore.fetchAssessments**: keep the paginated `.in()` helper but drop `select('*')` where the caller only needs a few columns (assessment list header).
- **questionStore listing on Question Bank**: verify it uses the new `(skill_id, question_type, status)` index by keeping filters in that order; no code change if selectors already match.

Only cosmetic query narrowing — no business logic touched.

### 3. Verify

- Re-run `supabase--slow_queries` after deploy; the `questions`/`skills`/`domain_skill_mappings` rows should drop off the top.
- Reload the pages in the screenshot (assessment detail, notifications) and confirm no `57014` errors in Network.

### Out of scope

- No RLS changes.
- No changes to assessment/adaptive engine, evaluation, or scoring.
- No compute resize — indexes should resolve this at current size.
