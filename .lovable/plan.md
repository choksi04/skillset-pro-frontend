## Goal
Remove the demo login path entirely from the production app so only Azure AD SSO remains.

## Context
- `src/pages/LoginPage.tsx` already only shows the "Continue with 1Rivet Account" Microsoft SSO button and has no visible demo UI.
- `src/contexts/AuthContext.tsx` still exposes a `login(email)` fallback labeled "Demo email login (fallback)". It is currently unused by any UI component, but remains callable from the auth context and was the source of the earlier impersonation issue (hardcoded "Admin" button logging in as another user).

## Plan
1. **Strip dead demo login code**
   - Remove the `login` function from `AuthContext.tsx`.
   - Remove `login` from the `AuthContextType` interface and from the provider value.
   - Keep `loginWithAzure` and the rest of the Azure AD SSO flow untouched.
2. **Sanity-check the login page**
   - Confirm `LoginPage.tsx` imports only `loginWithAzure` and renders no demo/test/admin buttons.
3. **Update memory**
   - Update `mem://auth/login-methods` to record that production builds use Azure AD SSO only and the demo fallback is disabled.

## Outcome
No UI or code path exists in the deployed app to sign in as another user by email. Only 1Rivet Azure AD SSO remains.