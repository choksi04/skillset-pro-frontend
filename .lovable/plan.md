

## Plan: Sync Users to Lovable Cloud Users Section

### Problem
The Lovable Cloud "Users" section displays users from the built-in authentication system (`auth.users`). Your app uses a custom `public.users` table with Azure AD SSO, so no users appear in the Cloud Users view.

### Solution
When a user logs in via Azure AD (or is auto-registered), also create a corresponding entry in the authentication system using the admin API (`supabase.auth.admin.createUser`). This syncs your custom users to the Cloud Users section.

### Changes

**File: `supabase/functions/validate-azure-token/index.ts`**

After looking up or creating a user in `public.users`, also ensure an `auth.users` entry exists:

1. After extracting the email, call `supabaseAdmin.auth.admin.listUsers()` filtered by email to check if an auth user exists
2. If not, call `supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } })` to create the auth entry
3. This is a fire-and-forget sync — the app still uses `public.users` for all role/profile logic, but Cloud Users will now show the user entries

### What This Enables
- Users appear in the Lovable Cloud Users section
- You can see user IDs and emails in the Cloud UI
- The `public.users` table remains the source of truth for roles, domains, and app logic

### Files Changed
- `supabase/functions/validate-azure-token/index.ts` — add auth.admin.createUser sync

