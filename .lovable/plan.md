## Plan: Complete Review Cycle System

This plan introduces a formal Review Cycle entity that replaces the hardcoded `currentCycle: '2026-Q1'` with a database-driven cycle management system, including lifecycle controls, employee tracking, notifications, and admin dashboard.

---

### Database Changes

**New table: `review_cycles**`


| Column            | Type        | Notes                   |
| ----------------- | ----------- | ----------------------- |
| id                | text        | PK                      |
| tenant_id         | text        | not null                |
| name              | text        | not null                |
| start_date        | date        | not null                |
| end_date          | date        | not null                |
| grace_period_days | integer     | default 3               |
| status            | text        | draft / active / closed |
| closed_at         | timestamptz | nullable                |
| created_at        | timestamptz | default now()           |
| created_by        | text        | nullable                |
| modified_at       | timestamptz | nullable                |
| modified_by       | text        | nullable                |


- Validation trigger: only one `active` cycle per tenant
- Validation trigger: `start_date < end_date`
- RLS: allow all (matching current MVP pattern)

**Modify `skill_registry_submissions**`: Add column `cycle_id text` (nullable, to allow backfill). Future submissions will reference the cycle entity ID.

**Modify `notifications` table**: Add column `action_link text` (nullable) for deep-linking from notification items.

---

### New Files

1. `**src/stores/cycleStore.ts**` — Zustand store for review cycles
  - State: `cycles`, `activeCycle`, `loading`, `initialized`
  - Actions: `fetchCycles`, `createCycle`, `activateCycle`, `closeCycle`, `deleteCycle`, `sendReminder`
  - `activateCycle`: sets status=active, closes previous active cycle, triggers bulk notification to all employees
  - `closeCycle`: sets status=closed, records `closed_at`
  - `sendReminder`: sends notification to employees who haven't submitted
  - Derives `currentCycle` name from active cycle for backward compatibility with existing `registryStore.currentCycle`
2. `**src/pages/ReviewCyclesPage.tsx**` — Replaces current `ReviewsPage.tsx` content at `/review-cycles`
  - **Cycle List Tab** (admin): Table with Name, Dates, Status, Total Employees, Completion %, Actions
  - **Create Cycle Sheet**: Form with Name, Start Date (datepicker), End Date (datepicker)
  - **Cycle Dashboard Tab**: Stats cards (total employees, submitted, pending, assessments completed, pending reviews), progress bars
  - **Bulk Actions**: "Send Reminder" button, "Close Cycle" button
  - **Cycle countdown**: Shows days remaining for active cycle
  - Status badges: draft (muted), active (green), closed (gray)
  - Delete only allowed for draft/unused cycles
3. `**src/components/layout/NotificationDropdown.tsx**` — Notification bell dropdown
  - Replaces the static bell button in `PageHeader`
  - Shows unread count badge
  - Dropdown with message, timestamp, action link
  - Mark as read on click
  - Filters by current user's role AND user ID
  - Links to relevant pages (skill registry, assessments, review cycles)

---

### Modified Files

4. `**src/stores/registryStore.ts**`
  - Replace hardcoded `currentCycle: '2026-Q1'` with dynamic value from `cycleStore.activeCycle`
  - Add `setCurrentCycle(cycleName: string)` action
  - Lock submission check: verify active cycle exists and is within date range (including grace period)
5. `**src/components/layout/PageHeader.tsx**`
  - Replace static bell button with `NotificationDropdown` component
  - Pass user context for filtering
6. `**src/App.tsx**`
  - Update `/review-cycles` route to use the new `ReviewCyclesPage`
  - Keep existing `ReviewsPage` as the manager review page (rename route if needed, or keep both)
7. `**src/pages/ReviewsPage.tsx**`
  - Remove `NotificationPanel` (moved to PageHeader globally)
  - Continue to serve as the manager skill review page
8. `**src/pages/SkillRegistryPage.tsx**`
  - Check for active cycle before allowing submission
  - Show cycle name and countdown
  - Grace period logic: allow submission up to `grace_period_days` after cycle `end_date`
  - Show "No active cycle" message when none exists
9. `**src/pages/DashboardPage.tsx**`
  - Show active cycle info card with countdown
  - Show employee-specific action buttons ("Submit Now", "Attempt Assessment", "Review Pending")
10. `**src/stores/reviewStore.ts**`
  - Update notification types to include new cycle-related types: `cycle_activated`, `submission_reminder`, `assessment_reminder`
    - Add `action_link` to notification creation
11. `**src/pages/AssessmentExecPage.tsx**`
  - Block new assessment attempts if cycle is closed (past grace period)

---

### Notification Triggers


| Event                  | Recipients                         | Message                                                                             |
| ---------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| Cycle activated        | All employees (tenant)             | "A new review cycle '{name}' has started. Submit your skill ratings by {end_date}." |
| Manual reminder        | Employees who haven't submitted    | "Reminder: Please submit your skill ratings for '{name}' before {end_date}."        |
| Assessment generated   | Individual employee                | "Your assessment has been generated. Start it from the Assessments page."           |
| Assessment reminder    | Employees with pending assessments | "Your assessment for '{name}' is pending. Complete it before the cycle ends."       |
| Manager review pending | Domain manager                     | "Assessment completed for {employee_name}. Ready for review."                       |
| Final approval         | Individual employee                | "Your skill assessment has been reviewed and approved."                             |


Bulk notifications (cycle activation, reminders) will query `users` table for all active employees in tenant, and insert one notification row per user with `target_user_id` set.

---

### Auto-Close Logic

- On each page load where cycle data is fetched, check if active cycle's `end_date + grace_period_days` has passed
- If so, auto-close the cycle (update status to `closed`, set `closed_at`)
- Admin can also close manually at any time via "Close Cycle" button

---

### Edge Cases

1. **Employee didn't submit**: Marked "Not Started" in cycle dashboard; excluded from assessment generation
2. **Employee submitted but didn't attempt assessment**: Marked "Assessment Pending"; visible to manager
3. **Manager didn't review before close**: Review still allowed post-close; flagged as "Delayed" in dashboard
4. **Missing questions for a skill**: Block assessment generation; show message "Insufficient questions for skill X"
5. **Grace period**: Employees can submit/attempt during grace period; after grace period, fully locked

---

### Technical Details

- All dates use Shadcn datepicker with `pointer-events-auto` fix
- Cycle store caches summary stats to avoid recomputation on every load
- Notifications use existing `notifications` table schema (extended with `action_link`)
- Backward compatibility: existing submissions with `cycle: '2026-Q1'` string continue to work; new submissions also set `cycle_id`
- ~12 files touched total, 3 new files created
- 1 database migration (new table + column additions)