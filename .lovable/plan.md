## Goal
Refresh the in-app **Help & Tutorial** (`UserGuidePage.tsx`) and the **Guided Tour** (`onboardingStore.ts`) so they reflect every feature shipped recently — Assessment Templates, the adaptive engine, simplified result cards, manager review actions, dynamic competency levels, and notifications.

## Files Updated

### 1. `src/pages/UserGuidePage.tsx` — User Guide content overhaul

**Platform Overview** — rewrite the 5 bullets to describe the full real flow: Self-Registry → Template-driven Assessment Generation → Adaptive Engine → AI/MCQ Evaluation → Manager Review (Approve/Adjust/Reassess) → Validated Registry.

**Setup Flow (Admin)** — extend to 7 steps:
1. Create Skills (Categories → Skills → Topics)
2. Create Domains (assign Domain Lead + Managers)
3. Map Skills to Domains
4. Add Questions (MCQ / Coding / Scenario, manual or AI)
5. Configure Competency Levels & Assessment Config
6. Create an Assessment Template (adaptive or fixed) and pick skills manually
7. Activate a Review Cycle

**Admin Guide** — add three new sections, refine existing:
- **Assessment Templates** (new): adaptive vs fixed, manual skill selection (Top N is "Coming Soon"), question types per template, duration, max attempts, publishing.
- **Review Cycles** (new section under admin): activate one cycle per tenant, scope by domain, manual interventions (resubmit, regenerate, reset).
- **Notifications** (new): global header dropdown, automated reminders.
- Refine **Question Bank** to mention the three question types (Single/Multi MCQ, Scenario, Coding), AI generation preview & inline edit, coverage gaps indicator, sorting by recency.
- Refine **Assessment Config** to call out: 5-level framework derived from DB, configurable score ranges, question-limit-per-level, and that L5 must end at 100.

**Manager Guide** — refine:
- **Team Registry** — current vs version history, trend indicators.
- **Review Workflow** — explicitly list the three actions: **Approve**, **Adjust** (set a different level with required comment), **Reassess** (request a fresh attempt). Mention inline review panel inside the Assessment Detail page. Self-approval is blocked.

**Employee Guide** — refine:
- **My Skill Registry** — already current; add a note about domain assignment being a prerequisite.
- **Assessments** — describe the modern exam UI (sidebar status, timer, navigation), adaptive progression (questions adapt to your answers), and the new **Result Summary**: shows Achieved Level (e.g. "L3 - Intermediate"), correct/wrong counts, and skill-wise breakdown — no percentages, terminology is "Assessment Score" not "AI Score".

### 2. `src/stores/onboardingStore.ts` — Guided Tour refresh

Add four new tour steps to `coreTourSteps`/role extras:
- **`templates`** (admin): "Assessment Templates — design reusable adaptive or fixed assessments before activating a review cycle." Targets `[data-tour="templates"]`.
- **`competency-config`** (admin): "Competency Levels — configure your 5-level framework and score ranges." Targets `[data-tour="assessment-config"]`.
- **`adaptive-result`** (employee): "Your Result — see the level you achieved per skill after submitting." Centered, no selector.
- **`review-actions`** (manager): "Approve, Adjust, or Reassess each skill from the inline review panel."

Reorder `coreTourSteps` so the lifecycle reads: Dashboard → Skills → Domains → Questions → Templates → Registry → Assessment → AI Evaluation → Result → Manager Review → Validated Registry.

Update wording on the **`assessment`** step to mention adaptive progression and on **`final-registry`** to mention version history + All Registries.

### 3. README.md — leave as-is
The README is generic Lovable boilerplate and isn't user-facing documentation.

## Out of scope
- No DB migrations.
- No new components — content-only edits.
- No new tour data-attributes are introduced if the target page already lacks them; new tour steps that reference missing selectors will gracefully render centered (existing GuidedTour behavior).
