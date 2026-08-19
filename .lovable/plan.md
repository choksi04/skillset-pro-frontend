# Fix: adaptive assessment generates 28 questions instead of 48

## Confirmed root cause

The Data batch templates ("Data - 1st/2nd/3rd/4th Batch Test", "Data Test Assesment V1") are adaptive, custom skill mode, 12 skills x 4 questions per skill = 48 expected. Every generated assessment for those templates contains only 7 skills (28-31 questions).

Checked in the database: all 12 template skills are active and each has 44-600 published, non-deleted MCQs across all 5 competency levels — 1384 MCQ rows in total for the 12 skills. No question is ineligible.

The pre-flight "which skills have MCQs" query in the adaptive engine fetches one row per matching question:

```text
questions.select('skill_id').in('skill_id', <12 skills>).eq('question_type','mcq').eq('status','published')
```

That returns 1384 rows, but the API caps a single response at 1000 rows. The skills whose rows fall past the 1000-row cutoff (one skill alone has 600 questions) never appear in the response, so they are treated as "no MCQs" and silently dropped from the attempt. 7 surviving skills x 4 questions = 28.

So: not filters, not caps on question count, not stale config, not duplicate handling — it is a row-limit truncation in the availability pre-check, which then drops whole skills.

## The fix (smallest atomic change)

Replace the row-listing availability check with a per-skill existence check that cannot be truncated, and surface any genuinely empty skill instead of dropping it silently.

1. New tiny helper `src/lib/questionAvailability.ts`
   - `getSkillsWithPublishedMcqs(skillIds: string[]): Promise<Set<string>>`
   - Runs a `head: true` exact-count query per skill (batched in small parallel groups) with the exact same eligibility filters used at question-pick time: `question_type = 'mcq'`, `status = 'published'`, `deleted_on is null`.
   - Returns only skills with count > 0. No row payloads, so no 1000-row ceiling.

2. `src/stores/adaptiveEngineStore.ts` (`initAdaptiveAttempt`)
   - Use the helper instead of the `select('skill_id')` listing query.
   - `console.warn` the skill ids excluded for having zero eligible MCQs, so exclusions are traceable.

3. `src/stores/assignmentStore.ts` (adaptive pre-flight before creating the assessment)
   - Use the same helper for the same reason, so assignment-time validation and attempt-time initialization agree.

No schema change, no new architecture, no change to scoring, submission, registry, review, fixed-template, or question bank logic.

## Result

- All 12 skills with eligible MCQs are kept, so the attempt asks 4 questions per skill = 48, matching the template preview.
- A skill is excluded only when it truly has zero published, non-deleted MCQs, and that exclusion is logged.

## Manual test steps

1. Assign "Data - 1st Batch Test" to an employee, start the assessment, and confirm the runner walks through all 12 skills and 48 questions.
2. Confirm `assessment_questions` for the new assessment has 48 rows across 12 distinct skills.
3. Assign a small template (e.g. "RPA Batch - 1", 2 skills x 5) and confirm behaviour is unchanged.
4. Assign a template that includes a skill with no published MCQs and confirm that skill is skipped with a console warning while the rest still generate.
5. Confirm fixed-type templates are unaffected.

## Edge cases covered

- Skill sets whose total question rows exceed 1000 (the reported case).
- Skills with only unpublished or soft-deleted questions (still correctly excluded).
- Templates with zero eligible skills (existing "No published MCQs available" failure message still returned).
