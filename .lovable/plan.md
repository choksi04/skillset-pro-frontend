## Goal
Make AI question generation topic-aware, and replace the mandatory "Organization context" with an optional free-form "Additional context".

## Changes

### 1. Edge Function — `supabase/functions/generate-questions/index.ts`
- Accept new inputs: `topicName?: string`, `topicDescription?: string`, `additionalContext?: string`.
- Remove `organizationContext` from the request and prompt.
- Update the system/user prompt:
  - If `topicName` present: add a rule like `Focus specifically on the topic "${topicName}" within the "${skillName}" skill.` and, if `topicDescription` present, append `Topic description: "${topicDescription}"`.
  - If `additionalContext` present: include as `Additional context: "${additionalContext}"`; otherwise omit entirely (no default org line).

### 2. Caller — `src/pages/QuestionBankPage.tsx`
- Replace `aiContext` default string with empty string; state stays but becomes optional.
- Update Zod schema: `organization_context` → `additional_context: z.string().trim().max(1000).optional().or(z.literal(''))` (no min length).
- When invoking `generate-questions`, send:
  - `topicName` (already passed) — keep.
  - `topicDescription`: look up from `topics[aiSkillId]` by `aiTopicId` and pass `.description` when available.
  - `additionalContext`: pass `aiContext` only if non-empty; drop `organizationContext`.
- UI (AI panel):
  - Rename the textarea label from "Organization context" to "Additional context (optional)".
  - Update placeholder to something like "Optional: add any extra guidance for the AI (audience, tech stack, tone, etc.)".
  - Remove the required-field asterisk/validation error display for this field.

### 3. Topic description lookup
- `topicMap` currently stores only names. Add a small `topicDescMap` (id → description) built the same way from `topics` in `useSkillStore`, used only inside the generate handler.

## Out of scope
- No DB schema changes.
- No changes to non-AI question authoring flow.
- No changes to other callers (none exist besides QuestionBankPage).
