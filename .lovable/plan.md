## Plan: Assessment Page Split + Registry Flow Fixes

### Problems Identified

1. **Assessments**: Currently one page (`AssessmentsPage`) with "My Assessments" and "Team Assessments" sections combined. Need two separate pages + detail routes.
2. **Skill Registry listing**: Active card `onClick` and CTA both navigate to detail page. "Attempt Assessment" status should redirect to `/assessments`, not registry detail.
3. Registry Detail Page: based on the status, show the relevent CTA related to assessment.
4. **Assessment detail**: No detail page exists — assessments expand inline. Need a proper child-routed detail page.
5. **Sidebar**: Single "Assessments" link; needs "My Assessments" + "Team Assessments" split. rename the "Manager Reviews" with Team assessment  as it may overlap with Team assessment.
6. **Assessment exec page**: Currently accessed via `/assessment-exec` but not linked from assessment detail flow properly.

---

### Changes

#### 1. Create `src/pages/TeamAssessmentsPage.tsx` (NEW)

- Shows only team assessments (admin sees all, manager sees domain-scoped)
- Each assessment row is clickable → navigates to `/team-assessments/:assessmentId`
- Search/filter by employee name, domain, cycle

#### 2. Create `src/pages/AssessmentDetailPage.tsx` (NEW)

- Child route for both My and Team assessments
- Shows assessment metadata (domain, cycle, questions count, duration, status)
- For owner: Start/Resume/View Results CTAs
- For manager: Review CTA, link to manager reviews
- Embeds `EvalResults` when attempt is evaluated
- "Start" / "Resume" navigates to `/assessment-exec`

#### 3. Rewrite `src/pages/AssessmentsPage.tsx`

- Remove team assessments section entirely — only show "My Assessments"
- Each row clickable → navigates to `/assessments/:assessmentId`
- Remove inline expand; just show status badge + score
- Rename page heading to "My Assessments"

#### 4. Update `src/App.tsx` routes

- Add `/team-assessments` route (admin + manager)
- Add `/assessments/:assessmentId` detail route
- Add `/team-assessments/:assessmentId` detail route
- Keep `/assessment-exec` as-is

#### 5. Update `src/components/layout/AppSidebar.tsx`

- Split "Assessments" into "My Assessments" (`/assessments`) and "Team Assessments" (`/team-assessments`, admin+manager roles)
- Remove "Manager Reviews" from sidebar since review is accessed from Team Assessments detail (keep route for backward compatibility)

#### 6. Update `src/components/layout/PageHeader.tsx`

- Add breadcrumb entries for `/team-assessments`, `/assessments/:id`, `/team-assessments/:id`

#### 7. Fix `src/pages/SkillRegistryPage.tsx` — CTA logic

- Active card `onClick` → open detail page (keep)
- CTA button behavior by status:
  - `not_started` → create draft + navigate to detail
  - `in_progress` → navigate to detail
  - `submitted` / `assessment_pending` → navigate to `/assessments` (not detail)
  - `assessment_completed` / `approved` → navigate to detail
- Separate card click (always goes to detail) from CTA button click (status-dependent)

#### 8. Fix `src/pages/SkillRegistryDetailPage.tsx`

- Add "Go to Assessment" secondary button when status is `submitted` or `assessment_pending`
- Success dialog "Attempt Now" already navigates to `/assessments` — keep

---

### File Summary


| File                                    | Change                                                      |
| --------------------------------------- | ----------------------------------------------------------- |
| `src/pages/AssessmentsPage.tsx`         | Simplify to "My Assessments" only, clickable rows to detail |
| `src/pages/TeamAssessmentsPage.tsx`     | NEW — team assessments listing                              |
| `src/pages/AssessmentDetailPage.tsx`    | NEW — shared detail page for assessment                     |
| `src/App.tsx`                           | Add new routes                                              |
| `src/components/layout/AppSidebar.tsx`  | Split sidebar link                                          |
| `src/components/layout/PageHeader.tsx`  | Add breadcrumb entries                                      |
| `src/pages/SkillRegistryPage.tsx`       | Fix CTA logic per status                                    |
| `src/pages/SkillRegistryDetailPage.tsx` | Add "Go to Assessment" link                                 |
