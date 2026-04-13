
-- Create skill_registries table (one row per version)
CREATE TABLE public.skill_registries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  employee_id text NOT NULL,
  domain_id text NOT NULL,
  version_number integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  modified_by text,
  modified_at timestamptz,
  deleted_by text,
  deleted_on timestamptz,
  CONSTRAINT skill_registries_employee_version_unique UNIQUE (employee_id, version_number)
);

-- Create skill_registry_items table (ratings per version)
CREATE TABLE public.skill_registry_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registry_id uuid NOT NULL REFERENCES public.skill_registries(id) ON DELETE CASCADE,
  skill_id text NOT NULL,
  self_score integer NOT NULL,
  comment text,
  CONSTRAINT skill_registry_items_score_range CHECK (self_score >= 1 AND self_score <= 5)
);

-- Enable RLS
ALTER TABLE public.skill_registries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_registry_items ENABLE ROW LEVEL SECURITY;

-- RLS policies (matching existing open pattern)
CREATE POLICY "Allow all for skill_registries"
  ON public.skill_registries FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for skill_registry_items"
  ON public.skill_registry_items FOR ALL
  USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_skill_registries_employee_version
  ON public.skill_registries (employee_id, version_number DESC);

-- Trigger: enforce max ONE draft per employee
CREATE OR REPLACE FUNCTION public.enforce_single_draft_registry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'draft' THEN
    IF EXISTS (
      SELECT 1 FROM public.skill_registries
      WHERE employee_id = NEW.employee_id
        AND status = 'draft'
        AND id != NEW.id
        AND deleted_on IS NULL
    ) THEN
      RAISE EXCEPTION 'Only one draft registry allowed per employee';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_draft_registry_trigger
  BEFORE INSERT OR UPDATE ON public.skill_registries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_draft_registry();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.skill_registries;
