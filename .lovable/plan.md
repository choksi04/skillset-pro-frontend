
# Plan: Queued Follow-ups

Four independent items, ordered by user impact. Each can ship on its own.

---

## 1. Reviewer Reassignment on Team Assessments

**Goal:** Let an admin/manager change who reviews a submitted assessment without touching the database.

**Where:**
- `src/pages/TeamAssessmentsPage.tsx` — add a "Change Reviewer" action in the row menu.
- `src/components/assessment/ManagerReviewPanel.tsx` — add a "Reassign" control in the header (visible while review is pending).

**Behavior:**
- Opens a small dialog with a `SearchableSelect` of eligible reviewers (users with role `manager` or `admin`, excluding the assessment owner).
- On confirm, updates `assessments.reviewer_id` (or the equivalent field — will verify during build), writes an audit entry, and creates a notification for the new reviewer.
- Confirmation prompt if a review has already started, warning that in-progress notes stay with the record.

**Access:** Admin anywhere; Manager only within their domain.

---

## 2. Auto-Demote Manager When Domain-Lead Status Is Lost

**Goal:** Keep the `manager` role in sync with domain-lead assignments so an ex-lead doesn't retain elevated access.

**Where:**
- `src/pages/DomainDetailPage.tsx` — when the current lead is replaced/removed, if that user isn't a lead of any other domain, demote them to `employee`.
- `src/pages/UsersPage.tsx` — when an admin edits a user and tries to demote a current domain lead, block with a clear message ("Reassign the domain lead first").
- `src/contexts/AuthContext.tsx` — on session refresh, if the stored role is `manager` but the user leads no domain, refresh from DB to auto-correct.

**Behavior:**
- All role changes go through a single helper (new `src/lib/roleSync.ts`) so promote/demote logic lives in one place.
- Toast + audit entry on every auto-change.
- Admins are never auto-demoted.

---

## 3. Verified-Level Error Cap (>50% wrong → cap level)

**Goal:** Prevent the verified/achieved level from exceeding what the raw performance justifies, regardless of manager overrides landing higher than the evidence.

**Where:**
- `src/lib/assessmentStatus.ts` — extend `getAchievedLevelFromAttempt` and `getVerifiedLevelFromReviews`.

**Rule:**
- Compute error rate per skill = incorrect answers / total answered (skipped counts as incorrect for this rule).
- If error rate > 50%, cap the achieved level at `max(L1, self_rated_level - 1)` for that skill.
- Verified level is then `min(managerAdjusted, cappedAchieved)` — manager can only *reduce*, not inflate past the cap.
- Applies only to fixed assessments (adaptive already respects streaks); flagged via the existing `assessment.mode` field.

**Surfaces affected:** `AssessmentsPage`, `TeamAssessmentsPage`, `AssessmentDetailPage`, `SkillRegistryDetailPage` — all read through the shared helper, so no per-page logic changes.

---

## 4. Skill Tags in Registry Detail Views

**Goal:** Show the free-text skill tags on the read-only registry views so reviewers see the same context as authors.

**Where:**
- `src/pages/SkillRegistryDetailPage.tsx` — employee's submitted breakdown.
- `src/pages/TeamRegistryDetailPage.tsx` — manager's review view.

**Behavior:**
- Render tags as small pill badges under the skill name in each row of the skill table.
- Pull from the existing `skills.tags` field already fetched via `skillStore`; no new query.
- No edit affordance on these pages — display only.

---

## Verification per item

- **Reviewer reassign:** open a submitted team assessment, reassign to another manager, confirm the new reviewer sees it in their queue and the old one doesn't.
- **Auto-demote:** replace a domain lead, refresh the demoted user's session, confirm role is `employee` and Team pages are gated off.
- **Error cap:** query an existing attempt with >50% wrong on a skill, confirm achieved/verified level is capped.
- **Registry tags:** open both registry detail views, confirm tags render for skills that have them and nothing renders for skills that don't.

---

## Technical notes

- No schema changes required — all four items work off existing columns.
- All new/changed dropdowns use `SearchableSelect` per project convention.
- Every role or reviewer change writes an audit row via the existing `src/lib/audit.ts` helper.
- Error-cap logic is centralized in `assessmentStatus.ts` so future surfaces stay consistent.

---

## Order of implementation

I'll ship in this order unless you'd prefer otherwise:
1. Skill tags in registry (smallest, pure UI)
2. Verified-level error cap (isolated helper logic)
3. Reviewer reassignment (new UI + mutation)
4. Manager auto-demote (touches auth + multiple pages)

Want me to reshuffle, drop any, or expand one before you approve?
