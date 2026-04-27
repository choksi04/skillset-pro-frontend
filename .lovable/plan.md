## Goal

Two coordinated changes:

1. **Remove the Review Cycle feature** end-to-end — UI, store, navigation, dependencies, and assessments tied to a cycle.
2. **Introduce an Assessment Templates module** (Adaptive | Fixed) that becomes the single way to create assessments going forward.

Per your decisions:

- Cycle-linked assessments are **hard-deleted** (not in production yet).
- Templates **replace** the auto-generation flow on registry submit.
- Templates live in **Settings**, replacing the "Review Cycles" slot.
- Adaptive default question types: **MCQ pre-selected only**.

---

## Part 1 — Remove Review Cycles

### Database (migration)

```sql
-- Hard-delete cycle-linked assessments and their dependents
DELETE FROM attempt_answers WHERE attempt_id IN
  (SELECT id FROM assessment_attempts WHERE assessment_id IN
    (SELECT id FROM assessments WHERE cycle_id IS NOT NULL));
DELETE FROM ai_evaluations WHERE attempt_id IN
  (SELECT id FROM assessment_attempts WHERE assessment_id IN
    (SELECT id FROM assessments WHERE cycle_id IS NOT NULL));
DELETE FROM attempt_skill_scores WHERE attempt_id IN
  (SELECT id FROM assessment_attempts WHERE assessment_id IN
    (SELECT id FROM assessments WHERE cycle_id IS NOT NULL));
DELETE FROM assessment_attempts WHERE assessment_id IN
  (SELECT id FROM assessments WHERE cycle_id IS NOT NULL);
DELETE FROM assessment_questions WHERE assessment_id IN
  (SELECT id FROM assessments WHERE cycle_id IS NOT NULL);
DELETE FROM manager_reviews WHERE assessment_id IN
  (SELECT id FROM assessments WHERE cycle_id IS NOT NULL);
DELETE FROM reassessment_requests WHERE assessment_id IN
  (SELECT id FROM assessments WHERE cycle_id IS NOT NULL);
DELETE FROM assessments WHERE cycle_id IS NOT NULL;

-- Drop cycle column + cycle tables
ALTER TABLE assessments DROP COLUMN cycle_id;
DROP TRIGGER IF EXISTS check_single_active_cycle_trigger ON review_cycles;
DROP FUNCTION IF EXISTS public.check_single_active_cycle();
DROP TABLE IF EXISTS cycle_domain_selections;
DROP TABLE IF EXISTS review_cycles;
```

### Code removals


| File                                                                            | Action                                                                                                                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/ReviewCyclesPage.tsx`                                                | Delete                                                                                                                                    |
| `src/stores/cycleStore.ts`                                                      | Delete                                                                                                                                    |
| `src/App.tsx`                                                                   | Remove `/review-cycles` route                                                                                                             |
| `src/components/layout/AppSidebar.tsx`                                          | Remove "Review Cycles" nav item (slot reused for Templates)                                                                               |
| `src/components/layout/PageHeader.tsx`                                          | Remove `/review-cycles` title entry                                                                                                       |
| `src/components/layout/SetupProgress.tsx`                                       | Drop "Start Cycle" step; setup becomes Skills → Domains → Mappings → Questions → **Create Template**                                      |
| `src/stores/onboardingStore.ts`                                                 | Replace `'open-cycle'` step with `'create-template'`                                                                                      |
| `src/pages/DashboardPage.tsx`                                                   | Remove active-cycle banner, "Manage" CTA, "create cycle" action item, Manager review nav to `/review-cycles` (route → `/manager-reviews`) |
| `src/pages/AssessmentsPage.tsx` / `TeamAssessmentsPage.tsx`                     | Drop cycle column/filter; show template name instead                                                                                      |
| `src/pages/AssessmentDetailPage.tsx`                                            | Remove cycle name, drop `cycle_id` from `addAssessment` regenerate call                                                                   |
| `src/components/assessment/ManagerReviewPanel.tsx`, `src/pages/ReviewsPage.tsx` | Replace `activeCycle?.name` with a static "—" or template name; keep `completeReview` API but pass `''`                                   |
| `src/stores/assessmentStore.ts`                                                 | Remove `cycle_id` field from `Assessment`, `GenerateAssessmentParams`, inserts, and selects                                               |
| `src/stores/registryStore.ts`                                                   | Already decoupled; just clean unused `currentCycle` references                                                                            |
| `src/components/registry/registryHelpers.ts`                                    | Drop `isCycleClosed` param + `incomplete` status                                                                                          |
| `src/components/registry/RatingSlider.tsx`                                      | Change "Last cycle:" copy → "Previous version:"                                                                                           |
| `src/pages/UserGuidePage.tsx`                                                   | Rewrite cycle/registry sections; add Templates section                                                                                    |
| `src/pages/HRDashboardPage.tsx`                                                 | Remove "Cycle" column from official entries table/CSV                                                                                     |


`reviewStore.ts` keeps its `cycle` text field on `official_skill_entries` for now (saved as `''`); column stays in the DB to avoid touching the manager-review pipeline.

---

## Part 2 — Assessment Templates module (Multi Step flow)

### Database (migration)

```sql
CREATE TABLE assessment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  name text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL CHECK (type IN ('adaptive','fixed')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active')),
  duration_minutes integer NOT NULL DEFAULT 45,
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  reattempt_enabled boolean NOT NULL DEFAULT false,

  -- adaptive config
  domain_id text,
  skill_selection_mode text CHECK (skill_selection_mode IN ('top_n','custom')),
  skills_per_assessment integer DEFAULT 5,
  questions_per_skill integer DEFAULT 4,
  question_types jsonb DEFAULT '["mcq"]'::jsonb,

  -- fixed config
  shuffle_questions boolean DEFAULT false,
  shuffle_options boolean DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz,
  created_by text, modified_by text,
  deleted_on timestamptz, deleted_by text
);

-- Skill picks for adaptive 'custom' mode
CREATE TABLE assessment_template_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
  skill_id text NOT NULL
);

-- Question list for fixed templates (ordered)
CREATE TABLE assessment_template_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

-- Link assessments to the template that produced them
ALTER TABLE assessments ADD COLUMN template_id uuid;

-- RLS: allow-all for MVP (matches existing project policy)
ALTER TABLE assessment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_template_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_template_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON assessment_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON assessment_template_skills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON assessment_template_questions FOR ALL USING (true) WITH CHECK (true);
```

### New files


| File                                              | Purpose                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/stores/templateStore.ts`                     | CRUD for templates, skills, questions; activate/draft toggling; `generateAssessmentFromTemplate(templateId, employeeId)` |
| `src/pages/AssessmentTemplatesPage.tsx`           | List view: name · type badge · status · skill/question count · CTA "New Template"                                        |
| `src/pages/AssessmentTemplateEditPage.tsx`        | Create/edit form with type toggle, type-specific config blocks, summary preview, Save Draft / Activate buttons           |
| `src/components/templates/TemplateTypeToggle.tsx` | Segmented control (Adaptive                                                                                              |
| `src/components/templates/AdaptiveConfig.tsx`     | Domain select, skill mode (top_n/custom), counts, question-type checkboxes (MCQ pre-checked)                             |
| `src/components/templates/FixedConfig.tsx`        | Searchable question picker + ordered selected list, shuffle toggles                                                      |
| `src/components/templates/TemplateSummary.tsx`    | Right-rail preview of expected questions/duration                                                                        |


### Routing & nav

- `App.tsx`: add `/assessment-templates` (list) and `/assessment-templates/:id` (editor), both `RoleGuard allowed=["admin","manager"]`.
- `AppSidebar.tsx`: replace "Review Cycles" with **"Assessment Templates"** in the Settings group (icon: `LayoutTemplate`).
- `PageHeader.tsx`: register both routes.

### Validation rules

- `name`: required, ≤100 chars
- `duration_minutes`: 5–240
- `max_attempts`: ≥1
- Adaptive: `domain_id` required; `question_types` length ≥1; if mode = `custom`, ≥1 skill picked
- Fixed: ≥1 question selected
- Activation only allowed when validation passes

### Replacing auto-generation on registry submit

- `src/pages/SkillRegistryPage.tsx` (or wherever submit fires): remove the call that generates an assessment automatically.
- After registry submit, show toast: *"Registry submitted."*
- New "Generate Assessment" action lives on **Team Assessments** page (manager): pick employee + active template → calls `generateAssessmentFromTemplate`.

### Generation logic (`generateAssessmentFromTemplate`)

- **Adaptive**: read employee's latest submitted skill registry → take top N skills by self-score (or template's custom skill list) → for each skill, pick `questions_per_skill` published questions matching the rated competency level, filtered by the template's `question_types`. Reuses existing `generateAssessmentQuestions` helper with the template's parameters instead of `assessment_config` defaults.
- **Fixed**: insert exactly the template's question list (no skill/level filtering); shuffle if enabled.
- Insert into `assessments` with `template_id`, `duration_minutes` from template, `status='pending'`.

### UI behavior

- Type toggle re-renders config block; switching types preserves common fields (name, duration, etc.).
- Summary card on the right updates live: "≈ X questions, Y min, Z skills".
- Status pill: Draft (gray) / Active (green). Only one Save button: text changes from "Save Draft" → "Save & Activate" based on status select.

---

## User Guide updates

- Remove all "Review Cycle" instructions.
- Add new section: **Creating Assessment Templates** with adaptive vs. fixed walkthroughs and the new manager flow (assign template → generate assessment).
- Update the lifecycle flow diagram in the Help page.

---