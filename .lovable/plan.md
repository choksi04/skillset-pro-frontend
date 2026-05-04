## Add "Beta" label to sidebar

Add a subtle Beta indicator in the sidebar that signals the product is evolving and invites feedback — using positive, forward-looking language rather than disclaimers about bugs.

### Placement

Inside the existing logo header in `src/components/layout/AppSidebar.tsx`, next to the "SIAP" title, add a small "Beta" pill badge. This keeps it always visible without taking extra vertical space.

Additionally, add a one-line tooltip on hover with the positive message:

> "You're using an early version — your feedback shapes what comes next."

### Visual design

- Small rounded pill, indigo/blue accent matching the brand (`bg-primary/15 text-primary` or `border border-primary/30`)
- Text: `Beta` (10px, medium weight, uppercase tracking)
- Sits inline to the right of the "SIAP" wordmark
- Tooltip uses existing shadcn `Tooltip` component

### Files to change

- `src/components/layout/AppSidebar.tsx` — add the Beta pill + tooltip in the logo block

No other files need updating. No memory changes required (purely cosmetic, not a recurring rule).

Remove the "Role" section from the sidebar as well.