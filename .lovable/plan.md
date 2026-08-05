# Fix: Submit Assessment appears too early

## What the employee sees

After answering only a couple of questions, the runner already offers "Review & submit", which invites submission before the assessment is actually finished.

## What the reads show

Two separate runners exist and each contributes a different part of the problem.

**Fixed runner (`FixedRunner.tsx`)**
- The per-question footer is already correct: it shows Next for middle questions and only swaps to "Review & submit" on the last question.
- The page header renders a permanent primary "Review & submit" button (top-right, next to Timer/Pause/Exit) on every question. Since it is styled as the primary action, it reads as "submit now" from question 1 onward.

**Adaptive runner (`AdaptiveRunner.tsx` + `adaptiveEngineStore.ts`)**
- The planned total is `skills × questionsPerSkill`, which is what the header advertises ("Question 1 of up to N").
- `getNextQuestion` marks a skill `done` whenever no unused published MCQ can be found at any level for that skill, then recurses. When the question bank is thin, every skill can be exhausted after one or two questions.
- Once all skills are `done`, the runner sets `reviewOpen = true`, so the employee lands on the Submit screen after 2 answers even though the header promised many more.

So: fixed assessments show an always-visible submit affordance; adaptive assessments genuinely end early because of question-bank exhaustion, with no explanation.

## The fix (smallest atomic change, UI-layer only)

Scope: `src/components/assessment/FixedRunner.tsx` and `src/components/assessment/AdaptiveRunner.tsx`. No store, engine, backend, schema, scoring or evaluation changes.

**1. Fixed runner — gate the header action to the end of the assessment**
- Keep a header button, but only render the primary "Review & submit" variant when the employee is on the last question or every question already has an answer.
- Before that point, render the same button as a secondary/outline "Review answers" affordance that still opens the review list (so navigation and the existing review panel are preserved) — the review panel's Submit button already guards incompleteness via the existing confirm dialog.
- The per-question footer Next/Previous/Skip behaviour is untouched.

**2. Adaptive runner — don't present Submit as the natural next step when the engine stopped early**
- When the engine returns no further question, still open the review screen (the only terminal path available), but show an explicit notice when `answered.length` is below the advertised planned total: state that the adaptive engine ran out of eligible questions for the selected skills and that this is the end of the assessment.
- Correct the header copy so the advertised total never exceeds what the engine can actually deliver: cap the displayed total at the number of questions actually asked once the engine reports completion.

## Explicitly not changed

- Adaptive completion rules, level stepping, `questionsPerSkill`, and skill `done` logic.
- Fixed-assessment question list, order, or assigned count.
- Resume/rehydration behaviour in either runner.
- Scoring, evaluation, review creation, registry, question bank, dashboard.

## Manual test steps

1. Fixed assessment with 10 questions: on questions 1–9 the header shows a secondary "Review answers"; the footer shows Next. Only on question 10 (or once all 10 are answered) does the primary "Review & submit" appear.
2. From a middle question, click "Review answers" — the review list opens, Submit still triggers the existing incomplete-assessment confirmation.
3. Adaptive assessment with a healthy bank: full run, review opens only after the planned number of questions.
4. Adaptive assessment with a thin bank (1–2 questions per skill): the run ends early, the review screen explains that eligible questions were exhausted, and the header no longer claims a larger remaining total.
5. Close and reopen both runner types mid-assessment: prior answers still restore and the button rules apply to the resumed position.

## Edge cases

- Single-question fixed assessment: primary Submit shows immediately (correct — it is the last question).
- All questions answered but employee is on question 3: primary "Review & submit" shows, since the assessment is genuinely complete.
- Paused state: header submit stays disabled exactly as today.
