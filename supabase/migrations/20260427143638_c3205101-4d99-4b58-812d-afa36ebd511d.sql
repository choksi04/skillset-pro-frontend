ALTER TABLE public.review_skill_entries
  ADD COLUMN IF NOT EXISTS verified_level integer;

UPDATE public.review_skill_entries
SET verified_level = COALESCE(manager_adjusted_level, ai_calculated_level)
WHERE verified_level IS NULL
  AND COALESCE(manager_action, '') <> 'reassess';