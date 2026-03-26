

## Plan: Add Child Routes for Registry Detail Pages

### Problem
Currently, both My Registry and Team Registry render detail views inline (swapping components via state) instead of using proper child routes. The Self Review form, skill categories, and scores all appear on the listing page. Additionally, Team Registry listing lacks the score columns (Self, Assessment, Final, Manager) that My Registry has.

### Architecture

```text
/skill-registry              → Listing only (active card + past cards)
/skill-registry/:id          → Detail/Self-Review page (child route)

/team-registry               → Listing only (submissions with score columns)
/team-registry/:id           → Detail page (member's scores + skill breakdown)
```

### Changes

#### 1. `src/App.tsx` — Add child routes
- Add `/skill-registry/:submissionId` route rendering a new `SkillRegistryDetailPage`
- Add `/team-registry/:submissionId` route rendering a new `TeamRegistryDetailPage`

#### 2. `src/pages/SkillRegistryPage.tsx` — Strip to listing only
- Remove `SelfReviewForm`, `RegistryDetailView`, `ScoreCard` components and all inline detail rendering
- Remove `showForm`, `detailSubmissionId` state and related logic
- Keep: Active cycle card (with scores + CTA), past registry card list, enrichment logic
- CTA button now navigates to `/skill-registry/:submissionId` (for existing draft/submission) or creates a new draft first then navigates
- Past registry "View" button navigates to `/skill-registry/:id`
- Move `SelfReviewForm`, `RegistryDetailView`, `ScoreCard`, `ScoreChip`, `ManagerAvatar` into shared components or the detail page file

#### 3. New `src/pages/SkillRegistryDetailPage.tsx`
- Reads `:submissionId` from URL params
- If submission is draft/in_progress → shows `SelfReviewForm` with auto-save, comments, previous ratings
- If submitted/completed → shows `RegistryDetailView` (score cards, skill table with Self/Assessment/Final/Gap)
- Includes confirm/success dialogs for submission
- Back button navigates to `/skill-registry`

#### 4. `src/pages/TeamRegistryPage.tsx` — Add score columns to listing
- Add enrichment logic (same pattern as My Registry): compute selfAvg, assessmentAvg, finalAvg, reviewer info for each submission
- Fetch assessment/attempt/review/official data from stores
- Display score columns (Self, Assessment, Final, Manager avatar) on each submission card
- Remove inline `TeamMemberDetail` rendering
- "View" click navigates to `/team-registry/:submissionId`

#### 5. New `src/pages/TeamRegistryDetailPage.tsx`
- Reads `:submissionId` from URL params
- Shows employee name, domain, cycle, status
- Score cards: Self avg, Assessment avg, Final avg, Manager info
- Skills grouped by category with Self/Assessment/Final/Gap table (same as `RegistryDetailView`)
- Back button navigates to `/team-registry`

#### 6. `src/components/layout/PageHeader.tsx` — Breadcrumbs
- Add dynamic breadcrumb for `/skill-registry/:id` → `Operations > My Registry > Detail`
- Add dynamic breadcrumb for `/team-registry/:id` → `Operations > Team Registry > Detail`

#### 7. Extract shared components
Move reusable components to `src/components/registry/`:
- `ScoreChip.tsx` — score badge
- `ManagerAvatar.tsx` — avatar with hover card
- `ScoreCard.tsx` — large score display card
- `RegistrySkillTable.tsx` — category-grouped skill table with Self/Assessment/Final/Gap columns

This avoids duplicating the same UI between My Registry detail and Team Registry detail.

### Summary

| File | Action |
|------|--------|
| `src/App.tsx` | Add 2 child routes |
| `src/pages/SkillRegistryPage.tsx` | Strip to listing-only, CTAs navigate to child route |
| `src/pages/SkillRegistryDetailPage.tsx` | New — self-review form or read-only detail based on status |
| `src/pages/TeamRegistryPage.tsx` | Add score columns, navigate to child route |
| `src/pages/TeamRegistryDetailPage.tsx` | New — read-only detail with score cards + skill table |
| `src/components/registry/` | Extract `ScoreChip`, `ManagerAvatar`, `ScoreCard`, `RegistrySkillTable` |
| `src/components/layout/PageHeader.tsx` | Add breadcrumbs for detail routes |

