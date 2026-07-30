Problem: Team Assessment page renders every page number at once (1..43), causing horizontal overflow and poor UX.

Root cause: In `src/pages/TeamAssessmentsPage.tsx` the pagination map uses `Array.from({ length: pageCount })` to render a button for every single page, with no ellipsis or windowing.

Existing pattern to reuse: The project already has compact pagination logic in `QuestionBankPage.tsx` and `UsersPage.tsx` (bounded window with `ellipsis` placeholders) and the shadcn `PaginationEllipsis` component exists in `src/components/ui/pagination.tsx` but is not used in `TeamAssessmentsPage.tsx`.

Plan
1. Inspect `src/pages/TeamAssessmentsPage.tsx` pagination block (lines 693-734). Confirm the current code uses `Array.from({ length: pageCount })` and maps all page numbers.
2. Replace the full number list with a compact pagination generator.
   - Keep the existing shadcn `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext` components.
   - Add `PaginationEllipsis` from the same `pagination.tsx` module.
   - Generate a bounded array of items: `number | 'ellipsis'`.
   - Logic:
     - If `pageCount <= 7`, render all pages.
     - Otherwise:
       - First page.
       - Leading ellipsis if `safePage > 3`.
       - Current page and one page on each side (`safePage - 1` to `safePage + 1`, clamped to `2..pageCount-1`).
       - Trailing ellipsis if `safePage < pageCount - 2`.
       - Last page.
3. Render the array inside `PaginationContent`, mapping `number` to `PaginationLink` and `'ellipsis'` to `PaginationEllipsis`.
4. Keep `Previous` disabled on page 1 and `Next` disabled on last page using the same opacity/pointer-events style already applied.
5. Ensure no layout changes to the table or filters; only modify the pagination UI block.
6. Verify the same compact pattern works for small page counts (no ellipsis) and large page counts (43+).

Files changed
- `src/pages/TeamAssessmentsPage.tsx` only.

Manual test steps
1. Navigate to Team Assessments.
2. Apply a filter or search so there are more than 10 results (or reduce page size if testing locally).
3. Verify pagination shows a compact set like `Previous 1 2 3 ... 43 Next` on page 1.
4. Click a middle page (e.g., 22) and verify pattern `Previous 1 ... 21 22 23 ... 43 Next`.
5. Click last page and verify pattern `Previous 1 ... 41 42 43 Next`.
6. Confirm `Previous` is disabled on page 1 and `Next` is disabled on last page.
7. Resize the viewport to mobile and confirm no horizontal scroll is caused by the pagination bar.
8. Verify that clicking a page number still navigates correctly and the active page is visually selected.

Edge cases covered
- `pageCount <= 7`: all pages shown, no ellipsis.
- `pageCount = 1`: pagination hidden entirely (existing behavior).
- Current page at start, middle, and end.
- Active page styling preserved.
- Keyboard/click behavior unchanged.

Suggested next prompt
"Continue with Workstream 1 only. Focus on the next atomic fix: verify and fix All Registries page so it uses the same compact pagination pattern as Team Assessments."