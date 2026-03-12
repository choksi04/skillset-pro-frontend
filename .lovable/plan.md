

## User Management Implementation Plan

### Current State
- Auth is fully mocked with a hardcoded user (`Sarah Chen`, admin)
- Role switcher lets anyone switch to any role freely
- 5 roles exist (`admin`, `hr`, `manager`, `domain_lead`, `employee`) but no real user data in DB

### Simplified Role Model (per requirements)
Consolidate to **3 roles**:
- **admin** — full access (replaces admin + hr)
- **manager** — domain lead, reviews, own assessments (replaces manager + domain_lead)
- **employee** — limited access, self-rating, assessments

### Database Changes

**1. Create `users` table:**
```sql
CREATE TABLE public.users (
  id text PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'employee',  -- admin | manager | employee
  domain_id text,  -- nullable, FK-like to domains
  department text DEFAULT '',
  designation text DEFAULT '',
  status text NOT NULL DEFAULT 'active',  -- active | disabled
  avatar_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  modified_by text,
  modified_at timestamptz,
  deleted_on timestamptz,
  deleted_by text
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for users" ON public.users FOR ALL USING (true) WITH CHECK (true);
```

**2. Seed 1 admin + sample users:**
```sql
INSERT INTO public.users (id, full_name, email, role, domain_id, department, designation) VALUES
  ('user-001', 'Sarah Chen', 'sarah@acmecorp.com', 'admin', NULL, 'Engineering', 'CTO'),
  ('user-002', 'James Wilson', 'james@acmecorp.com', 'manager', NULL, 'Frontend', 'Lead Engineer'),
  ('user-003', 'Priya Sharma', 'priya@acmecorp.com', 'employee', NULL, 'Frontend', 'Developer'),
  ('user-004', 'Alex Rivera', 'alex@acmecorp.com', 'employee', NULL, 'Backend', 'Developer');
```

### Code Changes

**1. Update `UserRole` type** in `src/types/models.ts`:
- Change to `'admin' | 'manager' | 'employee'`
- Remove `hr` and `domain_lead`

**2. Rewrite `AuthContext.tsx`**:
- Replace mock user with DB-backed login
- On mount: check `localStorage` for saved user ID, fetch from `users` table
- Expose `login(email)`, `logout()`, `user`, `currentRole`, `isAuthenticated`
- No password — just email lookup (MVP demo mode)
- Role comes from the user record, no free switching

**3. Create `LoginPage.tsx`**:
- Simple email input field + "Sign In" button
- Looks up email in `users` table; if found and active, log in
- Shows error if email not found or user disabled
- Clean, centered card layout

**4. Update `App.tsx`**:
- Add `/login` route outside `AppLayout`
- Wrap `AppLayout` route with auth guard (redirect to `/login` if not authenticated)

**5. Update `AppSidebar.tsx`**:
- Remove the role switcher dropdown entirely
- Role is now determined by the logged-in user's record
- Update role references: map `admin` to cover old `hr` access, `manager` to cover old `domain_lead` access
- Add logout button in user info section
- Update `sidebarItems` roles arrays to use new 3-role set

**6. Update sidebar role mappings across all pages**:
- Replace `currentRole === 'hr'` checks with `currentRole === 'admin'`
- Replace `currentRole === 'domain_lead'` checks with `currentRole === 'manager'`
- Update `isAdmin` checks throughout (e.g., `DomainDetailPage`, `DomainsPage`, etc.)

**7. Create admin User Management page** (`src/pages/UsersPage.tsx`):
- Table listing all users with name, email, role, domain, status
- Admin can add/edit users (name, email, role, domain assignment, status)
- Add to sidebar for admin role only
- Add route `/users` in `App.tsx`

### Files Affected
- **New:** `src/pages/LoginPage.tsx`, `src/pages/UsersPage.tsx`
- **Modified:** `src/contexts/AuthContext.tsx`, `src/types/models.ts`, `src/App.tsx`, `src/components/layout/AppSidebar.tsx`, and role-check updates across ~10 page files

