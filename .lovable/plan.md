Hard-delete category **cat-1779952831692** (.NET-Tech) and all related data.

## Scope

**Category:** cat-1779952831692 — .NET-Tech (active)

**Skill (1):** skill-1779952903262 — Design Patterns

**Related rows:**
| Table | Rows |
|---|---|
| skill_topics | 3 |
| questions | 15 |
| domain_skill_mappings | 1 |
| assessment_template_skills | 1 |
| assessment_template_questions | 0 |
| ai_evaluations / attempt_answers / registry / review / scores | 0 |

No transactional data references this skill — safe to hard delete.

## Deletion order
1. `assessment_template_questions` (via question_id)
2. `questions`
3. `assessment_template_skills`
4. `domain_skill_mappings`
5. `skill_topics`
6. `skills`
7. `skill_categories` (the category row itself)

Executed atomically via a single CTE statement.
