## Manager Review — Rebuild to Literal Spec

Collapse the existing 3-action model (Approve / Adjust / Reassess) into the simpler flow defined in the spec:

- **STEP 1 — View**: answers + AI evaluation
- **STEP 2 — Actions**: adjust score, add comments, mark verified
- **STEP 3 — Rule**: final score = verified score (manager's value)

"Reassess" disappears as a per-skill action. Reassessment remains a separate, existing flow (`reassessment_requests` table, triggered elsewhere) and is unaffected. Reassess is out of scope completely.

---

### Behavior changes

**Per-skill row (new model)**

- Always shows: Skill · Self Rating · AI Level + Score · Verified Level · Comment.
- "Verified Level" defaults to the AI-calculated level. Manager can edit it inline (Select L1–L5) — editing it is the "adjust score" action.
- Inline comment icon opens a small popover/dialog to edit per-skill comment.
- A row is considered "actioned" once the manager has touched it (changed the level OR explicitly clicked Verify on the row, OR the panel-level Verify-All is used).

**Panel actions**

- Per-skill: edit Verified Level + edit Comment (auto-saved).
- Overall: Overall Comment textarea + single primary button **"Mark Verified"** (replaces "Finalize Review").
- "Mark Verified" requires every row to have a Verified Level set (defaults to AI level on load, so this is satisfied unless explicitly cleared).

**Final score rule**

- On Mark Verified: every skill produces an `official_skill_entries` row with `final_level = verified_level` (the manager's value, which is AI level by default or the adjusted value).
- No skill is dropped (today's "reassess" filter is removed).
- Assignment status transitions to `verified` (already wired via `syncAssignmentForReview`).

---

### Files to change

**Data model (migration)**

- `supabase/migrations/<ts>_review_verified_score.sql`
  - `ALTER TABLE review_skill_entries ADD COLUMN verified_level integer`.
  - Backfill: `verified_level = COALESCE(manager_adjusted_level, ai_calculated_level)` for existing rows where `manager_action` is not 'reassess'.
  - Keep `manager_action` and `manager_adjusted_level` columns (don't drop — historical data + reduces blast radius). New code stops writing to them.

**Store (`src/stores/reviewStore.ts`)**

- Remove `ReviewAction` type. Replace `SkillReviewEntry` fields:
  - drop `manager_action`, `manager_adjusted_level`
  - add `verified_level: number`, initialized to `ai_calculated_level`
- Replace `setSkillAction(...)` with `setVerifiedLevel(reviewId, skillId, level)`.
- Keep `setSkillComment`, `setOverallComment`.
- Rename `completeReview` → `verifyReview`. New logic: insert one `official_skill_entries` row per skill using `verified_level` as `final_level`. No filtering.
- `fetchReviews`: read `verified_level` (fallback to `ai_calculated_level`).
- `createReview`: insert with `verified_level = ai_calculated_level`.

**UI**

- `src/components/assessment/ManagerReviewPanel.tsx` — rewrite skill row + footer:
  - Replace Approve/Adjust/Reassess buttons with an inline Verified-Level Select + comment icon.
  - Replace "Finalize Review" with "Mark Verified" (confirmation dialog updated copy).
  - Drop the "skills marked for reassessment will not generate entries" warning.
- `src/pages/ReviewsPage.tsx` — same row/footer rebuild as the panel above.
- `src/pages/AssessmentDetailPage.tsx` — `getEffectiveStatus`: rename `"approved"` label/key path if needed (it currently maps `review.status === 'completed'` → `"approved"`; keep the key, just ensure the badge reads "Verified").
- `src/stores/onboardingStore.ts` — update Manager step copy from "Approve, adjust, or request reassessment for each skill." to "Adjust scores and mark each review as verified.".

**Untouched**

- `reassessment_requests` table and the existing reassessment workflow (separate feature). - Remove this as this is out of scope now
- Notifications, reviewer reassignment, AI feedback details panel.
- Assignment status machine — `verified` already wired.

---

### Edge cases

- Existing in-flight reviews with `manager_action = 'reassess'` and no `verified_level` after migration: backfill leaves `verified_level` NULL for those rows; UI defaults the Select to `ai_calculated_level` so manager can still finish them under the new model. They will produce an official entry on Mark Verified (no longer skipped).
- Self-review (reviewer == employee) flow unchanged.
- Admin reviewer reassignment unchanged.

---

### Out of scope

- No changes to the assessment generation, AI evaluation, attempt, or registry submission flows.
- No new permissions or RBAC changes.
- Reassess