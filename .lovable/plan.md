# Fix Microsoft sign-in `hash_empty_error`

## What's happening

Sign-in uses a Microsoft popup window. The popup is told to come back to the app's home page (`/`). That means the full application re-loads inside the tiny popup window, and the app's own startup logic (React Router, auth guard redirect to `/login`) runs and wipes the sign-in response out of the URL before the sign-in library can read it. The library then reports "Hash value cannot be processed because it is empty".

## The fix (smallest safe change)

Point the popup's return address at a tiny static blank page instead of the app itself, so nothing can clear the response.

1. Add `public/auth-callback.html` — a minimal static HTML page with no scripts and no router. It is served as a real file, so the app never boots inside the popup.
2. In `src/config/msalConfig.ts`, set `redirectUri` to `${window.location.origin}/auth-callback.html`. Leave `postLogoutRedirectUri` as the app origin.
3. In `src/contexts/AuthContext.tsx`, after `initialize()` resolves, call `handleRedirectPromise()` once as a safety net for any stale redirect response, before the app's normal session restore continues. No change to the popup login flow, roles, routing, or guards.

## Azure/Entra note

The new URL `https://<your-domain>/auth-callback.html` must be added as a redirect URI (SPA platform) in the Entra app registration, for each origin in use (production, custom domain, preview). Existing origin entries can stay. Without this, Microsoft rejects the sign-in with a redirect-mismatch error — this is the one configuration step that must be done outside the code.

## Out of scope

No changes to dashboard, registry, assessment, question bank, role logic, or the SSO token-validation edge function.
