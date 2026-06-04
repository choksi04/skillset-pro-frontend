Hard-delete all data tied to skill category `cat-1777007273580`.

## Scope

6 skills and all their dependent rows. The category row itself is already gone.

Skills:
- skill-1777613434497 (.NET MVC)
- skill-1777613318517 (.NET Core Framework)
- skill-1777007434211 (Web-API)
- skill-1777007401235 (C# Fundamental)
- skill-1777007370794 (ADO.NET)
- skill-1777007327705 (Ef-Core)

## Deletion order (child → parent)

1. `ai_evaluations` where `question_id` in target questions
2. `attempt_answers` where `question_id` in target questions
3. `assessment_template_questions` where `question_id` in target questions
4. `questions` (53 rows)
5. `assessment_template_skills` (12 rows)
6. `domain_skill_mappings` (9 rows)
7. `skill_topics` (7 rows)
8. `skills` (6 rows)

All executed in a single SQL transaction via the insert tool so it's atomic.

## Notes
- Hard delete (not soft) as requested for cleanup.
- No assessments/attempts/registry items reference these skills, so no transactional data lost.
