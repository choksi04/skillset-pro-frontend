# Kill remaining API calls on the Dashboard

## Root cause

`DashboardPage.tsx` is already static — it makes no calls. The requests you see (`skills`, `skill_categories`, `domains`, `domain_skill_mappings`, `get_question_counts`, `assessment_templates`, `users`, `notifications`, `analytics`) come from the shared **app shell**, not the dashboard body:

| Request | Source |
|---|---|
| `skills`, `skill_categories`, `domains`, `domain_skill_mappings`, `get_question_counts`, `assessment_templates` | `src/components/layout/SetupProgress.tsx` (rendered inside `AppSidebar` for admins only) |
| `users` | `AuthContext` — resolves the signed-in user |
| `notifications` | Header bell (`NotificationDropdown`) |
| `analytics` | Lovable preview telemetry ping (not an app API call) |

The heavy ones are all from `SetupProgress`. `AuthContext` and `NotificationDropdown` are required on every page (user identity + bell badge) and are lightweight single-row / small-list reads, so they stay.

## Changes

**`src/components/layout/SetupProgress.tsx`** — stop fetching on mount. Instead:

1. Remove the `useEffect` that calls `fetchSkills / fetchDomains / fetchQuestionCounts / fetchTemplates`.
2. Only compute progress from data **already loaded** by other pages (skills, domains, templates, question counts). On a fresh dashboard visit nothing is loaded → the widget renders nothing (it already returns `null` until initialized).
3. Add a one-time lazy trigger: fire the fetches only when the admin actually navigates to Skills / Domains / Templates / Question Bank (those pages already load their own data), so `SetupProgress` naturally lights up after any admin visits any operations page.

Net effect on `/dashboard`:
- No `skills`, `skill_categories`, `domains`, `domain_skill_mappings`, `get_question_counts`, `assessment_templates` calls.
- Only `users` (auth) and `notifications` (bell) remain, plus the Lovable `analytics` ping.

## Out of scope

- `AuthContext` `users` lookup and `NotificationDropdown` `notifications` query — required app-wide, not dashboard-specific.
- `/~api/analytics` — Lovable preview instrumentation, not something we control from app code.

Confirm and I'll implement.
