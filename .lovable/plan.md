# Full API Call Audit Report

## Current backend status

The hosted backend is up and healthy:

- Database is responding normally.
- Connection usage is low: `12/60`.
- Pool usage is low: `1/200`.
- Memory is moderate: `53%`.
- Data disk is low: `4%`.

Conclusion: this is not primarily a backend outage or compute-size issue right now. The main problem is frontend call shape: repeated broad table reads, unguarded fetches, and full-row `select('*')` usage.

## Confirmed slow/busy API patterns

The slow-query evidence confirms repeated broad reads across multiple tables, not only `/questions`.

Top repeated backend reads by total time:

1. `skills.*` active list
   - 174 calls
   - 7.3s total backend time
   - Called by skill library, dashboards, assessments, registry pages, setup widgets.

2. `assessment_questions.*` by assessment IDs
   - 72 calls
   - 3.5s total backend time
   - Caused by full assessment preloads that then fetch child rows.

3. `domain_skill_mappings.*`
   - 125 calls
   - 3.0s total backend time
   - Called broadly through domain store.

4. `attempt_answers.*`
   - 110 calls
   - 2.8s total backend time
   - Caused by global attempt fetches.

5. `ai_evaluations.*`
   - 110 calls
   - 2.6s total backend time
   - Caused by global attempt fetches.

6. `questions.*`
   - 97 calls
   - 2.1s total backend time
   - Includes the full 1000-row paginated waterfall shown in DevTools.

7. `assessment_attempts.*`
   - 34 calls
   - 1.1s total backend time

8. `notifications.*`
   - 73 calls
   - 1.1s total backend time

9. `skill_categories.*`
   - 173 calls
   - 0.9s total backend time

10. `assessment_assignments.*`
   - 71 calls
   - 0.9s total backend time

## Root causes

### 1. Store fetch functions usually do not protect themselves

Most stores have `initialized` and `loading`, but their fetch functions do not internally stop duplicate work.

Examples:

- `skillStore.fetchSkills()` always queries.
- `domainStore.fetchDomains()` always queries.
- `assessmentStore.fetchAssessments()` always queries.
- `attemptStore.fetchAttempts()` always queries.
- `reviewStore.fetchReviews()` always queries.
- `templateStore.fetchTemplates()` always queries.
- `competencyLevelStore.fetchLevels()` always queries.
- `skillRegistryStore.fetchRegistries()` always queries.

So every page that calls these functions can trigger fresh API calls even if the data is already loaded.

### 2. Page mount effects fan out into many API calls

High-risk pages:

- Dashboard pages load multiple stores at once.
- My Assessments loads around 8 stores on mount.
- Team Assessments loads around 8 stores on mount.
- HR Dashboard loads assessments, attempts, reviews, skills, and domains together.
- Assessment Detail loads scoped detail data but also several global stores.
- Registry pages load registries, domains, skills, levels, items, and review statuses.

These calls are mostly purposeful, but they are too broad and not consistently guarded.

### 3. Persistent layout also triggers API calls

`AppSidebar` renders `SetupProgress` for admins.

`SetupProgress` calls:

- `fetchSkills()` if not initialized
- `fetchDomains()` if not initialized
- `fetchQuestionCounts()` unguarded
- `fetchTemplates()` if not initialized

This means layout-level UI can add API calls even when the current page itself does not need them.

`PageHeader` renders `NotificationDropdown`, which directly fetches `notifications.*` separately from the review store.

### 4. `/questions` full-table loading is real and confirmed

`questionStore.fetchQuestions()` does this:

- `select('*')`
- `deleted_on is null`
- `order created_at`
- 1000-row paging loop until all questions are loaded

This directly produces requests like:

`/questions?select=*&deleted_on=is.null&order=created_at.asc&offset=15000&limit=1000`

Callers:

- `QuestionBankPage` on mount
- `QuestionPickerSheet` when opened
- `AddQuestionDialog` when opened

### 5. Too many `select('*')` calls

Most hot stores fetch all columns even when the UI needs only a subset.

Confirmed broad patterns:

- `skills.select('*')`
- `skill_categories.select('*')`
- `domains.select('*')`
- `domain_skill_mappings.select('*')`
- `assessments.select('*')`
- `assessment_questions.select('*')`
- `assessment_attempts.select('*')`
- `attempt_answers.select('*')`
- `ai_evaluations.select('*')`
- `attempt_skill_scores.select('*')`
- `manager_reviews.select('*')`
- `notifications.select('*')`
- `questions.select('*')`
- `assessment_templates.select('*')`

This increases payload size and browser work.

## Final audit conclusion

The API calls are not random, but the current architecture makes many of them fire repeatedly and too broadly.

The biggest issues are:

1. Missing store-level guards and in-flight deduplication.
2. Full-table question loading.
3. Dashboard/list pages using global fetches instead of scoped summaries.
4. Persistent layout components making background API calls.
5. `select('*')` on hot paths.

# Implementation Plan

## Phase 1 — Stop duplicate/repeated fetches globally

Add safe guard behavior inside hot stores so repeated page navigation does not refetch the same data unnecessarily.

### Stores to update first

- `skillStore`
- `domainStore`
- `competencyLevelStore`
- `templateStore`
- `assignmentStore`
- `assessmentStore`
- `attemptStore`
- `reviewStore`
- `skillRegistryStore`
- `registryStore`
- `assessmentConfigStore`

### Standard behavior

Each store fetch should:

- Return immediately if `initialized && !force`.
- Return immediately if `loading` or an in-flight promise already exists.
- Support `force?: boolean` for explicit refresh after writes.
- Keep existing page behavior stable.

Example intended pattern:

```text
fetchSkills({ force = false })
  if already loaded and not forced: return
  if already loading: return same in-flight promise
  run one request only
```

Expected result:

- Dashboard navigation stops re-triggering already-loaded reference data.
- Moving between pages does not repeatedly call `skills`, `domains`, `levels`, `templates`, etc.
- Simultaneous components do not duplicate the same request.

## Phase 2 — Remove full `/questions` loading

### 1. Replace `fetchQuestions()` with server-side pagination

Add a paginated query API in `questionStore`:

- `fetchQuestionPage(params)`
- Supports search/filter/sort/page/pageSize.
- Uses backend `.range()` for the visible page only.
- Selects only needed columns.
- Uses count only for pagination.

### 2. Refactor Question Bank

Update `QuestionBankPage` so it does not preload all questions.

New behavior:

- Loads 50 rows per page from backend.
- Search/filter/sort happens server-side.
- Counts still use the aggregate RPC.
- Question add/edit/delete updates only the current page or forces a page refresh.

### 3. Refactor fixed-template question picker

Update `QuestionPickerSheet`:

- Remove `ensureQuestionsLoaded()`.
- Query only published questions for the visible page.
- Preserve selected IDs across page/filter changes.
- Fetch selected question details only by ID when needed.

### 4. Refactor Add Question dialog

Update `AddQuestionDialog`:

- Remove `ensureQuestionsLoaded()`.
- Query only published questions for the assessment’s skill IDs.
- Add server-side pagination/search.
- Exclude already-added question IDs without loading all questions.

Expected result:

- No more `/questions?...offset=15000&limit=1000` waterfall.
- Question Bank and pickers become bounded, predictable API consumers.

## Phase 3 — Reduce dashboard and list-page fan-out

### Dashboard pages

Replace broad dashboard fetches with either guarded store reads or scoped summary fetches.

Targets:

- `AdminDashboard`
- `ManagerDashboard`
- `EmployeeDashboard`
- `HRDashboardPage`

Approach:

- Keep existing UI and business logic.
- Guard reference data fetches.
- Avoid loading child rows for all records unless a widget needs them.
- For widgets needing counts/averages, prefer summary/aggregate reads instead of full row hydration.

### Assessment pages

Targets:

- `AssessmentsPage`
- `TeamAssessmentsPage`
- `AssessmentDetailPage`

Approach:

- Keep list pages using bounded list data.
- Use detail-scoped fetches on detail pages.
- Stop terminal attempt updates from calling global `fetchAttempts()`; refresh only the affected assessment/attempt.

### Registry pages

Targets:

- `SkillRegistryPage`
- `TeamRegistryPage`
- registry detail pages

Approach:

- Employee pages should fetch employee-scoped registries only.
- Manager pages should fetch domain/team-scoped registries only.
- Fetch registry items only for visible/latest rows, not every historical row unless user opens history/detail.

## Phase 4 — Fix layout-triggered calls

### SetupProgress

Change behavior:

- Do not call `fetchQuestionCounts()` on every dependency change.
- Use a guarded/stale-aware count fetch.
- Only render/fetch for admins when setup is incomplete.

### NotificationDropdown

Change behavior:

- Select only needed notification columns.
- Filter by current user/role in the backend query instead of fetching 50 generic notifications then filtering client-side.
- Avoid duplicate notification fetches from `reviewStore` where possible.

### ProfilePopover

Change behavior:

- Cache domain list/name data already available from `domainStore`.
- Do not query domains every time the popover opens.

## Phase 5 — Narrow hot `select('*')` usage

Update hot read paths to select only required fields.

Priority tables:

1. `skills`
2. `skill_categories`
3. `domain_skill_mappings`
4. `assessment_questions`
5. `assessment_attempts`
6. `attempt_answers`
7. `ai_evaluations`
8. `notifications`
9. `questions`
10. `assessment_assignments`

Expected result:

- Smaller responses.
- Less browser parsing work.
- Faster perceived navigation.

## Phase 6 — Database query-plan validation

Run targeted query-plan checks for top slow queries after code-side reductions.

Candidates:

- `skills where deleted_on is null order by created_at`
- `assessment_questions where assessment_id in (...) order by created_at`
- `domain_skill_mappings where deleted_on is null`
- `attempt_answers where attempt_id in (...)`
- `ai_evaluations where attempt_id in (...)`
- `questions where deleted_on is null order by created_at`

Only add indexes when `EXPLAIN` proves a missing index or inefficient scan.

No destructive migrations.

## Verification plan

After implementation, verify with browser Network tab and code checks:

### Dashboard

Expected:

- No `/questions` calls unless a dashboard widget truly needs questions.
- No repeated `skills`, `domains`, `levels`, `templates` calls when moving back and forth.
- Notifications fetch is filtered and limited.

### Question Bank

Expected:

- One bounded page request, e.g. 50 rows.
- No 1000-row offset waterfall.
- Search/filter changes trigger one bounded request after debounce.

### Template picker

Expected:

- Opening picker fetches only visible published questions.
- Page changes fetch only the next page.
- Selection remains stable.

### Assessment detail

Expected:

- Fetches only current assessment, its attempts, and its question IDs.
- No global attempt refetch after adaptive completion.

### Registry pages

Expected:

- Employee route fetches only that employee’s registries.
- Manager route fetches only team/domain-relevant data.
- Items/statuses fetched only for visible/latest registries.

## Safety rules for this fix

- No business workflow changes.
- No assessment scoring changes.
- No manager approval logic changes.
- No fixed-template behavior changes except API efficiency.
- No broad schema changes without query-plan evidence.
- Demo accounts preserved.
- User Guide updated after visible/admin-facing behavior changes.
