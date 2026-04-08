# Plan: Truncate All Database Tables

## What This Does

Clears all data from every table in the database so you can start fresh. This is irreversible.

## Execution Order

Tables must be truncated in dependency order (child tables first) to avoid constraint issues:

1. **Leaf tables first**: `ai_evaluations`, `attempt_answers`, `attempt_skill_scores`, `review_skill_entries`, `skill_self_ratings`, `notifications`, `reassessment_requests`, `official_skill_entries`
2. **Mid-level**: `assessment_questions`, `assessment_attempts`, `manager_reviews`
3. **Parent-level**: `assessments`, `skill_registry_submissions`, `employee_domain_assignments`
4. **Core config**: `questions`, `skill_topics`, `domain_skill_mappings`, `domains`, `skills`, `skill_categories`, `review_cycles`, `users`
5. **Settings** (preserve or clear): `question_settings` — this contains your competency level configuration. I recommend **keeping** this data.

## Technical Detail

Since there are no foreign key constraints defined in the database, a single `DELETE FROM` per table will work. This will be executed using the data insert tool (which supports DELETE operations).

## What Will NOT Be Touched

- `question_settings` — preserves your L1–L5 competency level configuration (unless you want this cleared too)
- Database schema, functions, triggers — unchanged
- Keep the demo accounts as well.
  - Admin
  - John Emp
  - John Manager