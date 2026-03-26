
-- Add new columns to assessments table
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS cycle_id text;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS is_reassessment boolean NOT NULL DEFAULT false;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS parent_assessment_id uuid;

-- Add new columns to assessment_attempts table for flexible timer
ALTER TABLE public.assessment_attempts ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE public.assessment_attempts ADD COLUMN IF NOT EXISTS remaining_seconds integer;

-- Create reassessment_requests table
CREATE TABLE IF NOT EXISTS public.reassessment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  review_id text NOT NULL,
  tenant_id text NOT NULL,
  employee_id text NOT NULL,
  skill_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

ALTER TABLE public.reassessment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for reassessment_requests" ON public.reassessment_requests FOR ALL TO public USING (true) WITH CHECK (true);
