
-- Add tenant_id and status to skill_categories
ALTER TABLE public.skill_categories 
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'tenant-001',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS modified_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS modified_by text,
  ADD COLUMN IF NOT EXISTS deleted_on timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text;

-- Add tags column to skills (text array)
ALTER TABLE public.skills 
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
