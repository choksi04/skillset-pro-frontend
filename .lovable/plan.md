

## Plan: Split Skill Registry into Two Separate Pages

Split the current `SkillRegistryPage.tsx` (which uses tabs for My/Team) into two dedicated pages with separate routes and sidebar entries, matching the pattern used by Assessments and Manager Reviews.

---

### Architecture

```text
/skill-registry        → My Skill Registry (employee's own view)
/team-registry          → Team's Registry (manager/admin supervisory view)
```

Both pages are standalone — no tabs. The sidebar shows both links (role-filtered).

---

### File Changes

#### 1. `src/pages/SkillRegistryPage.tsx` — Rewrite as "My Skill Registry"

Remove `TeamRegistryView`, `TeamMemberDetail`, and the `Tabs` wrapper. This page becomes the employee-focused page with:

- **Section 1: Current Active Cycle Card** — highlighted card with cycle name, dates, status badge, days remaining. Derives employee status (Not Started / In Progress / Self Review Submitted / Assessment Pending / Assessment Completed / Manager Review Pending / Approved) by cross-referencing submissions, assessments, attempts, and reviews. Shows dynamic CTA button based on status.
- **Section 2: Self Review Form** — skills grouped by category with accordion, `RatingSlider` per skill, previous cycle rating shown inline ("Last cycle: L3"), optional collapsible comment textarea per skill, progress bar ("8 of 12 skills rated"), category-level progress, search, auto-save (2s debounce with "Saving..."/"Saved" indicator), validation before submit.
- **Section 3: Past Registries Table** — past submissions for this employee, showing Cycle Name, Date, Avg Score, Status, with expandable detail (Skill / Self Score / Assessment Score / Final Score / Gap).
- Edge cases: no active cycle, no domain, no skills, cycle closed.

All roles can access this page (everyone has their own registry).

#### 2. `src/pages/TeamRegistryPage.tsx` — New Page

Extract `TeamRegistryView` and `TeamMemberDetail` into this new page. Admin + Manager only. Shows team submissions list with drill-down into member detail. Same logic as current `TeamRegistryView`.

#### 3. `src/components/layout/AppSidebar.tsx`

Replace the single "Skill Registry" entry with two entries:
- `{ title: 'My Registry', href: '/skill-registry', roles: ['admin', 'manager', 'employee'] }`
- `{ title: 'Team Registry', href: '/team-registry', roles: ['admin', 'manager'] }`

#### 4. `src/App.tsx` — Routing

- Add route: `/team-registry` → `<RoleGuard allowed={["admin", "manager"]}><TeamRegistryPage /></RoleGuard>`
- Keep `/skill-registry` → `<SkillRegistryPage />` (all roles)

#### 5. `src/components/layout/PageHeader.tsx`

Add breadcrumb entries:
- `/skill-registry` → `{ group: 'Operations', title: 'My Registry' }`
- `/team-registry` → `{ group: 'Operations', title: 'Team Registry' }`

#### 6. `src/stores/registryStore.ts`

- Add `comment?: string` to `SkillSelfRating` interface
- Update `createOrUpdateDraft` to persist comments in `skill_self_ratings.comment`

#### 7. `src/components/registry/RatingSlider.tsx`

- Add optional `previousRating?: RatingLevel` prop
- Display "Last cycle: L{n}" label when provided

#### 8. Database Migration

- Add `comment text` nullable column to `skill_self_ratings` table

#### 9. `src/pages/UserGuidePage.tsx`

- Update Employee Guide with Skill Registry instructions (self review, scores, post-submission, auto-save)

---

### Key Technical Details

- **Auto-save**: `useEffect` with 2s debounce on `ratings` state. Calls `createOrUpdateDraft`. Shows "Saving..." / "All changes saved" indicator. No manual Save Draft button.
- **Status derivation**: Cross-reference `registryStore.submissions`, `assessmentStore.assessments`, `attemptStore.attempts`, `reviewStore.reviews` for the current cycle to compute status. No new DB columns.
- **Previous cycle scores**: Query past submissions for same employee, build `Record<string, RatingLevel>` map, pass as `previousRating` to each `RatingSlider`.
- **Past registries**: Filter submissions by employee_id excluding active cycle. Lazy-load assessment/final scores on expand by querying `attempt_skill_scores` and `official_skill_entries`.
- **Comments**: Collapsible textarea per skill, only in draft mode. Stored in new `skill_self_ratings.comment` column.

