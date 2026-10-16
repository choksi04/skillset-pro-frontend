# Admin Team Registry export: Average Rating instead of Grand Total

## What I found
- In the attached file, each domain block has a header row (`Row Labels`, skill names, `Grand Total`), one row per employee, and a bottom `Grand Total` row. The final column holds each row's sum. Example: Abhijitkumar Patel has 61 across 21 rated cells, and the Data block's bottom-right total is 1197.
- This is built in `src/lib/teamRegistryPivot.ts` (`buildAdminPivot`). The Manager long export (`teamRegistryExport.ts`) and how roles pick a format (`TeamRegistryPage.tsx`) are separate code. Neither one changes.
- Zero ratings: the shared export currently treats a stored 0 as unrated, because the rating scale starts at 1. I will change only the pivot so that a real numeric 0 coming through counts as a rating. Blank, missing and null cells stay excluded. Today the shared step turns 0 into blank before the pivot sees it, so in practice no 0 will appear. Changing that would also change the Manager export, which you asked to keep as it is.

## Changes (only `teamRegistryPivot.ts` and its test)
- Final header label: `Grand Total` becomes `Average Rating` in every domain block.
- Employee row: Average Rating = sum of that row's exported numeric skill cells / number of those cells. The value is rounded once at the end to 2 decimals and written as a number. It is blank when the employee has no rated cells.
- Bottom row: it stays labelled `Grand Total`, and its per-skill column sums don't change. Its last cell becomes the overall mean: the sum of all rated cells in the block divided by the count of all rated cells. It is not an average of employee averages. For example, the Data block would show 1197 / its cell count.
- Everything else stays the same: skill and employee order, domain blocks, padding, the "(Archived)" label, CSV encoding (BOM, CRLF, escaping, formula guard), and scope, filters and archive handling.
- Number format: the CSV cell gets the rounded number, so 2.9 shows as `2.9` in the file, and Excel displays the same value. If you want `2.90` exactly as text, say so. That would need a formatted cell instead.

## Tests
- Update `teamRegistryPivot.test.ts` with these cases:
  - 61 / 21 gives 2.9 (2.90)
  - Complete, partial and no ratings
  - A valid 0 counts toward the average
  - Overall mean is cell-weighted, not the mean of employee averages
  - Two domain blocks are calculated independently
  - Per-skill bottom totals are unchanged
- Run the full test suite. The Manager export tests must pass unchanged.
- Rebuild an Admin export from live data with a script and check Abhijitkumar Patel = 2.9 and every block's numbers independently. Browser download as Admin: confirm the Manager download is byte-identical to before.
