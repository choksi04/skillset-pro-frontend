# Fix Guided Tour Lockout & Simplify Onboarding

## Problem
After the dashboard redesign, the guided tour gets stuck on `/` and the user can't exit:
- Many tour steps point at sidebar items (`[data-tour="skills|domains|questions|..."]`) that no longer exist in `AppSidebar.tsx` — so `targetRect` is null and the tooltip falls back to center, but for the dashboard step itself the rect is the full main-content area, pushing the tooltip (position: `bottom`) below the viewport. Skip/Later buttons become unreachable.
- There is no global Escape affordance (no ESC key handler, no floating close button), so once the tooltip is offscreen the user is trapped.

## Changes

### 1. `src/components/onboarding/GuidedTour.tsx`
- Add a **fixed top-right floating Close (X) button** rendered above the overlay (always visible regardless of tooltip position). Clicking calls `completeTour()`.
- Add an **ESC key listener** while `tourActive` — calls `completeTour()`.
- Clamp tooltip position into the viewport (fallback to centered when computed `top`/`left` would fall outside the visible area) so it can never be pushed offscreen again.
- Keep the existing Skip / Later / Back / Next buttons.

### 2. `src/stores/onboardingStore.ts` — simplify the tour
Replace the multi-step `coreTourSteps` + role-specific extras with a **single generic step** for all roles:
- id: `dashboard-intro`, title: "Welcome to your Dashboard", description: short message that this is the dashboard, summarizes what they'll find here, and points them to the User Guide for deeper walkthroughs.
- position: `center`, no `targetSelector`.

`getTourStepsForRole` returns just this one step for every role. Role-specific arrays (`adminExtraSteps`, `managerExtraSteps`, `employeeExtraSteps`) are removed.

The checklist (`checklistItems`) and store actions remain unchanged.

### 3. `src/pages/UserGuidePage.tsx`
- Add a small note near the top explaining the in-app guided tour is now a brief dashboard intro, and that the User Guide is the source of truth for step-by-step instructions.
- No structural rewrite of the existing role/feature sections.

## Out of scope
- Re-wiring `data-tour` anchors on the new sidebar (the tour no longer relies on them).
- Welcome modal copy, checklist behavior, profile sheet.

## Technical notes
- Floating close button: `fixed top-4 right-4 z-[10000]`, semantic tokens only.
- ESC handler attached in the same `useEffect` that already runs while `tourActive`.
- Viewport clamping: after computing `pos`, if numeric `top`/`left` exceeds `window.innerHeight`/`innerWidth` minus a margin, fall back to centered transform.
