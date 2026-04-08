
CREATE TABLE public.assessment_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  config_type text NOT NULL DEFAULT 'global',
  reference_id text,
  question_type text NOT NULL,
  min_questions integer NOT NULL DEFAULT 2,
  max_questions integer NOT NULL DEFAULT 6,
  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz,
  created_by text,
  modified_by text,
  UNIQUE(tenant_id, config_type, reference_id, question_type)
);

ALTER TABLE public.assessment_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for assessment_config"
ON public.assessment_config
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Seed default global config
INSERT INTO public.assessment_config (tenant_id, config_type, question_type, min_questions, max_questions)
VALUES
  ('tenant-001', 'global', 'mcq', 2, 6),
  ('tenant-001', 'global', 'scenario', 2, 6),
  ('tenant-001', 'global', 'coding', 2, 6);
