# Cleanup Transactional Data for Release

Wipe all transactional/operational records so the app launches with a clean slate, while preserving master/configuration data and the three demo accounts.

## Preserved (Master Data)

- `skill_categories`, `skills`, `skill_topics`, `skills.tags`
- `domains`, `domain_skill_mappings`
- `competency_levels`
- `assessment_config`
- `assessment_templates`, `assessment_template_questions`, `assessment_template_skills`
- `questions`
- `users` (all kept — incl. Admin, John Emp, John Manager demo accounts)
- `employee_domain_assignments` (master mapping; user↔domain)

## Cleared (Transactional Data)

Assessments & attempts:
- `assessments`
- `assessment_questions`
- `assessment_assignments`
- `assessment_attempts`
- `attempt_answers`
- `ai_evaluations`
- `attempt_skill_scores`

Reviews:
- `manager_reviews`
- `review_skill_entries`
- `reassessment_requests`

Skill registries:
- `skill_registries`
- `skill_registry_items`
- `skill_registry_submissions`
- `skill_self_ratings`
- `registry_reviews`
- `registry_review_items`
- `official_skill_entries`

Notifications:
- `notifications`

## Technical Notes

- Executed as a single `TRUNCATE ... RESTART IDENTITY CASCADE` via the insert/data tool — schema, RLS, GRANTs, triggers, functions, and config remain untouched (per the database reset policy memory).
- No migration is needed; this is data-only.
- After cleanup, the demo users can immediately start a fresh end-to-end cycle (registry → assessment → review).

## Out of Scope

- No changes to table structures, policies, edge functions, or app code.
- Storage buckets unaffected (none exist).
- Auth users (Supabase `auth.users`) are not touched.

Confirm and I'll run the cleanup.
