# Team Registry: add page controls (export unchanged)

## What we found
The CSV export did not remove the page controls. Team Registry never had any. None of the 27 saved versions of the Team Registry page includes page controls or a page size, including the version from just before the export change. The table has always shown every matching employee on one long list. The export reads that same filtered list and does not replace how the table loads its data.

Team Assessment does have page controls: 10 per page, "Showing X to Y of Z", and Previous / page numbers with ellipsis / Next. These are probably the controls you remember.

## What we'll do (smallest change)
Add the same page controls Team Assessment uses to Team Registry. Only the Team Registry page changes:
- 10 employees per page, same as Team Assessment.
- The table shows only the current page of the filtered list.
- Below the table: "Showing X to Y of Z team members", plus the same Previous / numbered pages / Next controls with ellipsis. They are hidden when there is only one page.
- Changing the search, status filter or domain filter jumps back to page 1. If filters shrink the list, the current page is clamped to the last valid page.
- Export keeps using the full filtered list, not the current page. So it still covers all pages, and it doesn't change the page, search or filters.
- Button placement, who can export (Admin and Manager), domain scope, latest-version rule, and status/metrics rules all stay as they are.
- The page controls wrap on narrow screens, as on Team Assessment.

## Files
- `src/pages/TeamRegistryPage.tsx` only. It imports the existing shared page-control components.

## Verification
- Check that the code compiles.
- Browser check of the controls and layout, if a signed-in view is possible. If it isn't (Microsoft sign-in only), that is reported as unverified, with manual steps covering first, middle and last pages, exporting from a middle page, filters, and Manager scope.
