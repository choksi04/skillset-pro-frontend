# Comprehensive System Fix & Enhancement Plan

This is a large set of changes spanning bugs, architecture improvements, and new features. I recommend implementing in 4 phases.

---

## Phase 1: Critical Bugs & Data Freshness (Priority: Immediate)

### 1A. Remove Hard-Caching (Store `initialized` Guards)

**Problem**: Every Zustand store has `if (get().initialized) return;` in its fetch function, meaning data is loaded once and never refreshed. New records from forms don't appear until page refresh.

**Fix**: Remove the `initialized` early-return guard from all store fetch functions and always re-fetch from the database. Affected stores:

- `questionStore.ts` — `fetchQuestions()`, `fetchSettings()`
- `skillStore.ts` — `fetchSkills()`
- `domainStore.ts` — `fetchDomains()`
- `assessmentStore.ts` — `fetchAssessments()`
- `attemptStore.ts` — `fetchAttempts()`
- `registryStore.ts` — `fetchRegistry()`
- `cycleStore.ts` — `fetchCycles()`
- `reviewStore.ts` — `fetchReviews()`

Each fetch will set `loading: true` at start, always query the DB, and set `loading: false` when done. The `initialized` flag becomes "has loaded at least once" (for showing initial skeleton states), not a cache guard.

### 1B. Fix MCQ Scoring Bug (Correct=0, Incorrect=100)

**Root cause**: The `evaluateMCQ` function in `evaluate-assessment/index.ts` parses `evaluation_guidelines` for a regex pattern `Correct answer: A/B/C/D`, but the AI-generated guidelines may not match this format. Also, the `correctIndex` is stored inside the JSON `question_text`, which is a more reliable source.

**Fix**: Rewrite `evaluateMCQ` to:

1. Parse `question_text` JSON to extract `correctIndex`
2. Convert user answer letter (A/B/C/D) to index (0-3)
3. Compare indices directly instead of relying on regex parsing of guidelines

### 1C. Hide Expected Output in Coding Questions

**Fix**: In `AssessmentExecPage.tsx`, remove the "Expected Output" section from the coding question display (lines 494-497). Keep `exampleInput` visible as a hint, but hide `exampleOutput` since it reveals the answer.

### 1D. Fix Domain Skill Re-mapping Bug

**Root cause**: `removeMapping` soft-deletes (sets `deleted_on`) but the store correctly removes it from local state. However, when the DomainSkillManager sheet re-opens, it reads from `mappings` which was loaded once (due to `initialized` guard in `fetchDomains`). Since we fix the caching in 1A, this will be resolved automatically. Additionally, ensure `addMapping` does not conflict with soft-deleted rows.

### 1E. Multi-Select Publish for Questions

**Fix**: Add checkbox selection to the Question Bank table, with a bulk "Publish Selected" action button. Add `selectedQuestionIds` state to `QuestionBankPage.tsx`, a "Select All" checkbox in table header, and a `bulkPublish` function to `questionStore.ts` that updates multiple questions to `published` status in one call.

---

## Phase 2: Rename `question_settings` → `competency_levels` Table

### 2A. Database Migration

- Rename table `question_settings` to `competency_levels`
- The columns stay the same: `id`, `tenant_id`, `level`, `name`, `label`, `description`, `score_range_min`, `score_range_max`, `min_questions`, `status`, etc.

### 2B. Code Updates

- Rename `QuestionSetting` type to `CompetencyLevel` across all stores
- Update all Supabase queries from `.from('question_settings')` to `.from('competency_levels')`
- Update `questionStore.ts` → create a dedicated `competencyLevelStore.ts` or keep in questionStore with renamed types
- Update all imports across ~15 files that reference `QuestionSetting` or `fetchSettings`
- Update the `QuestionSettingsPage.tsx` to reflect the new naming

### 2C. Scan and Remove Hardcoded Values

Hardcoded values found in the codebase:

- `**'tenant-001'**` — used as fallback in 15+ files. These should remain as fallbacks but sourced from `user.tenant_id` (already done, just fallback default).
- **Fallback competency maps** in `assessmentStore.ts` lines 22-23, 35: `{ 1: 'beginner', 2: 'beginner', 3: 'intermediate', 4: 'advanced', 5: 'expert' }` — replace with empty map or throw error if settings not loaded.
- `**ratingLabels` and `ratingDescriptions**` in `registryStore.ts` lines 7-17 — should derive from `competency_levels` table.
- `**scoreToLevel` thresholds** in `attemptStore.ts` lines 33-38 — should use `score_range_min`/`score_range_max` from competency levels table.
- `**competencyLevels` and `competencyLabels**` deprecated exports in `questionStore.ts` — remove entirely.
- `**duration_minutes` calculation** in `assessmentStore.ts` line 267: `Math.max(30, assessmentQuestions.length * 10)` — should be configurable in global setting.
- `**grace_period_days: 3**` default in `cycleStore.ts` — acceptable as DB default.
- `**maxLength={5000}**` for answers — acceptable as UI limit.

---

## Phase 3: Assessment Config & Predictable Question Selection

### 3A. New `assessment_config` Table

Create a new table for global assessment configuration:

```sql
CREATE TABLE assessment_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  config_type text NOT NULL DEFAULT 'global',  -- 'global' | 'domain' | 'skill' (future)
  reference_id text,  -- null for global, domain_id or skill_id for scoped
  question_type text NOT NULL,  -- 'mcq' | 'coding' | 'scenario'
  min_questions integer NOT NULL DEFAULT 2,
  max_questions integer NOT NULL DEFAULT 6,
  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz,
  created_by text,
  modified_by text,
  UNIQUE(tenant_id, config_type, reference_id, question_type)
);
```

### 3B. Assessment Config Admin UI

Add an "Assessment Config" section (in Settings or as a tab in Question Settings page) where admin can set:

- Per question type (MCQ, Coding, Scenario): min and max questions
- This is global for now; future: per-domain or per-skill overrides

### 3C. Rewrite Question Selection Logic

Current: `generateAssessmentQuestions` picks from levels n, n-1, n-2 with random shuffle.

New logic:

1. For each skill rated at level L, pick questions **only from level L** (exact match, no n-1/n-2)
2. For each question type (MCQ, Coding, Scenario), pick between `min` and `max` questions as per config
3. No random shuffle — pick deterministically (e.g., by `created_at` order, or round-robin by topic)
4. If not enough questions of a type exist, pick up to what's available (but validate beforehand)

### 3D. Pre-Validation Before Cycle Activation

Before allowing assessment generation (or cycle activation), validate:

- For each domain included in the cycle
- For each skill mapped to that domain
- For each competency level (1-5)
- For each question type (MCQ, Coding, Scenario)
- Check: `count(published questions) >= min_questions` from config

Show a detailed readiness report with gaps.

### 3E. Improve AI Scoring Accuracy

Update `evaluate-assessment/index.ts`:

- Add more detailed scoring rubric with explicit reasoning requirements
- Request the AI to provide step-by-step reasoning for each score
- For MCQs: use `correctIndex` from parsed `question_text` JSON (not regex on guidelines)
- Add `reasoning` field to AI evaluation response and store it

---

## Phase 4: Review Cycle Prerequisites, Flexibility & Manual Overrides

### 4A. Review Cycle Activation Prerequisites Checklist

When admin clicks "Activate", show a pre-flight check:

1. At least one domain exists and is active
2. All included domains have skills mapped
3. All mapped skills have sufficient published questions (per assessment config)
4. All domains have at least one assigned employee
5. All domains have a domain lead assigned
6. No other cycle is currently active (or confirm auto-close)

Display as a checklist with pass/fail for each item. Block activation if critical items fail.

### 4B. Domain Selection for Cycle Activation

Add a domain selection step when activating a review cycle:

- Show list of active domains with checkboxes
- Admin can include/exclude domains
- Store selected domain IDs in a new `review_cycle_domains` table
- Allow adding domains post-activation (sends notifications to newly included employees)

```sql
CREATE TABLE review_cycle_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id text NOT NULL,
  domain_id text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by text,
  UNIQUE(cycle_id, domain_id)
);
```

### 4C. Dynamic Employee Eligibility

Currently: employees see registry options based on domain assignment at load time.

Fix: When an employee visits the Skill Registry page, check domain assignment in real-time (not from cached store). If they were just assigned to a domain mid-cycle, they should see the submission form immediately.

Show clear messages:

- "You are not assigned to any domain. Please contact your admin." (if no domain)
- "No active review cycle. Check back later." (if no cycle)
- "The current cycle has ended." (if cycle closed)

### 4D. Manual Override Capabilities

Add admin/manager actions for:

1. **Re-trigger assessment generation** — if auto-generation failed, admin can manually trigger it for a specific employee
2. **Reset submission status** — allow admin to revert a submission from `assessment_generated` back to `submitted` if assessment generation had issues
3. **Add employee to domain mid-cycle** — already works via domain management, but ensure registry page reacts immediately (fixed by Phase 1 cache removal)
4. **Force-close individual submissions** — mark incomplete submissions as closed
5. **Regenerate assessment** — create new assessment for an employee, excluding previously used questions
6. **Add/Remove Question in generated assessment** - Allow admin/managers to add or remove the questions after the assessment is generated in team's assessment, and before it gets submitted by employee.

---

## Technical Details

### Files to Create

- `src/stores/competencyLevelStore.ts` (or rename within questionStore)
- `supabase/migrations/XXXXXX_rename_question_settings.sql`
- `supabase/migrations/XXXXXX_create_assessment_config.sql`
- `supabase/migrations/XXXXXX_create_review_cycle_domains.sql`

### Files to Modify (Major)

- All 8 Zustand stores (remove caching guards)
- `evaluate-assessment/index.ts` (fix MCQ scoring)
- `generate-questions/index.ts` (update table reference)
- `AssessmentExecPage.tsx` (hide expected output, fix scoring display)
- `EvalResults.tsx` (fix score display)
- `QuestionBankPage.tsx` (add multi-select publish)
- `DomainSkillManager.tsx` (fix re-mapping)
- `ReviewCyclesPage.tsx` (add prerequisites, domain selection)
- `assessmentStore.ts` (rewrite question selection)
- `QuestionSettingsPage.tsx` (rename to competency levels)

### Implementation Order

Phase 1 → Phase 2 → Phase 3 → Phase 4

Each phase is independently deployable. Phase 1 fixes critical bugs and should be done first. Phases 3 and 4 are the largest and can be split into sub-tasks.