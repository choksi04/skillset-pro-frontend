
## Scope

Hard-delete all skill registry and assessment transactional data for these 5 employees only. Users themselves and all master data (skills, categories, domains, templates, questions, competency levels, domain assignments) remain untouched.

| Name | User ID |
|---|---|
| Keval Kiniyara | `user-1777007498020` |
| Kishan Mistry | `95152a0a-dee7-4510-9485-eebbb6dd3266` |
| Purvesh Desai | `5b54cc8b-75c0-481b-a477-e10c640c5c28` |
| Chiranjiv Rathod | `5b4b8351-782f-4b31-9805-9b423e1ca659` |
| Akash Prajapati | `c55fef0f-8faa-40bc-b3a5-8a763e88df2c` |

## Current footprint

- skill_registries: 5, registry_reviews: 3
- assessments: 23, assignments: 23, attempts: 19, manager_reviews: 10
- official_skill_entries: 18, notifications: 48
- skill_registry_submissions / skill_self_ratings / reassessment_requests: 0

## Deletion order (children first, scoped to these 5 users)

Executed in a single SQL block. Every WHERE clause is scoped by `employee_id IN (…5 IDs…)` (or its parent's id resolved from that filter), so no other user's data is touched.

**Assessment side**
1. `ai_evaluations` where `attempt_id` ∈ attempts of these employees
2. `attempt_answers` where `attempt_id` ∈ …
3. `attempt_skill_scores` where `attempt_id` ∈ …
4. `assessment_attempts` where `employee_id IN (...)`
5. `manager_reviews` where `assessment_id` ∈ assessments of these employees
6. `assessment_questions` where `assessment_id` ∈ …
7. `assessments` where `employee_id IN (...)`
8. `assessment_assignments` where `employee_id IN (...)`
9. `reassessment_requests` where `employee_id IN (...)`

**Registry side**
10. `registry_review_items` where `review_id` ∈ registry_reviews of these employees' registries
11. `registry_reviews` where `registry_id` ∈ skill_registries of these employees
12. `review_skill_entries` where `employee_id IN (...)`
13. `official_skill_entries` where `employee_id IN (...)`
14. `skill_registry_items` where `registry_id` ∈ skill_registries of these employees
15. `skill_registries` where `employee_id IN (...)`
16. `skill_self_ratings` where `submission_id` ∈ submissions of these employees (currently 0)
17. `skill_registry_submissions` where `employee_id IN (...)`

**Notifications**
18. `notifications` where `target_user_id IN (...)` — only their own notifications (48 rows).

## Preserved

- `users` rows (accounts stay active)
- `employee_domain_assignments` (domain mapping — master-ish, kept)
- All skills, categories, topics, domains, templates, questions, competency levels
- All other users' registries, assessments, notifications

## Verification

After the delete, re-run the same COUNT query for these 5 user IDs — every counter must be 0.
