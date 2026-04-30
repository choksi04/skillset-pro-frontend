## Problem

On the **Team Registry Detail Page**, when a manager picks a score for a skill, the dropdown items render as `NaN` (or a confusing `label + name` string with a literal "+" character). Root cause is in `src/pages/TeamRegistryDetailPage.tsx` around line 405–409:

```tsx
<SelectItem key={l.id} value={String(l.level)}>
  {/* /* {((l.name / maxLevel) * 5).toFixed(1)} */ */}
  {l.label} + {l.name}
</SelectItem>
```

- `l.name` is a string, so any prior arithmetic on it produced `NaN`.
- The leftover `+` between `label` and `name` renders as literal text.
- The `SelectTrigger` is `w-20` — too narrow to display a level + label cleanly when selected.

## Fix

Update the manager score `Select` in `src/pages/TeamRegistryDetailPage.tsx` to show competency levels properly, sourced dynamically from `competency_levels` (per the project's dynamic competency levels rule).

### Changes

1. **Dropdown items** — render each option as:
   ```
   L{level} — {label} ({name})
   ```
   Example: `L3 — Proficient (Independent)`

2. **Selected value (trigger)** — show a compact form:
   ```
   L{level} · {label}
   ```
   Example: `L3 · Proficient`
   Use a custom child inside `<SelectValue>` so the trigger shows the friendly label rather than the raw numeric value.

3. **Trigger width** — widen `SelectTrigger` from `w-20` to `w-44` (or `min-w-[11rem]`) so the level + label fits without truncation. Keep `text-xs` and `h-8`.

4. **Fallback** — if `label` or `name` is missing on a level row, gracefully fall back to just `L{level}`.

### Technical snippet (target shape)

```tsx
<Select
  value={mgrScore != null ? String(mgrScore) : ""}
  onValueChange={(v) => handleScoreChange(skill.id, v)}
  disabled={!isReviewable}
>
  <SelectTrigger className="h-8 w-44 text-xs">
    <SelectValue placeholder="Select level">
      {mgrScore != null
        ? (() => {
            const lvl = scoreOptions.find((l) => l.level === mgrScore);
            return lvl ? `L${lvl.level} · ${lvl.label}` : `L${mgrScore}`;
          })()
        : null}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {scoreOptions.map((l) => (
      <SelectItem key={l.id} value={String(l.level)}>
        <span className="font-medium">L{l.level}</span>
        <span className="text-muted-foreground"> — {l.label}</span>
        {l.name ? <span className="text-muted-foreground"> ({l.name})</span> : null}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Files touched

- `src/pages/TeamRegistryDetailPage.tsx` — fix the SelectItem rendering, add controlled SelectValue child, widen the trigger.

### Out of scope

- No DB/schema changes. `competency_levels` already provides `level`, `label`, `name`.
- No changes to the score persistence logic (`handleScoreChange`) — value sent stays as the numeric level.
- No changes to the Self-Rated side or Approved (read-only) view.
