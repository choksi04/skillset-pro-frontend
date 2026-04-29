# Add Pagination to "Add Questions" Picker Sheet

The picker drawer currently renders the full filtered list (all published questions matching filters), which is heavy when the bank is large. Add simple client-side pagination.

## Changes — `src/components/templates/QuestionPickerSheet.tsx`

- Add state: `page` (default `1`) and constant `PAGE_SIZE = 20`.
- Reset `page` to `1` whenever the sheet opens or any filter (`search`, `skillFilter`, `levelFilter`, `typeFilter`) changes.
- Compute:
  - `totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))`
  - `pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)`
- Render `pageItems` instead of `filtered` in the results list.
- Add a pagination bar above the existing footer (inside the scrollable area's bottom or as a sticky strip just above `SheetFooter`):
  - Left: small text `Showing X–Y of N` (where X/Y reflect current page bounds).
  - Right: `Prev` button, `Page P / Total` indicator, `Next` button.
  - Buttons disabled at bounds. Use existing `Button` component, `size="sm"`, `variant="outline"`, with `ChevronLeft`/`ChevronRight` icons from `lucide-react`.
- Selection state and the buffered `Save` flow remain unchanged — selecting on page 1 persists when navigating to page 2.
- Update the existing footer counter from `{filtered.length} shown` to `{filtered.length} match · page {page}/{totalPages}` for clarity (selection count stays).

## Out of scope

- Server-side pagination (kept client-side; published-question count is bounded and already in store).
- Changes to `SelectedQuestionsSheet` (operates on small selected set; not needed).

## Files touched

- Edit: `src/components/templates/QuestionPickerSheet.tsx`
