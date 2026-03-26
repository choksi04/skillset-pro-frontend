

## Plan: Redesign Domain Management Module

Redesign the Domain detail page with tab-based Users/Skills sections, inline user assignment/removal, and domain form as a Sheet. Add user count to the list page and enforce deletion safety.

---

### Technical Details

#### 1. DomainFormDialog → Sheet + loading + onCreated

**File: `src/components/domains/DomainFormDialog.tsx`**

- Replace `Dialog` with `Sheet` (right drawer), matching Skill Library pattern.
- Add `submitting` loading state with `Loader2` on submit button.
- Add `onCreated?: (domainId: string) => void` callback.
- Store's `addDomain` returns the new ID (`Promise<string | undefined>`).

#### 2. DomainsPage — add User Count column + navigate on create

**File: `src/pages/DomainsPage.tsx`**

- Fetch user counts per domain lazily (single query: `SELECT domain_id, COUNT(*) FROM users WHERE deleted_on IS NULL GROUP BY domain_id`).
- Add "Users" column between "Domain" and "Mapped Skills".
- On domain creation, navigate to `/domains/${newId}` via `onCreated` callback.

#### 3. DomainDetailPage — Tab-based redesign with inline user management

**File: `src/pages/DomainDetailPage.tsx`** — Major rewrite.

Header stays (domain name, description, status, edit button).

Replace the flat sections with **Tabs**: `Users (count)` | `Skills (count)`

**Users Tab:**
- Search bar for filtering users in this domain.
- Table: Name | Email | Role | Status | Actions (Remove button).
- "Add User" button opens a multi-select popover (searchable) showing unassigned users from same tenant. Only users with `domain_id = null` or already in this domain shown for adding.
- Remove user: sets `domain_id = null` on that user (with confirmation AlertDialog).
- Domain Lead selector stays in header area (above tabs).

**Skills Tab:**
- Current skills display (grouped by category) stays.
- "Manage Skills" opens existing `DomainSkillManager`.
- Add inline remove button per skill row.

#### 4. Domain deletion safety

**File: `src/stores/domainStore.ts`**

- Add `checkDomainDeletable(id: string): Promise<{deletable: boolean; reason?: string}>` — checks if users exist or skills are mapped.
- Update `addDomain` return type to `Promise<string | undefined>`.

#### 5. DomainSkillManager → Sheet

**File: `src/components/domains/DomainSkillManager.tsx`**

- Replace `Dialog` with `Sheet` (right drawer) for consistency.

#### 6. User form domain validation

**File: `src/pages/UsersPage.tsx`**

- When role is `employee` or `manager`, show domain as required (warning if empty).
- Admin role: domain remains optional.

---

### Files Summary

| Action | File |
|--------|------|
| Rewrite | `src/components/domains/DomainFormDialog.tsx` (Dialog → Sheet + loading + onCreated) |
| Rewrite | `src/pages/DomainDetailPage.tsx` (tab layout, inline user add/remove) |
| Modify | `src/pages/DomainsPage.tsx` (user count column, navigate on create) |
| Modify | `src/stores/domainStore.ts` (addDomain returns ID, checkDomainDeletable) |
| Modify | `src/components/domains/DomainSkillManager.tsx` (Dialog → Sheet) |
| Modify | `src/pages/UsersPage.tsx` (domain required for employee/manager) |

