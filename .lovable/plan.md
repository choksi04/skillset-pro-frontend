## Root cause: false "Cannot start" error

The adaptive assessment `686c1590…` is fully configured — 5 skills, 45–50 published MCQs each, all 5 competency levels active, adaptive_state already initialized in DB. The error is a **bug in the code**, not a config problem.

In `src/stores/adaptiveEngineStore.ts` → `loadCompetencyLevelMap()`:

```ts
supabase.from('competency_levels').select('id, level, name').eq('status', 'active')...
```

The select list omits `status`. The rows are then mapped into `CompetencyLevelConfig` objects where `status: s.status` becomes `undefined`. `getLevelToIdMap()` then does `filter(l => l.status === 'active')`, which drops every row → the map is empty → `getNextQuestion` throws:

> "No active competency levels configured (Settings → Competency Levels)."

That thrown message is caught by `AdaptiveRunner`'s init effect, dumped into `initError`, and rendered under the static "Cannot start this adaptive assessment" panel with the three troubleshooting bullets (which are shown **unconditionally**, so they look like the diagnosis even when they aren't).

### Fix (adaptive bug)

In `src/stores/adaptiveEngineStore.ts` → `loadCompetencyLevelMap()`:

- Include `status` (and the other fields it maps) in the `.select(...)`:
  `select('id, tenant_id, level, name, label, description, score_range_min, score_range_max, min_questions, status')`.
- Because the query already filters `.eq('status','active')`, drop the redundant re-filter — just build `levelToId` / `idToLevel` from the returned rows directly. This removes the class of bug entirely.
- Keep the "No active competency levels" throw, but guard it so it only fires when the DB actually returns zero rows.

No schema change. No other call sites affected — the map shape stays the same.

### Verification

- Reopen the failing URL — adaptive runner loads the first question instead of the error card.
- Confirm the same code path for a fresh adaptive assessment (`initAdaptiveAttempt` → `getNextQuestion`) picks a question at the expected level.

---

## Revoke button — move to Assessment Templates settings

Current placement is wrong: revoke is exposed as a row action on **Team Assessments** and on the **Assessment Detail** page. You asked for it inside **Assessment Templates → assignments sheet**.

### Change

- `src/pages/TeamAssessmentsPage.tsx` — remove the "Revoke" row action, its confirm dialog, `revokeFor` / `revokeReason` state, and the `revokeAssessment` import. Team Assessments becomes read-only for lifecycle actions again.
- `src/components/templates/TemplateAssignmentsSheet.tsx` — this sheet is opened from the Assessment Templates settings page and already lists every assignment for a template. Replace its current `revokeAssignment` call (which only works for `new` rows) with the new `revokeAssessment(assignmentId's assessment_id, reason)` so it handles in-progress / evaluated / verified rows too. Add:
  - A "Revoke" button per row for any status other than `revoked`.
  - A confirm dialog with a required reason textarea (same copy as the current one).
  - Success toast + refresh of the sheet's assignment list.
- `src/pages/AssessmentDetailPage.tsx` — leave the revoke button here for now (it's the natural place when an admin has already drilled into a specific assessment). If you want it removed too, say so and I'll strip it in the same pass.

No store or DB changes — `revokeAssessment` in `assignmentStore.ts` already does the full soft-delete cascade.

### Verification

- Team Assessments list shows no revoke action.
- Settings → Assessment Templates → open a template → Assignments sheet → each active row shows a Revoke button; clicking it, entering a reason, and confirming soft-deletes the assignment + assessment + attempts and lets the same template be re-assigned to the same employee.