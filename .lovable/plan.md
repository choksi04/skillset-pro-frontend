# Fix Team Registry header/data misalignment

## Root cause (confirmed by code inspection)

In `src/pages/TeamRegistryPage.tsx` the header row and body rows list columns in different orders:

- **Header order:** Team Member → Status → Completion → Avg Rating → **Registry Subject** → Actions
- **Body cell order:** Team Member → **Registry Subject** → Status → Completion → Avg Rating → Actions

So the "Registry Subject" label sits above the Avg Rating column, and every header from Status onward is shifted one column left of its data. This happened when the caret-sorting change rewrote the sortable headers as a mapped array and appended Registry Subject after it. Labels, carets, widths, and cell content are all otherwise correct.

## Fix (smallest possible)

In `src/pages/TeamRegistryPage.tsx` only:

1. Move the plain (non-sortable) **Registry Subject** `TableHead` so it renders between the Team Member and Status headers — matching the body cell order exactly.
2. No other changes: caret controls, sort logic, widths, padding, pagination, CSV export, and role rules stay as-is.

## Verification

- `npx tsgo --noEmit` — clean.
- Run existing sorting unit tests (`src/lib/teamRegistrySort.test.ts`) — must stay green.
- Browser check (app-level localStorage auth as Admin): confirm each header sits above its data, sort carets still work on the four sortable columns, Registry Subject has no control, and the table is usable at desktop and phone widths (existing `min-w-[720px]` horizontal scroll preserved).

## Out of scope

No label renames, no width/padding redesign, no changes to sorting logic, export, pagination, or permissions.
