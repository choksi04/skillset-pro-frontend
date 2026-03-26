CREATE TABLE public.skill_topics (
  id text NOT NULL PRIMARY KEY,
  skill_id text NOT NULL,
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  name text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz,
  deleted_on timestamptz,
  created_by text,
  modified_by text,
  deleted_by text
);

ALTER TABLE public.skill_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON public.skill_topics FOR ALL TO public USING (true) WITH CHECK (true);