## Profile popover redesign

Replace the right-side profile drawer with an inline popover that opens directly above the user's name in the sidebar footer.

### 1. New component: `src/components/layout/ProfilePopover.tsx`
- Use shadcn `Popover` (`PopoverTrigger` + `PopoverContent`).
- `PopoverContent` props: `side="top"`, `align="start"`, `sideOffset={8}`, width ~`w-72`, no modal overlay (Popover never renders one — unlike Sheet).
- Trigger: the existing user button (avatar + name + email) in `AppSidebar` footer.
- Content sections (compact, single card — inspired by mockup but trimmed):
  1. **Identity block** — avatar, full name, email, role badge.
  2. **Details** — Designation, Department, Domain (home), **Your Domain Lead** (renamed from "Domain Lead Of"). When the user leads no domains, show `<span className="italic text-muted-foreground">No domain lead assigned</span>`.
  3. **Appearance toggle** — light/dark switch (reuse existing `useTheme`).
  4. **Sign out button** — full-width `Button variant="outline"` with `LogOut` icon, calls `logout()` from `useAuth`.
- Reuse the data-loading logic currently in `ProfileSheet` (home domain name + led domains query).

### 2. Update `src/components/layout/AppSidebar.tsx`
- Remove `ProfileSheet` import, state (`profileOpen`), and the separate footer `LogOut` button (sign out now lives inside the popover).
- Wrap the user button with `<Popover><PopoverTrigger asChild>…</PopoverTrigger><ProfilePopover /></Popover>`, or render `<ProfilePopover />` that internally wires trigger + content. Simpler: the new component exposes a `children` slot used as trigger.

### 3. Delete `src/components/layout/ProfileSheet.tsx`
- No longer used.

### Out of scope
- No changes to auth, theme, or domain logic.
- No routing changes.
- No visual restyling of the sidebar itself.

### Technical notes
- `Popover` from `@/components/ui/popover` already exists in the shadcn setup.
- Popovers do not create a backdrop/overlay, satisfying the "no overlay" requirement.
- "Your Domain Lead" label still renders the badges of domains the user leads; only the heading text and empty-state copy change.