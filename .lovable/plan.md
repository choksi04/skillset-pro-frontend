## Goal
Replace the "domain name" shown in the My Assessments and Team Assessments list rows with the **assessment name** (from the linked template). Domain remains visible on detail pages and elsewhere.

## Background
- `assessments` rows do not have a `name` column. They optionally link to `assessment_templates` via `template_id`, which has a `name` field.
- Registry-generated (non-template) assessments have no name. For these we'll show a sensible fallback: `"Skill Registry Assessment"` (and append a short date if helpful).
- Domain currently shown is `assessment.domain_id` resolved via `useDomainStore`. This will be removed from the list rows.

## Changes

### 1. `src/pages/AssessmentsPage.tsx` (My Assessments)
- Import and call `useTemplateStore` + `fetchTemplates()`.
- Add helper:
  ```ts
  const getAssessmentName = (a: Assessment) => {
    if (a.template_id) {
      const t = templates.find((x) => x.id === a.template_id);
      if (t?.name) return t.name;
    }
    return 'Skill Registry Assessment';
  };
  ```
- In the row, replace `{getDomain(a.domain_id)}` with `{getAssessmentName(a)}`.
- Update the search filter to match against assessment name instead of domain name.
- Update placeholder text: "Search assessments by name...".
- Remove the now-unused `getDomain` / `domains` references (keep import only if needed elsewhere; otherwise drop).

### 2. `src/pages/TeamAssessmentsPage.tsx` (Team Assessments)
- Same template lookup as above.
- Row header becomes: `{employeeName} · {assessmentName}` (drop the domain segment).
- Keep the `Reassessment` badge.
- Update search filter to match against employee name + assessment name (drop domain match).
- Update placeholder text: "Search by employee or assessment name...".

### 3. Detail pages — no change required
- `AssessmentDetailPage.tsx` and `TeamAssessmentDetailPage` already show domain context; leave those as-is so domain remains visible where useful.

## Out of scope
- No DB schema changes. No changes to assessment generation logic.
- No changes to the "Unknown Domain" backfill issue (separate concern, previously declined).

## Files to edit
- `src/pages/AssessmentsPage.tsx`
- `src/pages/TeamAssessmentsPage.tsx`
