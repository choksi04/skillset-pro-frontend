## Goal
Replace the teal/green `--accent` token (used by `hover:bg-accent` on buttons, dropdowns, sidebar items, etc.) with a subtle neutral gray that matches the surrounding UI surfaces in both light and dark mode.

## Why
`--accent` is currently set to a saturated teal (`174 62% 40%`), which causes the entire button/menu item background to flash green on hover — visually loud and inconsistent with the minimalist neutral palette.

## Change

**File:** `src/index.css`

### Light mode (line 25–26)
```diff
-    --accent: 174 62% 40%;
-    --accent-foreground: 0 0% 100%;
+    --accent: 210 15% 93%;        /* same as --secondary, soft cool gray */
+    --accent-foreground: 220 25% 18%;
```

### Dark mode (line 68–69)
```diff
-    --accent: 174 62% 45%;
-    --accent-foreground: 0 0% 100%;
+    --accent: 220 18% 18%;        /* same as --secondary, soft dark gray */
+    --accent-foreground: 210 15% 92%;
```

This aligns `accent` with the existing `secondary` surface so hover states on ghost/outline buttons, dropdown items, sidebar links, and command menu rows blend in naturally instead of standing out in green. Foreground keeps text readable on the new neutral surface.

## Out of scope
- No changes to `--primary` (the brand blue stays).
- No changes to `--sidebar-accent` (already neutral).
- No component code changes — the existing `hover:bg-accent` / `hover:text-accent-foreground` classes pick up the new values automatically.
