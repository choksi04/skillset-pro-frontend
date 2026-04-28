## Goals

1. Eliminate the legacy `/assessment-exec` page. Start/Resume should run the assessment **inline on the existing detail page** (`/assessments/:assessmentId`) — no extra navigation, no extra page.
2. Fix the adaptive engine so it can generate questions **even when the employee has not submitted a registry**, mirroring the same fallback used at assignment time. The adaptive engine failed even when the registry is submitted and available.

---

## Problem analysis

- Today, "Start Assessment" navigates to `/assessment-exec?startId=...`. That page is a parallel runner UI duplicating the detail view.
- For the failing case (assessment `8824…0bba`):
  - Template is **adaptive**, `skill_selection_mode = top_n`, domain has 4 mapped skills with 60–160 published MCQs each.
  - The employee has **no registry submission** for the domain.
  - `assignmentStore.generateAssessmentForTemplate` correctly creates the empty adaptive assessment (registry is optional there).
  - But `adaptiveEngineStore.initAdaptiveAttempt` only reads skills from the registry submission and has **no domain-skill fallback** → `candidateSkills = []` → returns `'No skills resolved for this adaptive assessment'`.
  - `AdaptiveRunner` shows the error toast briefly, then `currentQuestion === null` renders `"No more questions — wrapping up…"`.

---

## Changes

### A. Remove `/assessment-exec` and run inline

1. `**src/pages/AssessmentDetailPage.tsx**` — make this the single runner.
  - Add local state: `runnerActive: boolean`, plus all the fixed-runner state currently in `AssessmentExecPage` (answers, currentIdx, timer, paused, etc.). For adaptive, just toggle the panel.
  - "Start Assessment" / "Resume Assessment" buttons set `runnerActive = true` and call the existing `startAttempt` / `updateAssessmentStatus('in_progress')` flow.
  - When `runnerActive` and `assessment.is_adaptive`, render `<AdaptiveRunner …>` directly inside the page (replaces the metadata cards). On `onComplete`: refresh + return to summary view.
  - When `runnerActive` and NOT adaptive, render the modern exam UI (top bar with timer/pause/submit, sidebar question navigator, MCQ/coding/scenario panels, confirm-submit dialog) — copied/extracted from `AssessmentExecPage`.
  - Auto-submit, pause/resume, time-spent tracking, and auto-create-manager-review logic are ported over verbatim.
  - To keep the file manageable, extract the runner UI into two new components:
    - `src/components/assessment/FixedRunner.tsx` — the modern exam UI (timer + sidebar + question panel + submit dialog).
    - `src/components/assessment/AssessmentResultsList.tsx` — *not needed*; results already render via `EvalResults` on the detail page.
2. `**src/App.tsx**` — delete the `/assessment-exec` route. Add a redirect for safety:
  ```tsx
   <Route path="/assessment-exec" element={<Navigate to="/assessments" replace />} />
  ```
   (Existing deep links with `?startId=` should redirect to `/assessments/:id` — handled by a tiny redirector component that reads the param.)
3. **Delete** `src/pages/AssessmentExecPage.tsx` once the logic is extracted.
4. **Update navigations** that point to `/assessment-exec`:
  - `AssessmentDetailPage.tsx` lines 327 & 332 — replace `navigate('/assessment-exec?startId=…')` with local `setRunnerActive(true)` + start logic.
  - Search the rest of the codebase (`rg "assessment-exec"`) and update any other references (e.g., notifications, dashboards, sidebar) to point to `/assessments/:id`.

### B. Fix adaptive engine — domain-skill fallback

`**src/stores/adaptiveEngineStore.ts` › `initAdaptiveAttempt**` (around lines 183–215):

After the existing `top_n` branch that reads from the registry submission, add the same fallback used in `assignmentStore.generateAssessmentForTemplate`:

```ts
// Fallback: if no registry submission / no ratings, pull skills mapped to the domain.
if (candidateSkills.length === 0 && assessmentRow.domain_id) {
  const { data: domainSkills } = await supabase
    .from('domain_skill_mappings')
    .select('skill_id')
    .eq('domain_id', assessmentRow.domain_id)
    .is('deleted_on', null);
  candidateSkills = (domainSkills || [])
    .map((s: any) => s.skill_id)
    .slice(0, templateRow.skills_per_assessment ?? 5);
}
```

This mirrors the assignment-time logic so the engine and the assignment stay in sync, and registry submission remains truly optional.

The downstream MCQ-availability check (`skillsWithMcq` / `usableSkills`) remains unchanged and will correctly pass with the 4 mapped skills.

### C. Show non-zero metadata for adaptive assessments before they start

The "0 questions" label on the card is technically correct for adaptive (questions are picked live). To avoid user confusion, on `AssessmentDetailPage` and the listing card:

- For adaptive assessments, replace `"{n} questions"` with `"Up to {skills_per_assessment × questions_per_skill} questions (adaptive)"` — read these numbers from the linked template via existing template data.
- The Questions metadata card on the detail page shows the same upper-bound figure with an "(adaptive)" suffix.

---

## Files to touch

- `src/pages/AssessmentDetailPage.tsx` — host the runner inline; replace navigate calls; render correct counts for adaptive.
- `src/components/assessment/FixedRunner.tsx` — **new**; extracted modern exam UI.
- `src/pages/AssessmentExecPage.tsx` — **delete**.
- `src/App.tsx` — drop the `/assessment-exec` route, add a redirect.
- `src/stores/adaptiveEngineStore.ts` — add domain-skill fallback in `initAdaptiveAttempt`.
- `src/pages/AssessmentsPage.tsx` — adjust the card sub-label for adaptive ("Up to N questions (adaptive)").
- Anywhere else `rg "assessment-exec"` finds (notifications, dashboards) — repoint to `/assessments/:id`.
- `mem://logic/assessment-engine/generation-constraints` — append note that adaptive engine falls back to domain-mapped skills when no registry exists.
- User Guide — update "Taking an Assessment" section to remove references to a separate exec page.

---

## Out of scope

- Re-architecting fixed vs adaptive runners into one component (kept separate; just hosted on the same page).
- Changing review/evaluation logic.