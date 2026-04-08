# Rename "Question Settings" → "Assessment Configuration" & Fix Hardcoded Cards

## What Changes

### 1. Rename page and menu item

- **New menu title**: "Assessment Config"
- **New page heading**: "Assessment Configuration"
- **New subtitle**: "Configure competency levels, assessment generation limits, and scoring rules."
- **Change the route as well.**

Files to update:

- `AppSidebar.tsx` line 76: title → "Assessment Config"
- `PageHeader.tsx` line 23: title → "Assessment Configuration"  
- `QuestionSettingsPage.tsx` line 84: heading text

### 2. Make Assessment Question Limits cards data-driven (not hardcoded)

Currently, the three cards (Scenario, MCQ, Coding) come from a hardcoded `questionTypesMeta` array. If a new question type is added to `assessment_config` in the database, it won't appear.

**Fix**: Remove the hardcoded `questionTypesMeta` array. Instead, render cards directly from `configs.filter(c => c.config_type === 'global')`. Each card shows the `question_type` as its title (formatted), and min/max badges. The description can be a short generic line or omitted — the important data is the min/max values.

For display labels, derive them from the `question_type` field itself (capitalize first letter, e.g. `mcq` → `MCQ`, `scenario` → `Scenario`, `coding` → `Coding`).

### 3. Add inline help text clarifying the two "min questions" concepts

- **Competency Levels section**: Add helper text: *"Min Questions defines the minimum number of published questions required per skill at this level before assessments can be generated. This is a readiness prerequisite, not a generation count."*
- **Assessment Question Limits section**: Add helper text: *"These limits control how many questions of each type the system selects per skill when generating an assessment."*

### 4. Scoring Rules — keep but clarify

The Scoring Rules card stays on this page since it directly references the competency level score ranges configured above it. It's informational context that helps admins understand what their score range settings produce.

## Files Modified

- `src/components/layout/AppSidebar.tsx` — menu title
- `src/components/layout/PageHeader.tsx` — breadcrumb title
- `src/pages/QuestionSettingsPage.tsx` — heading, remove hardcoded `questionTypesMeta`, render from DB configs