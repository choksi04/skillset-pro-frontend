
-- Add topic_id to questions table
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS topic_id text DEFAULT NULL;

-- Create question_settings table for editable competency levels
CREATE TABLE IF NOT EXISTS public.question_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  level integer NOT NULL,
  name text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  score_range_min integer NOT NULL DEFAULT 0,
  score_range_max integer NOT NULL DEFAULT 100,
  min_questions integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  modified_at timestamp with time zone,
  created_by text,
  modified_by text,
  UNIQUE(tenant_id, level)
);

ALTER TABLE public.question_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for question_settings" ON public.question_settings FOR ALL TO public USING (true) WITH CHECK (true);

-- Seed default competency levels
INSERT INTO public.question_settings (tenant_id, level, name, label, description, score_range_min, score_range_max, min_questions) VALUES
  ('tenant-001', 1, 'Beginner', 'L1 – Basic Awareness', 'Aware of concepts but needs guidance for most tasks.', 0, 39, 3),
  ('tenant-001', 2, 'Intermediate', 'L2 – Working Knowledge', 'Can perform basic tasks with some supervision.', 40, 59, 3),
  ('tenant-001', 3, 'Advanced', 'L3 – Independent', 'Works independently on standard tasks and problems.', 60, 74, 3),
  ('tenant-001', 4, 'Expert', 'L4 – Advanced', 'Handles complex scenarios and mentors others.', 75, 89, 3),
  ('tenant-001', 5, 'Master', 'L5 – Expert', 'Deep expertise, drives best practices and innovation.', 90, 100, 3)
ON CONFLICT (tenant_id, level) DO NOTHING;
