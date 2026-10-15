# Team Registry: Admin pivot CSV export

## What I found
- Template: UTF-8 BOM, CRLF, 17 columns on every row. Row 1 `DATA`, row 2 `Sum of Self Rating (Level)`, `Skills`, row 3 `Row Labels`, 15 skill names, `Grand Total`. Then 39 employees A to Z, blanks for unrated cells, and a `Grand Total` row (overall total 1197).
- The template is an Excel pivot of today's long export, which has one row per employee, version and skill. The skill columns are the 12 current "Data - ..." skills sorted A to Z, then `DB Modelling`, `SQL Basic`, `SSIS`.
- Those last three are disabled or no longer mapped to Data. They come only from approved older versions, which export their own saved skills (the frozen-history rule).
- Each user has a single role (`users.role`), and `currentRole` is either admin or manager. An Admin with Manager rights is therefore treated as Admin, which is what you asked for.
- **Duplicate names:** two different skills are named "Data - Palantir Foundry" (one disabled), and two are named "Data - AWS Cloud Services". The pivot merged them by name. That is why Dhruv Patel shows 7 and 6, which is above the 5-level scale.

## Proposed mapping
- **Version rule (unchanged):** each employee contributes one registry, their latest version (the same one the table shows). Approved versions use their own saved skills; other versions use the domain's current active skills. Ratings are never added up across versions.
- **Value:** the stored `skill_registry_items.self_score` for that version. Missing or 0 is left blank. The current table and long export treat 0 as "unrated", and the rating scale starts at 1, so no real zero exists.
- **Rows:** one row per employee, matched by employee ID and ordered by display name A to Z, with ties broken by ID. If two different employees share a name, I add the email after the name in brackets so the rows are never merged.
- **Columns:** one column per skill ID. Order: the domain's current active mapped skills A to Z, then other skills that appear only in exported versions (inactive or unmapped), A to Z. For Data this matches the template order. A skill with ratings is never dropped.
- **Duplicate skill names:** kept as separate columns. The inactive or unmapped copy gets the suffix ` (inactive)`. If two copies are both active, I add a short ID suffix. This means Dhruv's Palantir 7 becomes, for example, 4 + 3 in two columns, and the totals still add up.
- **Multiple domains:** one matrix block per domain in the same file, ordered by domain name. Each block starts with its own domain-name row (like `DATA`), its own "Sum of..." row, its own header row and its own Grand Total row, with one blank row between blocks. All rows are padded to the widest block's column count. A filtered single-domain export gives exactly one block, matching the template.
- **Totals:** worked out from the exported number cells only, and written as numbers, not formulas.
- **Scope:** same as now. The rows come from `sortedRows` (search, filters and all pages), and the button is visible only to Admin and Manager. Employees are re-sorted A to Z inside each block, as the template does.

## Changes
- `src/lib/teamRegistryExport.ts`: pull out the existing per-registry skill resolution into a shared internal step, then add `buildAdminPivotExport()` that reuses it. The long builder's output does not change.
- `src/lib/csv.ts`: add `rowsToCsv(rows)` (no header argument) that uses the same escaping, BOM and CRLF. `toCsv` stays the same.
- `src/pages/TeamRegistryPage.tsx`: in `handleExport`, Admin uses the pivot builder and Manager keeps the current builder. Same filename and button.
- `src/lib/teamRegistryExport.test.ts` (new): totals add up, blanks stay blank, duplicate names stay separate, the multi-domain layout is correct, and the formula guard works on names.
- User Guide: one line describing the Admin export format.

## Verification
- Unit tests.
- Build the Data export from live data with a script and compare the structure and labels with the template cell by cell. Spot-check 5 employees against the database, and check the totals independently.
- Do a browser export as Admin (dev login), then compare a Manager export with the current output byte for byte.
- Excel cannot be opened from here, so Excel opening will be reported as not checked.

## Open question
Do you want duplicate-named skills kept as separate columns (proposed above), or merged into one column by name as in the template? Merging can produce totals above 5.
