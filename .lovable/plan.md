## Overview

Five focused, mostly frontend changes. No new tables — all backing columns/logic already exist. Business rules (Skill Registry independence, manager authority, competency levels) are preserved.

---

## 1. Reassign Reviewer from Team Assessment

Managers currently can't change who reviews a submitted assessment. `manager_reviews.reviewer_id` already exists and `reviewStore.reassignReviewer` is already implemented — only the UI is missing.

- On `src/pages/TeamAssessmentsPage.tsx`, in each row (or via a row action menu), when the row has a review (any `pending` / `in_progress` state, not `completed`) show a "Reviewer" cell with the current reviewer name and a "Change" action.
- Clicking it opens a small dialog with a `SearchableSelect` listing eligible reviewers: users where `role in ('admin','manager')`, in the same tenant, not soft-deleted. Managers are restricted to the assessment's domain; admin can pick any. Exclude the employee themselves.
- On confirm, call `reassignReviewer(reviewId, newReviewerId)` and refresh via `{ force: true }`. Send a `notifications` row to the new reviewer ("Review reassigned to you for {employee} — {domain}").
- If the review is `completed`, hide the reassign action.
- Also surface the same control inside `ManagerReviewPanel.tsx` header so it works from `AssessmentDetailPage` too.

---

## 2. Auto-demote Manager → Employee when not a Domain Lead anywhere

Rule: a user with `role = 'manager'` must lead at least one active domain (`domains.domain_lead_id = users.id`, `deleted_on IS NULL`, `status = 'active'`). Otherwise their effective role is `employee`.

Enforced in three places (no schema change):

- **DomainFormDialog / DomainsPage**: after saving a domain where `domain_lead_id` changed (old lead removed / replaced), check whether the previous lead still leads any other active domain. If not and their `role = 'manager'`, update `users.role = 'employee'` and toast "{name} no longer leads a domain — role updated to Employee". Same check when a domain is deleted/disabled.
- **UsersPage save**: when an admin sets `role = 'manager'` without any domain-lead assignment, warn and block save (existing "Domain required" guard already covers half of this — extend to require the user to actually be a lead of at least one domain, or auto-promote via DomainFormDialog first).
- **AuthContext / login**: on `refreshUser`, run the same check for the current user. If they are marked `manager` in DB but lead no active domain, silently persist `role = 'employee'` and use the corrected value for the session.

Admins are unaffected.

---

## 3. Cap Achieved Level when >50% of a skill's questions are wrong

Rule (per skill): if the correct-answer ratio for that skill is **strictly less than 50%**, subtract 1 from the derived achieved level (floor at 0 / "Not achieved"). Applied uniformly:

- `src/lib/assessmentStatus.ts` → `getAchievedLevelFromAttempt`:
  - Adaptive branch: for each skill, if `correct/total < 0.5`, set `achieved = achieved != null ? Math.max(0, achieved - 1) : null`, then compute overall as today.
  - Fixed branch: derive per-skill correct ratio from `avg_score` (already used to compute `correct`). If `correct/question_count < 0.5`, do `calculated_level = Math.max(0, calculated_level - 1)` in the local mapping used for the average; do not write this back to `attempt_skill_scores` (display-only) unless we also update the persisted score.
- `src/components/assessment/ResultSummaryCard.tsx`: mirror the same cap so the per-skill "Achieved" badge shown to the employee matches the list view.
- `src/stores/adaptiveEngineStore.ts` and `src/stores/attemptStore.ts` where `attempt_skill_scores.calculated_level` is written: also apply the cap so the stored `calculated_level` matches what the UI shows and what the manager review starts from. This keeps `manager_reviews`/`ai_calculated_level` consistent.
- Manager can still override in the review panel (manager authority rule preserved).

Ties (exactly 50%) keep the level. Skills with zero answered questions still return `null`.

---

## 4. Show Topic and Question Type alongside Skill during Assessment

Runner header already shows skill name + target level + type. Add the topic (from `questions.topic_id` → `skill_topics.name`) and keep type visible with clearer labeling.

- Extend the question fetch in `FixedRunner.tsx` / `AdaptiveRunner.tsx` to include `topic_id` in the question `select(...)` and load the referenced `skill_topics` (name only) — batched, deduped, one call per runner mount.
- Update the question header row (`FixedRunner.tsx` ~L668, and the matching block in `AdaptiveRunner.tsx`) to render:
  - `Skill: <name>` badge
  - `Topic: <name>` badge (only if the question has a topic)
  - `Level: L{n} – <label>` badge
  - `Type: MCQ / Coding / Scenario` badge
- Same information also shown on the review-side question detail in `EvalResults.tsx` for continuity.

No schema change; `questions.topic_id` and `skill_topics` are already in the DB.

---

## 5. Tags on Skill Registry after submission

Tags already render in the editing view (`SkillRegistryDetailPage` self-review form, lines ~755–763) but the read-only submitted view (lines ~601–644, the "Skill / Category" grid) omits them.

- In the submitted rendering block, replace the current skill cell with:
  - `skill_name` (primary)
  - `skill_category` (muted, existing)
  - a tag chip row matching the editing view style (`Tag` icon + muted chips) when `skill.tags?.length > 0`.
- Do the same on `TeamRegistryDetailPage.tsx` (manager view of a submitted registry) so tags are visible during review/approval.
- No changes to `RegistrySkillTable.tsx` accordion view unless the same detail page uses it — verify and mirror if so.

---

## Technical notes

- No migrations. All required columns (`manager_reviews.reviewer_id`, `questions.topic_id`, `skill_topics`, `domains.domain_lead_id`, `skills.tags`) already exist.
- Preserve existing store guards (`initialized`, in-flight dedup) added in the recent API audit — new fetches (eligible reviewers, topics) must reuse existing stores (`skillStore` topics, `usersStore` if present, else a scoped one-shot fetch cached at page level).
- No changes to scoring persistence semantics beyond the >50%-wrong cap in #3, which is applied both at write time and at read time to keep list/detail/review in sync.
- Manager authority: #3 only changes the AI-derived baseline; the manager can still adjust in `ManagerReviewPanel`.
- Documentation: update the User Guide sections for Team Assessments (reassign reviewer), Assessment scoring (>50% cap), Assessment runner (topic/type), Skill Registry (tags visible post-submit), and User/Role management (auto-demotion).

## Verification

- Reassign reviewer: create a review, reassign, confirm DB `reviewer_id` and that the new reviewer receives a notification and sees it under "My Reviews"; original reviewer no longer sees it.
- Auto-demote: remove a manager as domain lead of their only domain → their `users.role` flips to `employee`; sidebar and dashboard reflect employee view on next load.
- >50% cap: seed an attempt with 3 questions on a skill, 1 correct at L3 → achieved becomes L2; with 2 correct out of 3 at L3 → stays L3.
- Runner: open an assessment with topic-tagged questions and verify Skill / Topic / Level / Type badges all appear; questions without topics show only Skill / Level / Type.
- Registry tags: submit a registry with tagged skills; open the submitted view as employee and as manager (Team Registry) — tags visible in both.
