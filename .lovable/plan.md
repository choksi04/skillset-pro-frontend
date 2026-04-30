# Redesign: My Registry — Editing (Draft) Page

Restructure the draft self-review form to match the mockup's two-column layout. Existing labels, terminology (skill, level, registry), and data model stay unchanged — only the UI shell, grouping treatment, and side panel change.

## Layout

```text
┌──────────────────────────────────────────────────────┬──────────────────┐
│ ← Back to Registries                                 │  Registry Summary│
│ <Domain Name>                                        │                  │
│                                                      │  CURRENT AVERAGE │
│ ── <Category 1> ─────────────────────────────────    │     4.3 / 5.0    │
│ <category description / skill count>                 │     ★★★★½        │
│                                                      │                  │
│  ┌─ Skill Card ─────────────────────────────────┐    │  Completion 75%  │
│  │ Skill name        [optional level pill]      │    │  ▓▓▓▓▓▓▓░░       │
│  │ short prompt text                            │    │  6 of 8 rated    │
│  │ Proficiency Level                            │    │                  │
│  │ [ 1 ][ 2 ][ 3 ][ 4* ][ 5 ]   (segmented)     │    │  Skills          │
│  │ Supporting Details   (Optional)              │    │  ✓ Languages 4/4 │
│  │ [ textarea ]                                 │    │  ○ Frameworks 2/4│
│  └──────────────────────────────────────────────┘    │                  │
│                                                      │  [Submit Reg.]   │
│  ┌─ Skill Card ─────────────────────────────────┐    │  [Save as Draft] │
│  │ ...                                          │    │                  │
│                                                      │ (sticky)         │
│ ── <Category 2> ─────────────────────────────────    │                  │
│  ...                                                 │                  │
└──────────────────────────────────────────────────────┴──────────────────┘
```

## Changes — `src/pages/SkillRegistryDetailPage.tsx` (`SelfReviewForm` only)

### Page shell

- Replace the single-column accordion layout with a `grid lg:grid-cols-[minmax(0,1fr)_320px] gap-8` wrapper.
- Keep the existing top header (back link, domain title, draft badge) above the grid; move the small progress + search controls into the right panel and the top of the left column respectively.

### Left column — categories and skill cards

- Render each category as an open section (no accordion / no collapse): a section header showing category name, optional one-line description (skill count), and a thin divider.
- Below the header, render each skill as an always-expanded **Skill Card** (`rounded-xl border bg-card p-5 space-y-4`). No accordions, no separate "Add comment" collapsible.
- Skill Card contents (top to bottom):
  1. Title row: skill name (semibold), optional info tooltip, tags, and a small right-aligned status pill (e.g. "Initial rating" / "Updated") when applicable.
  2. Short prompt line: keep current copy ("Assess your current proficiency...") in muted text.
  3. **Proficiency Level** label + segmented 5-button selector. Reuse `RatingSlider` but switch to a taller card-like button: each button shows the level number prominently with the short label below (derived from `getRatingLabels(levels)`). Selected button gets primary border + soft primary background; unselected stays neutral. The selected-state description block stays below.
  4. Allow unselect as well.
  5. **Supporting Details** label with `Optional, but recommended` muted hint on the right; always-visible `Textarea` (collapsible).
- Active card emphasis: the card the user is currently rating gets a `ring-1 ring-primary/40 border-primary/40` treatment (driven by a local `activeSkillId` state set on focus / click).

### Right column — Registry Summary (sticky)

- `sticky top-6 self-start rounded-xl border bg-card p-5 space-y-5` panel.
- Sections, top to bottom:
  - Title "Registry Summary" + small caption "Your progress at a glance".
  - **Current Average** tile: large numeric average on the 5.0 scale (`avgOnFive.toFixed(1)`), `/ 5.0` muted, half-star row underneath (reuse the same star-rendering pattern already used on the Registry list page).
  - **Completion**: percentage on the right, progress bar, "X of Y skills rated" line.
  - **Categories** list: one row per category with a check icon (success) when fully rated or empty circle when partial, label, and `rated/total` count on the right. Clicking a row scrolls the matching category section into view (`element.scrollIntoView({ behavior: 'smooth' })`).
  - Action buttons stacked: primary `Submit Registry` (disabled when not all rated) and a secondary `Save as Draft` outline button that flushes the pending auto-save immediately and shows a toast.
- Auto-save indicator (Saving… / Saved) moves to a small line above the action buttons.

### Behavior preserved

- Auto-save debounce, `handleRatingChange`, `handleCommentChange`, search (kept as a small input above the first category), submit confirm dialog — all unchanged.
- `previousRatings` "Last cycle" hint continues to appear inside `RatingSlider` (no behavior change).
- Submitted (read-only) view is **not** touched.

## Technical notes

- All edits in `src/pages/SkillRegistryDetailPage.tsx`. Minor variant tweak inside `src/components/registry/RatingSlider.tsx` to render number-on-top + label-below buttons, gated by an optional `variant?: 'compact' | 'card'` prop so other usages stay unchanged.
- Use only existing semantic tokens (`bg-card`, `border-border`, `text-primary`, `text-success`, `text-muted-foreground`). No raw colors.
- No new dependencies, no DB or store changes, no routing changes.
- Responsive: on `<lg`, the grid collapses to one column and the summary panel renders inline above the categories (non-sticky).