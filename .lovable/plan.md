## Why the heatmap looks empty

The widget today silently drops data through three stacked filters:

1. Registry must be **Approved** (manager reviewed, status `approved`).
2. Only the **latest version** per employee is considered — even if that latest is unapproved while an older version is approved.
3. Skills must map to an **active category** and employee's domain must be **active**.

Your DB has 8 approved registries, but many employees' newest version is still pending review, so they get excluded entirely. Result: a near-empty grid.

The "Show only populated" toggle is a workaround for sparseness — it doesn't help the admin understand *why* cells are empty.

## Goals

- Use registry data that actually exists in the system.
- Tell the admin clearly what the heatmap is showing and what's missing.
- Drop the populated-toggle — replace it with a meaningful control.

## Changes

### 1. Use **latest approved registry per employee** (not "latest if it happens to be approved")

Walk all submitted registries in version-desc order and pick the **first approved one** for each employee. This unlocks all 8 approved registries in your DB instead of only those where the newest version is approved.

### 2. Add a "data source" mode toggle

Replace the populated/empty toggle with a single Select:

- **Approved only** (default) — current behavior, validated data.
- **All submitted** — include submitted-but-unreviewed registries so the heatmap fills in earlier in the cycle. Cells get a small "pending" dot when they include unapproved data.

This answers the real question: "do I want validated truth, or current self-reported state?"

### 3. Always show the full active-domain × active-category grid

No more hiding rows/columns. Sparseness is information — a fully empty row means that domain hasn't been validated yet, which is a finding the admin needs to see.

### 4. Add a coverage strip above the grid

Three small stats so the admin understands the denominator at a glance:

- `Employees included: X of Y` (how many had a qualifying registry)
- `Cells populated: X of Y`
- `Mode: Approved only | All submitted`

### 5. Improve empty-state copy

When zero cells fill, replace the generic message with an explanation of which gate failed:

- No active domains/categories → existing "Set up framework" CTA.
- No qualifying registries in current mode → "0 of N employees have an approved registry. Switch to All submitted to include in-flight data."

### 6. Tooltip stays, plus add: "Last approved: <date>" per cell

Helps spot stale validation.

### 7. Remove the auto-sparse toggle and the `hideEmpty` state entirely

Simpler component, fewer hidden behaviors.

## Files

- `src/components/dashboard/admin/SkillHeatmap.tsx` — replace toggle with mode select, change aggregation to "latest approved per employee", add coverage strip, update empty states.
- No DB or store changes needed.

## Out of scope

- Pulling assessment AI scores into the heatmap (that would be a separate "Validated vs AI" view).
- Click-through filters on `/all-registries` already work; no change.
