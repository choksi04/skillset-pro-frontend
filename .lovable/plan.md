## Plan: Redesign Detail Pages & Fix Listing Issues

### Changes

#### 1. `src/pages/SkillRegistryDetailPage.tsx` — Redesign detail view

**Header section** (consistent with Skill Library pattern):

- Back button (arrow left + "Back to My Registry")
- Page title: cycle name (e.g., "Q1 2026 Review")
- Description: domain name + submission date
- Status badge inline with title

**Score tiles** (beautified with icons):

- 4 cards in a grid: Self Score (with `BarChart3` icon), Assessment Score (with `ClipboardCheck` icon), Final Score (with `Award` icon), Manager (with `UserCheck` icon + avatar + hover card + review comment)
- Enhanced `ScoreCard` component to accept an icon prop

**Remove**: Rating scale legend (lines 483-495 in SelfReviewForm)

**Accordion default**: Change `defaultValue` to `[]` (collapsed) for both draft and read-only views

**Closed cycle handling**: When cycle is closed and submission is still draft, show a locked banner: "Review cycle has closed. Your draft was not submitted in time." Disable all inputs and hide submit button. Status shows as "Incomplete — Cycle Closed".

#### 2. `src/pages/TeamRegistryDetailPage.tsx` — Same header/tile pattern

- Same header structure: back button, employee name as title, domain/cycle/date as description, status badge
- Same beautified score tiles with icons with trend icon on assessment and final score to show the upwards or downward graph compare to self-score.
- Accordion collapsed by default

#### 3. `src/components/registry/ScoreCard.tsx` — Add icon support

- Add optional `icon` prop (React element)
- Render icon above/beside the value

#### 4. `src/components/registry/RegistrySkillTable.tsx` — Collapse by default

- Change `defaultValue={Array.from(grouped.keys())}` → `defaultValue={[]}`

#### 5. `src/pages/SkillRegistryPage.tsx` — Fix manager avatar on listing

The manager avatar only shows when `reviewerMap` has data. The issue: `reviewerMap` is built from `reviews` filtered by `employee_id`, but the enrichment loop also checks `reviewerMap[review.reviewer_id]`. If the reviewer fetch hasn't completed or the reviewer ID isn't in the map, it shows nothing. Fix: ensure reviewer lookup covers all reviews for the current employee's submissions (not just by `employee_id` filter on reviews).

#### 6. `src/components/registry/registryHelpers.ts` — Add closed cycle status

- Add `'incomplete'` to `EmployeeStatus` type
- Add config: `incomplete: { label: 'Incomplete — Cycle Closed', color: 'bg-destructive/15 text-destructive', cta: 'View Draft', ctaDisabled: false }`

#### 7. Closed cycle + draft behavior

In `SkillRegistryDetailPage`, when submission is draft AND the cycle is closed (not active, grace period expired):

- Show locked banner
- Disable rating inputs
- Hide submit button
- Show status as "Incomplete — Cycle Closed"

In `SkillRegistryPage` listing, the active card CTA for closed+draft: navigate to detail (read-only view of draft)

---

### File Summary


| File                                             | Change                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `src/pages/SkillRegistryDetailPage.tsx`          | Redesign header, beautify score tiles with icons, remove rating scale, collapse accordions, handle closed cycle |
| `src/pages/TeamRegistryDetailPage.tsx`           | Same header/tile redesign, collapse accordions                                                                  |
| `src/components/registry/ScoreCard.tsx`          | Add icon prop                                                                                                   |
| `src/components/registry/RegistrySkillTable.tsx` | Default collapsed                                                                                               |
| `src/pages/SkillRegistryPage.tsx`                | Fix manager avatar not showing                                                                                  |
| `src/components/registry/registryHelpers.ts`     | Add 'incomplete' status                                                                                         |
