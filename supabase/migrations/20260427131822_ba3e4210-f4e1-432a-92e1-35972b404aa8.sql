-- ============================================================
-- PART 1: Remove Review Cycle feature
-- ============================================================

-- Hard-delete all cycle-linked assessments and their dependents
DELETE FROM public.attempt_answers
WHERE attempt_id IN (
  SELECT id FROM public.assessment_attempts WHERE assessment_id IN (
    SELECT id FROM public.assessments WHERE cycle_id IS NOT NULL
  )
);

DELETE FROM public.ai_evaluations
WHERE attempt_id IN (
  SELECT id FROM public.assessment_attempts WHERE assessment_id IN (
    SELECT id FROM public.assessments WHERE cycle_id IS NOT NULL
  )
);

DELETE FROM public.attempt_skill_scores
WHERE attempt_id IN (
  SELECT id FROM public.assessment_attempts WHERE assessment_id IN (
    SELECT id FROM public.assessments WHERE cycle_id IS NOT NULL
  )
);

DELETE FROM public.assessment_attempts
WHERE assessment_id IN (
  SELECT id FROM public.assessments WHERE cycle_id IS NOT NULL
);

DELETE FROM public.assessment_questions
WHERE assessment_id IN (
  SELECT id FROM public.assessments WHERE cycle_id IS NOT NULL
);

DELETE FROM public.manager_reviews
WHERE assessment_id IN (
  SELECT id FROM public.assessments WHERE cycle_id IS NOT NULL
);

DELETE FROM public.reassessment_requests
WHERE assessment_id IN (
  SELECT id FROM public.assessments WHERE cycle_id IS NOT NULL
);

DELETE FROM public.assessments WHERE cycle_id IS NOT NULL;

-- Drop cycle column
ALTER TABLE public.assessments DROP COLUMN IF EXISTS cycle_id;

-- Drop the validation function (no trigger exists per current schema dump)
DROP FUNCTION IF EXISTS public.check_single_active_cycle() CASCADE;

-- Drop cycle tables
DROP TABLE IF EXISTS public.cycle_domain_selections;
DROP TABLE IF EXISTS public.review_cycles;

-- ============================================================
-- PART 2: Assessment Templates
-- ============================================================

CREATE TABLE public.assessment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  name text NOT NULL,
  description text DEFAULT ''::text,
  type text NOT NULL CHECK (type IN ('adaptive', 'fixed')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
  duration_minutes integer NOT NULL DEFAULT 45,
  max_attempts integer NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  reattempt_enabled boolean NOT NULL DEFAULT false,

  -- Adaptive config
  domain_id text,
  skill_selection_mode text CHECK (skill_selection_mode IN ('top_n', 'custom')),
  skills_per_assessment integer DEFAULT 5,
  questions_per_skill integer DEFAULT 4,
  question_types jsonb DEFAULT '["mcq"]'::jsonb,

  -- Fixed config
  shuffle_questions boolean DEFAULT false,
  shuffle_options boolean DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz,
  created_by text,
  modified_by text,
  deleted_on timestamptz,
  deleted_by text
);

CREATE TABLE public.assessment_template_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.assessment_templates(id) ON DELETE CASCADE,
  skill_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assessment_template_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.assessment_templates(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_template_skills_template ON public.assessment_template_skills(template_id);
CREATE INDEX idx_template_questions_template ON public.assessment_template_questions(template_id);

-- Link assessments to templates
ALTER TABLE public.assessments ADD COLUMN template_id uuid;

-- RLS (allow-all to match existing project policy for MVP)
ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_template_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_template_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for assessment_templates"
  ON public.assessment_templates FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for assessment_template_skills"
  ON public.assessment_template_skills FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for assessment_template_questions"
  ON public.assessment_template_questions FOR ALL
  USING (true) WITH CHECK (true);