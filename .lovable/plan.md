## Goal
Transform the current centered login card into a polished, two-column split layout that creates a strong first impression — minimal, professional, and on-brand for SIAP.

## Layout (Split Screen)

```
+-----------------------------+----------------------------+
|  LEFT  (brand panel)        |  RIGHT  (auth panel)       |
|  - Soft gradient bg         |  - Clean white/card bg     |
|  - SIAP wordmark + tagline  |  - "Welcome back" heading  |
|  - Short value statement    |  - "Continue with 1Rivet   |
|  - 3 feature highlights     |     Account" primary btn   |
|    (icon + title + sub)     |    (Microsoft icon + blue) |
|  - "Powered by 1Rivet" +    |  - Divider: "OR"           |
|    1Rivet logo (bottom)     |  - Collapsible "Use email  |
|                             |    instead" (no demo creds)|
|                             |  - Footer: Contact admin   |
+-----------------------------+----------------------------+
```

On screens < `lg`, the left brand panel is hidden and the right panel centers full-width.

## Left Panel — Brand & Story
Soft gradient background using existing primary tokens (indigo/blue tints) with subtle radial glow. Content (top → bottom):

1. **SIAP wordmark** with the Brain icon mark.
2. **Hero line**: "Skill Intelligence, made measurable."
3. **Sub copy** (1–2 lines): "Replace spreadsheets with evidence-based skill assessments — designed for modern teams."
4. **Three feature highlights** (icon + 1-line title + short sub):
   - Shield → "Enterprise SSO" — "Secure access with your 1Rivet account"
   - Target → "Validated Skills" — "AI-evaluated, manager-approved registries"
   - BarChart3 → "Capability Visibility" — "Know your team's strengths at a glance"
5. **Footer block** (bottom-left): small "Powered by" label + the 1Rivet SVG logo (`src/assets/1rivet-logo.svg`).

## Right Panel — Auth
- Heading: **"Welcome back"** + sub: "Sign in to continue to SIAP"
- Primary button: **"Continue with 1Rivet Account"** with the colored Microsoft logo, full-width, h-11, primary background.
- Loading state: "Signing in…"
- Inline error alert (kept as-is, refined styling).
- Subtle divider with "OR" label.
- Collapsible **"Use email instead"** trigger (chevron). Expands to email input + "Sign in" button. **All demo account text/credentials removed.**
- Footer line: "Don't have an account? Contact your administrator."

## Component Changes — Single File
**`src/pages/LoginPage.tsx`** — full redesign. No other files change.

### Technical details
- Use existing imports: `Button`, `Input`, `Label`, lucide icons (`Brain`, `ShieldCheck`, `Target`, `BarChart3`, `ChevronDown`, `ChevronUp`, `AlertCircle`, `Mail`).
- Import 1Rivet logo: `import rivetLogo from "@/assets/1rivet-logo.svg";` then `<img src={rivetLogo} alt="1Rivet" className="h-5 opacity-80 dark:invert" />`.
- Keep existing auth handlers (`login`, `loginWithAzure`) and `MicrosoftIcon` component unchanged.
- Rename button label from "Sign in with Microsoft" → **"Continue with 1Rivet Account"**.
- Remove the entire "Demo accounts" credential list block.
- Rename collapsible label from "Demo Login" → **"Use email instead"** (keeps the email fallback functional but de-emphasizes it).
- Layout: `grid lg:grid-cols-2 min-h-screen`. Left: `hidden lg:flex` with gradient bg `bg-gradient-to-br from-primary/10 via-background to-primary/5` plus a decorative blurred radial accent. Right: `flex items-center justify-center p-6 sm:p-12`, inner container `w-full max-w-sm`.
- Dark mode: rely on existing semantic tokens (`bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`) — no hard-coded colors.
- Accessibility: proper label associations, `aria-label` on collapsible trigger, focus rings preserved.

## Out of Scope
- No auth logic changes.
- No new routes, stores, or DB changes.
- No changes to `MicrosoftIcon` or `AuthContext`.
