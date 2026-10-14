# Team Registry: pin pagination footer to the bottom of the content area

## What we found
- The scroll container is `<main className="flex-1 min-h-0 overflow-y-auto p-6">` in `src/components/layout/AppLayout.tsx`. Pages render inside it via `<Outlet />`.
- The Team Registry page root is `<div className="space-y-6">` — a plain block, not a flex column that fills the available height. The pagination footer is the last block after the table card, so on short pages (e.g. the last page with 3 rows) it rises up with the content.
- The footer is rendered only when `total > 0`, so on an empty/filtered-to-zero list it disappears entirely.

## What we'll do (smallest change)
Only `src/pages/TeamRegistryPage.tsx` changes:
- Change the page root to a flex column that fills the scroll area: `flex min-h-full flex-col gap-6` (replaces `space-y-6`). `min-h-full` resolves against `<main>`'s content height, so short content still fills the viewport area, while taller content simply grows and keeps the existing scroll behavior — no fixed overlay, no second scrollbar.
- Add `flex-1` to the table `<Card>` so the table region absorbs the spare space on short pages and the footer sits at the bottom of the content area.
- Render the footer in all data states (including empty/filtered-to-zero) so its position is consistent; it shows "Showing 0 to 0 of 0 team members" with no page controls when there are no rows (page controls remain gated on `pageCount > 1` and `!isLoading`).

No changes to pagination logic, page size, sorting, search, filters, CSV export, or role permissions. No other pages touched.

## Verification
- Check that the code compiles (typecheck/build).
- Browser check with a signed-in Admin view at desktop and mobile widths:
  - Full page (10 rows): footer at the bottom, everything reachable.
  - Last page (few rows, e.g. "Showing 31 to 33 of 33"): footer pinned at the bottom, not pulled upward.
  - Empty/filtered results: footer stays in the same position.
  - Narrow width: count and controls wrap cleanly, table scrolls horizontally as today.
