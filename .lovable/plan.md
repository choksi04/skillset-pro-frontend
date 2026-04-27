# Assessment Templates: UI Cleanup + Assignment Engine

## Part 1 — Template form cleanup

`**src/pages/AssessmentTemplateEditPage.tsx**`

- Remove the "Allow re-attempts" `Switch` block and `reattemptEnabled` state.
- Derive re-attempt behavior from `max_attempts > 1` (no UI toggle).
- Update the "Max Attempts" helper text: "Set to 1 for single attempt, or higher to allow re-attempts."

`**src/stores/templateStore.ts**`

- Drop `reattempt_enabled` from `AssessmentTemplate`, `SaveTemplateInput`, and the save payload.
- When reading, ignore the column (still in DB but unused).

We'll keep the column in the DB (harmless, no migration needed) so we don't disturb existing rows.

---

## Part 2 — Assignment Engine

### 2.1 Database (new migration)

New table `assessment_assignments`:


| column          | type                                               | notes                                                                          |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `id`            | uuid PK                                            | `gen_random_uuid()`                                                            |
| `tenant_id`     | text                                               | default `'tenant-001'`                                                         |
| `template_id`   | uuid                                               | FK target template                                                             |
| `employee_id`   | text                                               | the assignee                                                                   |
| `domain_id`     | text NULL                                          | populated when assignment originated from a domain bulk-assign (audit only)    |
| `status`        | text                                               | `new` | `in_progress` | `submitted` | `evaluated` | `verified` (default `new`) |
| `attempt_count` | int                                                | default `0`                                                                    |
| `max_attempts`  | int                                                | snapshotted from template at assign time                                       |
| `assigned_at`   | timestamptz                                        | `now()`                                                                        |
| `assessment_id` | uuid NULL                                          | the auto-generated assessment row                                              |
| `assigned_by`   | text NULL                                          | user id                                                                        |
| audit cols      | created_at / modified_at / deleted_on / deleted_by | standard pattern                                                               |


Index: `(employee_id, template_id) WHERE deleted_on IS NULL` for duplicate detection.

RLS: `Allow all for assessment_assignments` (consistent with project's current MVP RLS policy — see memory `architecture/security/rls-policy`).

### 2.2 Store — `src/stores/assignmentStore.ts` (new)

```
fetchAssignments()
getAssignmentsForEmployee(employeeId)
getAssignmentsForTemplate(templateId)
createAssignments({ template_id, employee_ids[], domain_id? })
  → for each employee:
    1. Skip if active assignment (status in [new, in_progress]) already exists for same template+employee → return as "skipped"
    2. Insert assessment_assignments row
    3. Generate the underlying assessment via existing assessmentStore.addAssessment (adaptive) OR fixed-template path (see 2.3)
    4. Update assignment.assessment_id
    5. Insert notification (target_role: 'employee', target_user_id: employee_id, type: 'assessment_assigned', action_link: `/assessments/{assessmentId}`)
  → returns { created, skipped, failed } summary
deleteAssignment(id) – soft delete
```

### 2.3 Assessment generation from template

Extend `assessmentStore.addAssessment` flow with a thin helper `generateFromTemplate(template, employee_id)`:

- **Adaptive**: load employee's latest submitted registry for `template.domain_id`; pull self-ratings; call existing `generateAssessmentQuestions` honoring `template.skills_per_assessment`, `questions_per_skill`, `question_types`, and `skill_selection_mode` (top_n vs custom skill list).
- **Fixed**: insert assessment + insert `assessment_questions` straight from `assessment_template_questions` (target_level looked up from the question itself).

If the employee has no submitted registry for an adaptive template's domain, return a "registry_missing" failure for that employee (surfaced in the summary).

### 2.4 Notification

Reuse existing `notifications` table. Add a new `type` value `'assessment_assigned'`. Insert one row per successful assignment. `NotificationDropdown` already renders any row matching `target_user_id = me`, so it will surface automatically.

### 2.5 Status transitions

`assessment_assignments.status` is derived/updated as:

- `new` → on creation
- `in_progress` → when first attempt starts (hook in `attemptStore.startAttempt`)
- `submitted` → when attempt is submitted
- `evaluated` → when AI evaluation completes
- `verified` → when manager review completes

We update this in the same places that already update the underlying `assessments.status`/attempt status, looking up the assignment by `assessment_id`.

### 2.6 UI — Assign Template dialog

`**src/components/templates/AssignTemplateDialog.tsx**` (new)

Triggered from:

- `AssessmentTemplatesPage` → new "Assign" button on each active template card
- `TeamAssessmentsPage` → header CTA "Assign from Template" (opens dialog with template picker first)

Dialog contents:

- Template summary header (name, type, duration, domain).
- Mode tabs: **By Domain** | **Specific Users**
  - **By Domain**: domain Select (defaults to template.domain_id for adaptive). Shows preview list of users in that domain with checkboxes (pre-checked, can deselect). 
  - **Specific Users**: searchable multi-select of users (filtered to manager's domain when role=manager).
- Validation banners:
  - If template not active → block with "Template must be activated before assigning."
  - For each selected employee already having an active assignment for this template → show inline warning row "Already assigned · last assigned {date}" with checkbox unchecked by default (admin can override).
- Footer summary: "X new assignments will be created. Y skipped (duplicates)."
- Confirm → calls `assignmentStore.createAssignments`, toasts result, closes.

### 2.7 Listing — Assignments panel

`**src/pages/AssessmentTemplatesPage.tsx**`

- Add an "Assignments" count badge on each card (`{n} active`).
- Add an "Assignments" link on each card → opens a side `Sheet` listing assignments for that template with: employee name, status badge, attempt_count/max_attempts, assigned_at, link to the underlying assessment, and a "Revoke" action (soft delete) when status is not `submitted, evaluated, verified`.

### 2.8 Sidebar / nav

No new top-level entry needed. Assignment is reached through:

- Template card → Assign / View Assignments
- Team Assessments page → Assign CTA

This keeps the nav unchanged (per project knowledge: "avoid duplicate pages").

---

## Files changed


| File                                                    | Change                                                  |
| ------------------------------------------------------- | ------------------------------------------------------- |
| `src/pages/AssessmentTemplateEditPage.tsx`              | Remove re-attempt toggle                                |
| `src/stores/templateStore.ts`                           | Drop `reattempt_enabled` from interface/save            |
| `supabase/migrations/<new>.sql`                         | Create `assessment_assignments`                         |
| `src/stores/assignmentStore.ts`                         | New store + create/list/status logic                    |
| `src/stores/assessmentStore.ts`                         | Add `generateFromTemplate` helper                       |
| `src/stores/attemptStore.ts`                            | Bump assignment status on start/submit/evaluate         |
| `src/stores/reviewStore.ts`                             | Bump assignment status to `verified` on review complete |
| `src/components/templates/AssignTemplateDialog.tsx`     | New dialog (domain / users modes)                       |
| `src/components/templates/TemplateAssignmentsSheet.tsx` | New side sheet listing assignments                      |
| `src/pages/AssessmentTemplatesPage.tsx`                 | Assign + View Assignments buttons + counts              |
| `src/pages/TeamAssessmentsPage.tsx`                     | "Assign from Template" CTA                              |
| `src/integrations/supabase/types.ts`                    | Auto-regenerated                                        |


## Validation rules enforced

- Template `status === 'active'` required to open assign dialog.
- `max_attempts >= 1` (already enforced).
- Duplicate active assignment → warning + opt-in only (no silent duplicates).
- Adaptive without employee registry → reported as failure, no assessment created.

## Out of scope (not building now)

- Email notifications (in-app notification only).
- Assignment scheduling / due dates.
- Bulk CSV upload of assignees.