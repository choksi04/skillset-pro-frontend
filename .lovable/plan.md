## Plan: Remove extra body/page scroll on Team Assessment page

### Current state confirmed
- `src/pages/TeamAssessmentsPage.tsx` renders inside `<main>` of `src/components/layout/AppLayout.tsx`.
- `AppLayout` already uses the correct single-scroll pattern: outermost `h-screen overflow-hidden`, right column `flex-1 flex-col overflow-hidden`, and `<main class="flex-1 overflow-y-auto p-6">`.
- The Team Assessment page itself has no extra height/overflow rules; it is just `space-y-6` with header, table, pagination, and dialog portals.
- The standalone dev server does not show a body scrollbar (verified via Playwright), but the document body is not explicitly locked to `overflow-hidden`. In some host contexts (e.g., Lovable preview) or when the body has a small amount of extra height from wrapper styles, the browser can still render a second page scrollbar alongside the internal `<main>` scrollbar.

### Root cause
The authenticated app shell is a full-height flex container, but the **document body has no `overflow-hidden` rule**. The `h-screen` shell prevents the body from growing in standalone mode, but the host document/preview can still present a body scrollbar if the shell is 1px–taller than the viewport or the wrapper adds any extra height. The missing `min-h-0` on the scrolling `<main>` also makes the flex item slightly less robust against content expansion.

### Implementation
Only one file will change: `src/components/layout/AppLayout.tsx`.

1. Add a `useEffect` that toggles `overflow-hidden` on `document.body` (and `document.documentElement`) while the authenticated shell is mounted. This suppresses the browser/page scrollbar on every authenticated page without touching the login, loading, or not-found pages.
2. Add `min-h-0` to the `<main>` element to guarantee the flex item does not try to grow to its content height and is forced to scroll internally.
3. Keep the existing `h-screen overflow-hidden` outer shell so the app still fills the viewport directly.

### Why this does not affect unrelated pages
- `AppLayout` only wraps authenticated routes. The effect runs in `AppLayout` and is cleaned up on unmount, so `/login`, `/loading`, and `/404` keep their original body/html styles.
- No backend, API, database, or table logic changes.
- Team Assessment data, filters, pagination, and actions are untouched.

### Manual test steps
1. Sign in and open Team Assessments.
2. Verify only **one** vertical scrollbar is visible (the internal `<main>` scrollbar on the right side of the content area).
3. Verify the browser/page body cannot be scrolled.
4. Scroll the content area; the header, sidebar, and page tabs should stay fixed.
5. Confirm the table header, filters, pagination, and all row action buttons remain visible and usable.
6. Open and close the filters popover and the "Assign from Template" / "Change reviewer" dialogs; confirm the body does not regain a scroll after closing.
7. Repeat on a few viewport sizes: 1920×1080, 1366×768, 1280×800, 1024×768, and a narrow mobile width (e.g., 820×1180) to ensure no clipping.

### Viewport sizes to test
- Desktop: 1920×1080, 1440×900, 1366×768, 1280×800
- Laptop: 1024×768
- Tablet: 820×1180, 768×1024

### Suggested next prompt
Implement the plan to remove the body scrollbar from Team Assessments.