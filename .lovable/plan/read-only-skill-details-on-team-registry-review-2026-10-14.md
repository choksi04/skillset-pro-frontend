# Read-only skill details on Team Registry review

## What you'll get
An info icon beside each skill name in "Skill Review Breakdown" (tooltip "View skill details"). Clicking it, or pressing Enter/Space, opens the same right-side panel used in the Skill Library. It shows name, full description, category, tags, status, and topics with full descriptions. It has no Add Topic, edit, delete, or action menus.

## Approach (smallest reuse)
- Reuse the existing Skill Library panel (`SkillDetailDrawer`) and add a `readOnly` option. When it is on:
  - editing controls and the topic dialogs are hidden
  - topic descriptions are shown in full instead of being cut to two lines
  - the category name is shown
  - a "No description provided" message appears when needed
  - an error message with a Retry button appears if topics fail to load
- The Skill Library page stays the same, because `readOnly` is off by default.
- The topic loader in the skill store currently hides failures. It will report success or failure so the panel can show the error. This change is backward compatible.
- Stale data guard: the panel tracks which skill a load belongs to. Results that arrive after you switch skills are ignored, so the old skill's topics never show and there is no wrong-skill flash.
- Team Registry detail page: track the selected skill ID locally. The panel opens using the skill from the existing skill catalog, matched by ID (the registry item's `skill_id` maps to `skills.id`). Ratings, notes, and review state are separate pieces of state, so opening the panel leaves them alone.
- Permissions: the icon only shows on the page after its existing check passes (Admin, or Manager within scope). It does not depend on Skill Library edit rights. Viewing the panel only reads data and never writes.
- Accessibility: the panel already supports Escape to close, traps keyboard focus, and returns focus to the icon that opened it. Long content scrolls inside the panel, and the panel uses full width on phones.

## Files
- `src/components/skills/SkillDetailDrawer.tsx`: add the `readOnly` option, the empty and error states, and the stale-data guard
- `src/stores/skillStore.ts`: the topic loader returns success or failure
- `src/pages/TeamRegistryDetailPage.tsx`: add the info icon, tooltip, and panel
- `src/pages/UserGuidePage.tsx`: add one line about the new icon

## Verification
- Browser check as Admin: open several skills one after another; enter a rating and a note, open and close the panel, and confirm both are kept; test keyboard use and phone width.
- Manager login uses Microsoft sign-in only, so the Manager check may not be possible in the browser. If so, I'll say so in the report.
