

## Plan: Notify All Roles on Cycle Activation + Manager/Admin Self-Review with External Reviewer Assignment

### Part 1: Notify All Users on Cycle Activation

**File: `src/stores/cycleStore.ts`**

Change the `activateCycle` method to query ALL active users in the tenant (not just `role = 'employee'`) and send role-appropriate notifications:
- Employees: "Submit your skill ratings by {date}" with link to `/skill-registry`
- Managers: "A new review cycle has started. Monitor your team's progress." with link to `/review-cycles`
- Admins: "Review cycle '{name}' is now active." with link to `/review-cycles`

Also update `sendReminder` to similarly notify managers about pending reviews in their domain.

---

### Part 2: Manager/Admin Skill Registry Participation

**Current behavior**: Managers and Admins already have a "My Registry" tab in SkillRegistryPage. The `MyRegistryView` component works for any role — it checks `user.domain_id` to find the assigned domain. If a manager/admin is assigned to a domain, they can already submit self-ratings.

**Current reviewer assignment problem**: When assessment is submitted (`AssessmentExecPage.tsx` line 197-205), the reviewer is always the domain lead. If the submitter IS the domain lead, they become their own reviewer — which is the "self-approve" default behavior you described.

**Changes needed**:

1. **`src/pages/AssessmentExecPage.tsx`** — Update reviewer assignment logic during `doSubmit`:
   - If the employee IS the domain lead (self-review case): assign themselves as reviewer (default self-approve)
   - Otherwise: assign domain lead as before

2. **New: Admin "Assign External Reviewer" feature on `ReviewsPage.tsx`**:
   - Add a button on each review card (visible to admins only): "Assign Reviewer"
   - Opens a dialog that lists all active users in the same tenant (excluding the employee being reviewed)
   - Admin selects a user → updates `manager_reviews.reviewer_id` in DB
   - Sends notification to the new reviewer: "You have been assigned to review {employee_name}'s assessment."
   - The new reviewer then sees this review on their Reviews page

3. **`src/stores/reviewStore.ts`** — Add new action:
   - `reassignReviewer(reviewId: string, newReviewerId: string, reviewerName: string): Promise<void>` — updates DB, sends notification, updates local state

4. **`src/pages/ReviewsPage.tsx`** — UI changes:
   - Show current reviewer name on each review card
   - Admin-only "Change Reviewer" button that opens a user picker dialog
   - Fetch tenant users for the picker (filter out the employee under review)
   - After reassignment, show toast confirmation

---

### Database Changes

**None required.** The `manager_reviews.reviewer_id` field already exists and can be updated. The `notifications` table already supports all needed fields.

---

### Summary of File Changes

| File | Change |
|------|--------|
| `src/stores/cycleStore.ts` | Notify all roles on activation (employees, managers, admins) |
| `src/stores/reviewStore.ts` | Add `reassignReviewer` action |
| `src/pages/ReviewsPage.tsx` | Show reviewer name, add admin "Change Reviewer" dialog |
| `src/pages/AssessmentExecPage.tsx` | Handle self-review case for domain leads |

---

### Edge Cases

- **Manager self-approves**: Allowed by default. Their review appears in their own Reviews page since `reviewer_id === user.id`.
- **Admin reassigns reviewer mid-review**: If review is `in_progress`, the new reviewer picks up where the previous left off (skill actions already saved).
- **External reviewer has no domain**: Works fine — the review card shows all data regardless of reviewer's domain. The reviewer just needs to be an active user in the tenant.
- **Multiple reassignments**: Each reassignment overwrites the previous reviewer and notifies the new one.

