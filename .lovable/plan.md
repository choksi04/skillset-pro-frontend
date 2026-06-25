## What actually happened (no session hijack)

You did **not** get auto-logged-in as someone else. The "Admin" demo quick-button on the login page is hardcoded to a **real employee's email address**, not a demo account.

`src/pages/LoginPage.tsx` lines 215–219:

```ts
{ label: "Admin",    email: "rukshar.rangara@1rivet.com" },
{ label: "Manager",  email: "kishan.mistry@1rivet.com" },
{ label: "Employee", email: "nidhi.shah@1rivet.com" },
```

Clicking **Admin** calls `login("rukshar.rangara@1rivet.com")`, which in `AuthContext.tsx` simply does:

```ts
const { data } = await supabase.from('users').select('*').eq('email', email).single();
localStorage.setItem('siap_user_id', data.id);
```

Rukshar happens to be the real Admin user in the DB, so her record is loaded. The label "Admin" on the button is just the role name — it never pointed to a separate demo "admin" account.

## The bigger picture (already a documented MVP trade-off)

The current auth model is intentionally passwordless for MVP (see project memory: `auth/login-methods`, `architecture/security/rls-policy`):

- Demo login: email → look up user row → store `users.id` in `localStorage.siap_user_id`. No password, no token.
- On reload, the app reads that ID and rehydrates the user.
- This means **anyone who knows a user's email can sign in as them**, and anyone can edit `localStorage` to impersonate any user. RLS is "Allow all" because `auth.uid()` is always null.

This is the documented Phase 1 posture, to be replaced when real Supabase Auth / Azure SSO is the only entry point.

## Fix in this change

Re-point the demo quick-buttons to the **persistent demo accounts** that project memory marks as protected (`mem://development/demo-accounts`): Admin, John Emp, John Manager. Real employee emails should never appear as one-click sign-in buttons.

### Edit: `src/pages/LoginPage.tsx`

Replace the hardcoded list:

```ts
{[
  { label: "Admin",    email: "<admin demo email>" },
  { label: "Manager",  email: "<john manager demo email>" },
  { label: "Employee", email: "<john emp demo email>" },
]}
```

I'll read the actual demo emails from the `users` table (filter by the three demo accounts named in the memory) and wire them in.

### Optional, not done unless you confirm

- Remove the quick-buttons entirely and require typing the email (slightly safer for shared previews).
- Add a clearly visible "Testing mode — not for production" banner when the demo block is open.
- Begin migrating to real Supabase Auth so `localStorage.siap_user_id` impersonation stops being possible. This is a larger effort and outside this fix.

## Confirm before I build

1. OK to repoint the three demo buttons to the protected demo accounts (Admin / John Manager / John Emp)? - Yes
2. Want me to also add the "Testing mode" warning banner in the demo block? - No
3. Keep the typed-email demo input, or remove it and only keep the three quick-buttons? - Remove testing/demo block from auth page