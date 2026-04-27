ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS evaluation_error TEXT NULL;