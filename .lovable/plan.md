

# Fix Review Cycle Activation: Domain-First Flow & Formatted Errors

## Problem

1. **Readiness checks run against ALL active domains** — The current `runReadinessCheck` checks every active domain (line 148-197), even if the admin only wants to activate the cycle for specific ones. This causes false failures for domains not participating.

2. **Error details are paragraph-formatted** — Gaps like question coverage are shown as a single semicolon-separated string, making them hard to read.

3. **Flow is backwards** — Domain selection appears *below* the readiness results. The admin should pick domains *first*, then the checks run scoped to those domains.

## Changes

### 1. Restructure the readiness dialog into two steps

**Step 1 — Domain Selection**: Show domain checkboxes with skill counts. A "Run Readiness Check" button triggers step 2.

**Step 2 — Scoped Readiness Results**: Run all checks only against the selected domains. Show results with proper formatting.

State: add `readinessStep: 1 | 2` to track which step is active.

### 2. Scope all checks to selected domains only

Refactor `runReadinessCheck` to accept a `domainIds: string[]` parameter. Every check filters against only those domains:
- "Domains have skills mapped" — only checks selected domains
- "Sufficient published questions" — only checks skills mapped to selected domains
- "Domains have assigned employees" — only checks selected domains
- "Domains have a domain lead" — only checks selected domains

### 3. Format error details as bullet lists

Replace the single `detail` string with a `details: string[]` array. Render each item as a separate line in the UI:

```
✗ Sufficient published questions for all skills
  • React / L1 / scenario: 0/2
  • React / L1 / coding: 0/2
  • React / L2 / scenario: 0/2
  ...and 20 more
```

For the gaps list, show up to 10 items with a "show all" toggle, each on its own line. For missing domains/employees/leads, show each domain name as a separate bullet.

### 4. UI layout for the two-step dialog

**Step 1 UI:**
- Title: "Select Participating Domains"
- Domain checkboxes (existing UI)
- Footer: Cancel | "Check Readiness →" button (disabled if no domains selected)

**Step 2 UI:**
- Title: "Pre-Activation Readiness Check"
- Subtitle showing selected domain count
- Readiness check items with formatted detail lists
- "← Back" link to return to step 1 and change selection
- Footer: Cancel | "Proceed to Activate" (disabled if blocking checks fail)

## Files Modified

- `src/pages/ReviewCyclesPage.tsx` — Restructure readiness dialog, scope checks, format details

## Technical Details

- `readinessChecks` type changes from `{ label; pass; detail?: string }[]` to `{ label; pass; details?: string[] }[]`
- `runReadinessCheck` signature becomes `runReadinessCheck(cycleId: string, domainIds: string[])` 
- Gap display: render `details` as a `<ul>` with `<li>` items, capped at 10 visible with a "Show all N" toggle
- The "Proceed to Activate" button remains disabled if any blocking check fails (same rules as current, excluding "No other cycle active" and "Sufficient questions")

