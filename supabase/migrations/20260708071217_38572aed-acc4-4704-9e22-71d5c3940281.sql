
CREATE INDEX IF NOT EXISTS idx_questions_skill_type_status_active
  ON public.questions (skill_id, question_type, status)
  WHERE deleted_on IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_created_at_active
  ON public.questions (created_at)
  WHERE deleted_on IS NULL;

CREATE INDEX IF NOT EXISTS idx_skills_created_at_active
  ON public.skills (created_at)
  WHERE deleted_on IS NULL;

CREATE INDEX IF NOT EXISTS idx_domain_skill_mappings_domain_active
  ON public.domain_skill_mappings (domain_id)
  WHERE deleted_on IS NULL;

CREATE INDEX IF NOT EXISTS idx_domain_skill_mappings_skill_active
  ON public.domain_skill_mappings (skill_id)
  WHERE deleted_on IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_evaluations_attempt
  ON public.ai_evaluations (attempt_id);

CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt
  ON public.attempt_answers (attempt_id);

CREATE INDEX IF NOT EXISTS idx_attempt_skill_scores_attempt
  ON public.attempt_skill_scores (attempt_id);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment
  ON public.assessment_questions (assessment_id);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_started_at
  ON public.assessment_attempts (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_employee_assessment
  ON public.assessment_attempts (employee_id, assessment_id);

CREATE INDEX IF NOT EXISTS idx_notifications_target_user_created
  ON public.notifications (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_target_role_created
  ON public.notifications (target_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_skill_entries_review
  ON public.review_skill_entries (review_id);

CREATE INDEX IF NOT EXISTS idx_skill_registry_items_registry
  ON public.skill_registry_items (registry_id);

ANALYZE public.questions;
ANALYZE public.skills;
ANALYZE public.domain_skill_mappings;
ANALYZE public.ai_evaluations;
ANALYZE public.attempt_answers;
ANALYZE public.attempt_skill_scores;
ANALYZE public.assessment_questions;
ANALYZE public.assessment_attempts;
ANALYZE public.notifications;
ANALYZE public.review_skill_entries;
ANALYZE public.skill_registry_items;
