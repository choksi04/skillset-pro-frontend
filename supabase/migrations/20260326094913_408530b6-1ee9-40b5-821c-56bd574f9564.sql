
-- 1. Create review_cycles table
CREATE TABLE public.review_cycles (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  grace_period_days integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'draft',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  modified_at timestamptz,
  modified_by text
);

-- RLS
ALTER TABLE public.review_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.review_cycles FOR ALL TO public USING (true) WITH CHECK (true);

-- Validation trigger: only one active cycle per tenant
CREATE OR REPLACE FUNCTION public.check_single_active_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    IF EXISTS (
      SELECT 1 FROM public.review_cycles
      WHERE tenant_id = NEW.tenant_id
        AND status = 'active'
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Only one active cycle allowed per tenant';
    END IF;
  END IF;
  IF NEW.start_date >= NEW.end_date THEN
    RAISE EXCEPTION 'start_date must be before end_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_single_active_cycle
BEFORE INSERT OR UPDATE ON public.review_cycles
FOR EACH ROW EXECUTE FUNCTION public.check_single_active_cycle();

-- 2. Add cycle_id to skill_registry_submissions
ALTER TABLE public.skill_registry_submissions ADD COLUMN cycle_id text;

-- 3. Add action_link to notifications
ALTER TABLE public.notifications ADD COLUMN action_link text;
