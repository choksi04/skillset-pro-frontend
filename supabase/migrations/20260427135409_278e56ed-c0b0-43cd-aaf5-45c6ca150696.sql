
CREATE TABLE public.assessment_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  template_id uuid NOT NULL,
  employee_id text NOT NULL,
  domain_id text,
  status text NOT NULL DEFAULT 'new',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 1,
  assessment_id uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz,
  modified_by text,
  deleted_on timestamptz,
  deleted_by text
);

ALTER TABLE public.assessment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for assessment_assignments"
ON public.assessment_assignments
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX idx_assignments_employee_template_active
  ON public.assessment_assignments (employee_id, template_id)
  WHERE deleted_on IS NULL;

CREATE INDEX idx_assignments_template
  ON public.assessment_assignments (template_id)
  WHERE deleted_on IS NULL;

CREATE INDEX idx_assignments_assessment
  ON public.assessment_assignments (assessment_id)
  WHERE deleted_on IS NULL;
