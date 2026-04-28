## Goal
Strip every reference to **Review Cycles** and **auto-generated assessments** from the User Guide and Guided Tour. Replace with template-based assignment language.

## Changes

### `src/pages/UserGuidePage.tsx`

1. **Platform Overview bullet** (line 28): `'When a Review Cycle is activated, the system auto-generates an assessment per employee using the active template and their submitted self-ratings.'` → `'Admins create assessments from a template and assign them to employees.'`

2. **Navigation Structure** (line 45): drop "Review Cycles" from the Settings list. New text: `'Settings — Skill Library, Domains, Users, Question Bank, Assessment Templates, and Assessment Config for platform configuration.'`

3. **Setup Flow Step 7** (line 66): `'Step 7: Activate a Review Cycle to auto-generate assessments for submitted registries using the active template.'` → `'Step 7: Create an assessment from a template and assign it to employees from the Assessment Templates page.'`

4. **Assessment Templates section**:
   - Line 116 description: drop "Required before activating a Review Cycle." → `'Reusable blueprints that define how an assessment is generated and delivered.'`
   - Line 124: `'switch Status to Active to make it available for Review Cycles.'` → `'switch Status to Active to make it available for assignment.'`
   - Line 125: drop "Active templates linked to a running cycle are protected." → `'Templates can be edited, duplicated, or soft-deleted.'`
   - Add a new step after Status: `'Use the Assignments sheet on a template to assign it to one or many employees — assigned assessments appear in their Assessments list.'`

5. **Assessment Configuration section** (lines 136–137): rephrase "readiness gate" / "generation caps" without referencing cycles:
   - `'Configure Question Limits per level — minimum number of published questions per skill+level required to build an assessment.'`
   - `'Configure generation caps — maximum questions per skill+level included when an assessment is built.'`

6. **Review Cycles section** (lines 141–154): **delete entirely**.

7. **Employee — My Skill Registry** (line 226): `'The Skill Registry is always available — no need to wait for an active review cycle.'` → `'The Skill Registry is always available — submit anytime.'`

8. **"How the Platform Works" chip strip** (line 315): rename `'Auto-Generated Assessment'` → `'Assigned Assessment'`.

### `src/stores/onboardingStore.ts`

1. **Templates step** (line 42): `'Templates are the blueprint a Review Cycle uses to generate assessments.'` → `'Templates are the blueprint admins use when assigning assessments to employees.'`

2. **`cycles` core tour step** (lines 52–56): **delete entirely**.

3. **`admin-templates` extra step** (line 94): `'Required before activating a cycle.'` → `'Required before assigning an assessment.'`

## Out of scope
- No DB changes.
- The Review Cycles page/route (if any) remains — only User Guide & Tour content is updated.
