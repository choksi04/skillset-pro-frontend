
CREATE TABLE public.cycle_domain_selections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id text NOT NULL,
  domain_id text NOT NULL,
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text,
  UNIQUE(cycle_id, domain_id)
);

ALTER TABLE public.cycle_domain_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for cycle_domain_selections"
  ON public.cycle_domain_selections
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
