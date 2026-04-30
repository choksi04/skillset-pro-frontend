## Problem

The manager rating dropdown shows the level number twice (e.g. `L3 — L3 – Demonstrating (Demonstrating)`), and the selected value in the trigger gets ellipsised because the trigger is too narrow.

The DB already stores level info redundantly:
- `label` = `"L3 – Demonstrating"` (already includes the "L{n}" prefix)
- `name`  = `"Demonstrating"`

So prefixing with `L{level}` in the UI duplicates what `label` already contains.

## Fix

In `src/pages/TeamRegistryDetailPage.tsx`, in the manager-score `Select`:

1. **Drop the `L{level}` prefix** in both the trigger and dropdown items — `label` already carries it.
2. **Item format**: `{label} ({name})` → e.g. `L3 – Demonstrating (Demonstrating)` becomes simply `L3 – Demonstrating` if `name` duplicates the label tail; otherwise show both. To keep it simple and avoid duplication when `name` is contained in `label`, suppress the `({name})` suffix when `label` already includes `name`.
3. **Selected value (trigger)**: show just `{label}` (e.g. `L3 – Demonstrating`).
4. **Trigger width**: change from `w-44` to `min-w-[14rem]` so labels like "L3 – Demonstrating" fit without ellipsis.

### Target snippet

```tsx
<SelectTrigger className="h-8 min-w-[14rem] text-xs">
  <SelectValue placeholder="Select level">
    {mgrScore != null
      ? (scoreOptions.find((l) => l.level === mgrScore)?.label ?? `L${mgrScore}`)
      : null}
  </SelectValue>
</SelectTrigger>
<SelectContent>
  {scoreOptions.map((l) => {
    const showName =
      l.name && !l.label?.toLowerCase().includes(l.name.toLowerCase());
    return (
      <SelectItem key={l.id} value={String(l.level)}>
        <span className="font-medium">{l.label}</span>
        {showName ? (
          <span className="text-muted-foreground"> ({l.name})</span>
        ) : null}
      </SelectItem>
    );
  })}
</SelectContent>
```

### Files touched

- `src/pages/TeamRegistryDetailPage.tsx` — only the manager-score `Select` block (no other logic changes).

### Out of scope

- No DB or schema changes.
- No changes to score persistence or read-only Approved view.
