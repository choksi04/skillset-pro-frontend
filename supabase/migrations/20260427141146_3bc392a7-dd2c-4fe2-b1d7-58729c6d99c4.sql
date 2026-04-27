-- Adaptive Assessment Engine schema
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS is_adaptive boolean NOT NULL DEFAULT false;

ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS adaptive_state jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_assessments_is_adaptive
  ON public.assessments (is_adaptive)
  WHERE is_adaptive = true;