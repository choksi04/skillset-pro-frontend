## Plan: Full Assessment Engine Rebuild

This is a significant rebuild touching stores, pages, an edge function, and the database. The plan is organized by the 20 steps from your specification.

---

### Database Changes

**New table: `reassessment_requests**`

- `id` (uuid, PK), `assessment_id` (uuid), `review_id` (text), `tenant_id` (text), `employee_id` (text), `skill_ids` (jsonb — array of skill IDs), `status` (text: pending/completed), `created_at`, `created_by`

**Alter `assessments` table:**

- Add `cycle_id` (text, nullable) — link assessment to review cycle
- Add `is_reassessment` (boolean, default false)
- Add `parent_assessment_id` (uuid, nullable) — links reassessment to original

**Alter `assessment_attempts` table:**

- Add `paused_at` (timestamptz, nullable) — for flexible timer
- Add `remaining_seconds` (integer, nullable) — persisted timer state

---

### Step-by-Step Implementation

#### 1–2. Assessment Generation + Minimum Validation (`src/stores/assessmentStore.ts`)

- Rewrite `generateAssessmentQuestions()`:
  - For each skill with self-rating `n`, select questions at levels `n`, `n-1`, `n-2` (not the current "primary + lower" mapping)
  - Respect `topic_id` when available (prefer questions matching skill's topics)
  - Deduplicate questions
- Add `validateQuestionAvailability()`:
  - Check `question_settings.min_questions` per skill/level combo
  - If insufficient, return `{ valid: false, message: "Assessment is not available at the moment. Please contact your manager." }`
  - Block generation and show the message via toast
  - Allow employee to re-try assessment and system will try again generating the assessment.

#### 3. Assessment Entity

- Update `Assessment` type to include `cycle_id`, `is_reassessment`, `parent_assessment_id`
- Map statuses: pending → Not Started, in_progress → In Progress, completed → Submitted, evaluated → Evaluated, review_pending → Under Review, approved → Approved

#### 4. Assessment List Page (`src/pages/AssessmentsPage.tsx`) — Full Rebuild

**Employee view:**

- Table/card list with columns: Cycle, Domain, Status, Score, Action
- Actions: Start, Continue, View Result (based on status)
- Reassessment items clearly marked with a badge
- Search and filters

**Manager/Admin view:**

- Two different page: My Assessments, Team Assessments (replace the current pages: assessments, manager reviews)
- Shows employee name, cycle, domain, status, score, action
- Search and filters

#### 5. Test-Taking UI (`src/pages/AssessmentExecPage.tsx`) — Full Rebuild

**Layout (modern exam interface):**

- **Top bar**: Timer (with pause/resume button), progress count (X/Y answered), Submit button
- **Left sidebar**: Vertical question list (numbered buttons) with color-coded status:
  - Gray: not visited
  - Blue border: current
  - Green: answered
  - Orange: marked for review
- **Main panel**: Current question with full rendering

**Flexible timer:**

- Pause button stores `remaining_seconds` + `paused_at` to DB
- Resume restores countdown from `remaining_seconds`
- Auto-submit on time expiry

#### 6. Question Types Handling (already exists, polish)

- MCQ: Radio cards (existing)
- Scenario: Textarea (existing)
- Coding: Textarea with monospace font (existing, keep as MVP)

#### 7. User Actions — New Features

- **Mark for review**: Toggle button per question, reflected in sidebar with orange indicator
- **Reset answer**: Clear button to remove current answer
- **Skip**: Already implicit via navigation, but add explicit "Skip" button
- Previous/Next navigation (existing)

#### 8. Submission Flow

- On submit: lock answers, set attempt status = `submitted`, then trigger AI evaluation
- If all questions answered → direct submit
- If incomplete → confirmation dialog with count (existing, keep)

#### 9. AI Evaluation — Replace Mock with Real AI

**New edge function: `supabase/functions/evaluate-assessment/index.ts**`

- Receives: `attempt_id`, answers array with question text/type/guidelines
- For MCQ: auto-evaluate (compare answer to `correctIndex` from `evaluation_guidelines`), no AI call
- For scenario/coding: call Lovable AI Gateway (`google/gemini-3-flash-preview`) with structured evaluation prompt
- Returns per-question: `score` (0-100), `feedback`, `dimensions` array, `confidence`
- Handle 429/402 errors gracefully

**Update `attemptStore.submitAttempt()`:**

- Replace `generateStructuredEvaluation()` mock with edge function call
- On AI failure: set status to `submitted` (not `evaluated`), show "Pending Evaluation" message, allow retry via a "Retry Evaluation" button

#### 10. Skill Score Calculation (existing, keep)

- Per skill: average of question scores → `scoreToLevel()` mapping
- Already implemented correctly

#### 11. Assessment Result View (`src/components/assessment/EvalResults.tsx`) — Enhance

- Overall score card (existing)
- Skill-wise score breakdown (existing)
- Per-question detail: show question text, user answer, correct answer (MCQ), AI feedback, dimension scores
- For MCQ: explicitly show "Correct Answer: B" alongside user's answer

#### 12. Manager Review Integration (existing in `ReviewsPage.tsx`, keep)

- After evaluation → status = Under Review
- Manager sees skill table with: Self Score, Assessment Score, Actions (Approve/Adjust/Reassess)
- Already implemented

#### 13–14. Reassessment Flow — OUT OF SCOPE - Don't implement Reassessment Flow.

**Manager triggers reassessment (in `ReviewsPage.tsx`):**

- When manager clicks "Reassess" on specific skills, create a `reassessment_request` record
- System generates a new assessment (`is_reassessment = true`, `parent_assessment_id` = original) with questions ONLY for the flagged skills
- Use different questions from bank (exclude questions used in original assessment)
- Employee sees "Reassessment Required" badge on their assessments list

**Employee reassessment experience:**

- Only shows questions for the reassessed skills
- Header clearly states "Reassessment" with skill names
- Previously approved skills are not shown
- On submit → AI eval → manager review (same flow)

**Score handling:** New reassessment score **replaces** original score for those skills

#### 15. Final Approval (existing, enhance)

- When manager approves all skills → status = Approved
- System writes to `official_skill_entries` (existing)
- For reassessments: update the original review's skill entries with new scores

#### 16. Edge Cases

- **Mid-assessment exit**: Auto-save answers on each navigation (enhance existing `saveAnswer` to trigger on every question change)
- **Time expires**: Auto-submit (existing)
- **No questions available**: Block generation with generic message (step 2)
- **AI eval fails**: Mark as "Pending Evaluation", show retry button

#### 17–18. UX + Performance

- Minimal chrome during exam (hide sidebar during active assessment)
- Load questions from store (already in memory)
- Smooth navigation between questions

#### 19. Registry Detail Page Link

`**src/pages/SkillRegistryDetailPage.tsx`:**

- When status is `submitted` or `assessment_pending`, show a secondary button: "Go to Assessment" → navigates to `/assessments`

---

### File Summary


| File                                              | Change                                                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/`                            | New migration: add `cycle_id`, `is_reassessment`, `parent_assessment_id` to assessments; add `paused_at`, `remaining_seconds` to attempts; create `reassessment_requests` table |
| `supabase/functions/evaluate-assessment/index.ts` | NEW: Real AI evaluation edge function                                                                                                                                           |
| `src/stores/assessmentStore.ts`                   | Rewrite question selection, add validation, support reassessment generation                                                                                                     |
| `src/stores/attemptStore.ts`                      | Replace mock eval with edge function call, add pause/resume, retry eval, auto-save                                                                                              |
| `src/pages/AssessmentsPage.tsx`                   | Full rebuild: table layout, cycle column, reassessment badges                                                                                                                   |
| `src/pages/AssessmentExecPage.tsx`                | Full rebuild: modern exam UI, flexible timer, mark-for-review, reset answer, pause/resume                                                                                       |
| `src/components/assessment/EvalResults.tsx`       | Enhance: show correct answer for MCQ, improve layout                                                                                                                            |
| `src/pages/SkillRegistryDetailPage.tsx`           | Add "Go to Assessment" link for submitted/assessment_pending                                                                                                                    |
| `src/pages/ReviewsPage.tsx`                       | Add reassessment trigger flow                                                                                                                                                   |
| `src/stores/reviewStore.ts`                       | Add `requestReassessment()` action                                                                                                                                              |


---

### Technical Details

- **AI Evaluation Edge Function** uses `google/gemini-3-flash-preview` via Lovable AI Gateway with structured prompts per question type
- **Timer persistence**: `remaining_seconds` saved to DB on pause, restored on resume
- **Reassessment question selection**: Queries question bank excluding `question_id`s from original assessment's `assessment_questions`
- **Auto-save**: `saveAnswer()` called on every question navigation (not just on submit)
- **Status mapping**: Assessment statuses unified across all views using a single config object (similar to `registryHelpers.ts` pattern)