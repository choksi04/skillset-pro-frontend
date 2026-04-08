# Phase 4: Manual Override Capabilities

## Overview

Implement 4 missing admin/manager override actions for managing assessments mid-cycle. All actions appear on the **Team Assessment Detail page** (`AssessmentDetailPage.tsx`) when viewed by an admin/manager, with supporting store logic.

---

## Capability 1: Re-trigger Assessment Generation

**What**: Admin can generate an assessment for an employee whose submission is "submitted" but has no assessment yet.

**Where**: New action on `ReviewCyclesPage.tsx` (pending employees panel) or a dedicated section.

**How**:

- In the pending employees override panel (`ReviewCyclesPage.tsx`), add a "Generate Assessment" button next to employees whose submission status is `submitted` (no linked assessment exists)
- On click: fetch the submission's ratings, call `addAssessment()` from `assessmentStore`, then call `markAssessmentGenerated()` on the submission
- Show success/error toast

**Files**: `src/pages/ReviewCyclesPage.tsx`, no new store methods needed (reuses existing `addAssessment` + `markAssessmentGenerated`)

---

## Capability 2: Reset Submission Status

**What**: Admin can revert a submission from `assessment_generated` back to `submitted`, useful if the generated assessment had issues.

**How**:

- Add `resetSubmissionStatus(submissionId: string)` to `registryStore.ts` — updates status to `submitted` in DB and local state
- On the `ReviewCyclesPage.tsx` override panel, show a "Reset to Submitted" button for submissions with status `assessment_generated`
- Optionally soft-delete the linked assessment (set `deleted_on`) so a fresh one can be generated

**Files**: `src/stores/registryStore.ts` (new method), `src/pages/ReviewCyclesPage.tsx` (UI button)

---

## Capability 3: Regenerate Assessment

**What**: Admin creates a new assessment for an employee, excluding previously used questions.

**How**:

- Add a "Regenerate Assessment" button on `AssessmentDetailPage.tsx` (team view, visible to admin/manager when assessment status is `pending`)
- On click: soft-delete the current assessment (`deleted_on = now()`), collect all question IDs from the old assessment, call `addAssessment()` with `excludeQuestionIds` populated, reset submission status back to `assessment_generated`
- Add `softDeleteAssessment(id: string)` to `assessmentStore.ts`
- The existing `generateAssessmentQuestions` already supports `excludeIds`
  &nbsp;

**Files**: `src/stores/assessmentStore.ts` (new `softDeleteAssessment`), `src/pages/AssessmentDetailPage.tsx` (UI button + logic)

---

## Capability 4: Add/Remove Questions in Generated Assessment

**What**: Admin/manager can modify questions in a generated assessment before the employee starts it.

**Where**: `AssessmentDetailPage.tsx` — team view, only when assessment status is `pending`.

**How**:

- Show the current question list in an editable table with a "Remove" button per row
- Add an "Add Question" button that opens a dialog/sheet:
  - Filter available published questions by the assessment's skills and competency levels
  - Exclude already-included question IDs
  - Allow selecting one or more questions to add
- Store methods in `assessmentStore.ts`:
  - `removeAssessmentQuestion(assessmentId: string, questionId: string)` — deletes from `assessment_questions` table, updates local state
  - `addAssessmentQuestion(assessmentId: string, question: AssessmentQuestion)` — inserts into `assessment_questions` table, updates local state
- UI renders only for non-owner users viewing a `pending` assessment

**Files**: `src/stores/assessmentStore.ts` (2 new methods), `src/pages/AssessmentDetailPage.tsx` (question management UI), new component `src/components/assessment/AddQuestionDialog.tsx` (question picker)

---

## Technical Details

### New store methods summary

```text
registryStore.ts:
  + resetSubmissionStatus(submissionId: string): Promise<void>

assessmentStore.ts:
  + softDeleteAssessment(id: string): Promise<void>
  + removeAssessmentQuestion(assessmentId: string, questionId: string): Promise<void>
  + addAssessmentQuestion(assessmentId: string, question: AssessmentQuestion): Promise<void>
```

### UI visibility rules

All override actions are gated by:

- User is NOT the assessment owner (`!isOwner`)
- User role is `admin` or `manager`
- Assessment status is `pending` (not yet started by employee)

### File changes summary


| File                                              | Changes                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/stores/assessmentStore.ts`                   | Add `softDeleteAssessment`, `removeAssessmentQuestion`, `addAssessmentQuestion` |
| `src/stores/registryStore.ts`                     | Add `resetSubmissionStatus`                                                     |
| `src/pages/AssessmentDetailPage.tsx`              | Add admin action buttons (regenerate, add/remove questions UI)                  |
| `src/pages/ReviewCyclesPage.tsx`                  | Add "Generate Assessment" and "Reset Submission" buttons in override panel      |
| `src/components/assessment/AddQuestionDialog.tsx` | New — question picker filtered by skill/level                                   |
