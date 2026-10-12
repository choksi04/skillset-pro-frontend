# Fix Microsoft sign-in "hash_empty_error"

## What we found (code checks only — not yet browser-tested)
- Sign-in uses a Microsoft **popup** (`loginPopup`), MSAL browser 4.30.0. The popup's return address is the app's home page (`window.location.origin`).
- When Microsoft sends the popup back, it lands on the home page with the sign-in result in the URL `#...` part. The main window's MSAL then reads that `#...` from the popup.
- But the popup boots the **whole app**: the sign-in guard sees no user and instantly redirects the popup to `/login` (replace navigation), and the database client also inspects/cleans the URL on start. Either wipes the `#...` before MSAL reads it -> `hash_empty_error`.
- Why it worked before: the recent security update moved routing from React Router 6 to 7 and the database client from 2.99 to 2.110. Both start faster/clean the URL earlier, so the app now wins the race against MSAL. Credentials are not the problem.
- The redirect callback is handled only by the popup flow; there is no `handleRedirectPromise`/`loginRedirect` usage, so no duplicate processing elsewhere.

## Fix (smallest safe change)
1. `src/main.tsx`: before rendering the app, detect "this window is the MSAL popup returning a response" (`window.opener` exists, same origin, and the URL hash contains `code=`/`error=` with `state=`). In that case render nothing and leave the URL untouched, so the main window's MSAL reads the hash and closes the popup. Normal loads are unaffected.
2. No change to `msalConfig.ts` redirect URI, so **no Microsoft Entra change is needed** (existing registered URIs: `https://skillset.1rivet.com`, published and preview origins must remain registered as SPA redirect URIs — will list them for you to confirm).
3. Never log tokens, codes or the callback URL.

## Restore intended page after login
- `AuthGuard` will pass the requested path to `/login` (state), and `LoginPage` will navigate there after success instead of always `/`. Small, uses the existing guard/page.

## Validation
- Code: build check; Playwright confirms normal pages still render and a simulated popup-return URL leaves the hash intact and renders nothing.
- Browser login with real Microsoft credentials can't be done from the sandbox; I'll give you the 7 manual steps (fresh session, existing MS session, after logout, deep link restore, refresh, cancel popup, no loops) and will not mark it resolved until you confirm.

## Files
- `src/main.tsx`, `src/App.tsx` (AuthGuard state), `src/pages/LoginPage.tsx` (return-to navigation), User Guide note if relevant.
