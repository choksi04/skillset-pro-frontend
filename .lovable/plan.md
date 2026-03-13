

## Plan: Revamp Assessment Listing Page

### Problems Identified
1. No My/Team tabs for Admin and Manager roles
2. Completed assessments show two status indicators (a "Completed" badge + a status badge)
3. No way to click into a completed assessment to view details, scores, or take review actions
4. Team view for managers should filter by domain; admins see all

### Changes

**File: `src/pages/AssessmentsPage.tsx`** — Full rewrite

1. **Role-based tabs**: Add `Tabs` with "My Assessments" and "Team's Assessments" for admin/manager. Employees see only their own assessments (no tabs).

2. **My Assessments list**:
   - Show user's own assessments
   - Pending: "Start" button → navigates to `/assessment-exec`
   - In Progress: "Resume" button → navigates to `/assessment-exec`
   - Completed: "View Details" button → expands inline `EvalResults` component
   - Single consolidated status badge (no duplicates)

3. **Team's Assessments list**:
   - Manager: filter by `user.domain_id`
   - Admin: show all
   - Completed assessments are clickable to expand and show `EvalResults`
   - "Review" button links to `/reviews` for manager action
   - Single status badge per card

4. **Fix duplicate status**: Remove the separate "Completed" badge that appears alongside the status badge. Show one unified badge — if completed, show green "Completed"; otherwise show the current status.

5. **Expandable detail view**: Use `useState<string | null>` to track which assessment card is expanded, rendering `EvalResults` inline when expanded (reusing existing component from `src/components/assessment/EvalResults.tsx`).

### Technical Approach
- Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from UI
- Import `EvalResults` from assessment components
- Import `useAttemptStore` to check attempt status and get attempt data
- Use `useNavigate` for routing to exec/review pages
- Reuse `User`/`Users` icons for tab labels consistent with other pages

