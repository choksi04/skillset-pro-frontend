# Team Registry Export — CSV-only verification

## Finding from code inspection

The current export already produces a genuine CSV file:

- `src/lib/csv.ts`
  - `toCsv()` builds comma-separated text with a UTF-8 BOM (`\uFEFF`) prefix and CRLF (`\r\n`) row endings.
  - `escapeCsvCell()` quotes every field, doubles inner quotes, and prefixes values starting with `=`, `+`, `-`, `@`, tab, or CR with `'` (formula-injection protection).
  - `downloadCsv()` creates a `Blob` with MIME type `text/csv;charset=utf-8` and downloads it via an anchor with a `.csv` filename.
  - `timestampedFilename('Team_Registry')` produces `Team_Registry_YYYY-MM-DD_HH-mm.csv`.
- `src/pages/TeamRegistryPage.tsx` calls `downloadCsv(toCsv(TEAM_REGISTRY_HEADER, data), timestampedFilename('Team_Registry'))` — no XLSX/JSON/HTML/ZIP anywhere in the path.

So no code change appears necessary. The plan is to **verify the actual downloaded file** and only fix if a discrepancy is found.

## Steps

1. **Browser verification (Playwright):** load the preview, intercept the download event on the Export button (or simulate the export path), and inspect the downloaded file:
   - extension is `.csv`
   - first bytes are the UTF-8 BOM (`EF BB BF`)
   - rows end with CRLF
   - fields are comma-separated and quoted
   - header row matches `TEAM_REGISTRY_HEADER`
2. **If any check fails:** apply the smallest fix in `src/lib/csv.ts` (the single shared helper) and re-verify.
3. **If all checks pass:** no code changes; report the verified format details.

## What will NOT change

- Export columns, full-dataset retrieval, search/filter behavior, Admin/Manager scoping
- Team Registry pagination
- Export button placement (before Search and Filter)

## Limitations to report

- Excel's delimiter behavior depends on regional settings: on systems where the list separator is `;`, double-clicking a comma-delimited `.csv` may show one column; importing via Data > From Text/CSV always works. This will be stated, not claimed as universal compatibility.
- A real signed-in export (Manager/Admin) cannot be clicked end-to-end from the sandbox without Microsoft sign-in; verification will use the download-interception approach plus code-level confirmation, and manual QA steps will be listed.
