## Verification plan: confirm 57014 timeouts are gone on assessment pages

Goal: prove the new indexes actually eliminate the `canceling statement due to statement timeout` errors on the assessment surfaces, not just look good on paper.

### 1. Confirm indexes are live
- Query `pg_indexes` for the tables we indexed (`questions`, `skills`, `domain_skill_mappings`, `ai_evaluations`, `attempt_answers`, `attempt_skill_scores`, `assessment_questions`, `assessment_attempts`, `notifications`, `review_skill_entries`, `skill_registry_items`) and confirm each expected index name is present.
- Run `ANALYZE` sanity check via `pg_stat_user_tables.last_analyze` — ensure planner has stats.

### 2. Confirm planner uses them
- Run `EXPLAIN (ANALYZE, BUFFERS)` on the exact query from the screenshot:
  `SELECT skill_id FROM questions WHERE skill_id IN (...) AND question_type = 'mcq' AND status = 'published' AND deleted_on IS NULL`
  → expect `Index Scan` / `Bitmap Index Scan` on `questions (skill_id, question_type, status) WHERE deleted_on IS NULL`, not `Seq Scan`.
- Same check for the other hot queries called from assessment flows:
  - `assessment_questions` by `assessment_id`
  - `attempt_answers`, `ai_evaluations`, `attempt_skill_scores` by `attempt_id`
  - `assessment_attempts` by `employee_id, assessment_id` and by `started_at DESC`
  - `notifications` by `target_user_id, created_at DESC`

### 3. Re-check slow-query stats
- Reset `pg_stat_statements` (or note the current snapshot), then re-run `supabase--slow_queries` after driving traffic.
- Compare `max_exec_time` for the four offenders (`questions`, `skills`, `domain_skill_mappings`, `notifications`) against the pre-fix numbers documented in `.lovable/plan.md`. Target: max_exec_time well under the 2s cancel threshold, no more `57014` in db logs.

### 4. Exercise the actual assessment pages
Drive the live preview with Playwright as an authenticated employee (`LOVABLE_BROWSER_AUTH_STATUS=injected`) and cover:
1. Assessments list (`/assessments`)
2. Assessment detail (`/assessments/:id`)
3. Start a `FixedRunner` attempt → answer 2–3 questions → pause → resume → open review dialog → submit
4. Notifications dropdown open
5. Team Assessments (`/team/assessments`) as a manager, if session allows

For each step:
- Capture `console` errors and failed `fetch` responses.
- Fail the check if any response contains `"code":"57014"` or status is aborted with a Supabase error body.
- Save screenshots + a JSON log under `/tmp/browser/verify-57014/`.

### 5. Report
Summarize per-page results:
- indexes present: yes/no
- planner using them: yes/no (with the operator seen)
- max_exec_time before vs after
- runtime `57014` count during the Playwright run (should be 0)

If any check fails, list the offending query + plan and propose the next narrow fix (usually a missing composite index or a query that still selects `*`). No code changes are made as part of this verification — this plan is read-only.

### Technical notes
- Read-only tools only: `supabase--read_query`, `supabase--slow_queries`, `supabase--db_health`, Playwright via shell.
- No migrations, no edits to stores or components in this step.
- If planner still picks `Seq Scan` despite the index, that becomes a follow-up plan (adjust index column order or add a covering index), not part of this verification.
