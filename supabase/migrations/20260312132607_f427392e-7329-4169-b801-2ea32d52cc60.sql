
CREATE TABLE public.users (
  id text PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'employee',
  domain_id text,
  department text DEFAULT '',
  designation text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  avatar_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  modified_by text,
  modified_at timestamptz,
  deleted_on timestamptz,
  deleted_by text
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for users" ON public.users FOR ALL USING (true) WITH CHECK (true);
