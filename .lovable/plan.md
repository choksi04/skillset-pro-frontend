## Problem

On the Assessment Template edit page (adaptive type), "Skills per Assessment" is not validated against the actual pool of available skills. If a domain has 5 mapped skills (or the user picked 5 in custom mode) and the user enters `10`, the template still saves/activates with no warning.

## Fix (frontend-only, in `src/pages/AssessmentTemplateEditPage.tsx`)

1. **Compute the available skill pool** for adaptive templates:
   - Custom mode → `pickedSkills.length`
   - Otherwise → `skillsForDomain.length` (skills mapped to the selected domain)

2. **Add a blocking validation** in the `errors` array (line ~141 block):
   - If `skillsPerAssessment > availablePool` (and pool > 0), push an error like:
     `"Skills per Assessment (10) exceeds available skills (5) in this domain/selection"`.
   - This prevents activation and surfaces via the existing toast on save.

3. **Add an inline warning** directly under the "Skills per Assessment" input (line ~407) when the value exceeds the pool, in destructive text style:
   `Only N skill(s) available — reduce this value or add more skills.`

4. **Live cap on the input's `max` attribute** to the available pool (when pool > 0), so the number stepper reflects the real ceiling. Keep the upper bound of 20 as a global cap.

No changes to backend, store, or assessment generation logic — purely the template editor's validation & UX.

## Files touched
- `src/pages/AssessmentTemplateEditPage.tsx`
