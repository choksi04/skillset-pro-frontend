-- registry_reviews: one row per skill_registries.id
CREATE TABLE public.registry_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  registry_id uuid NOT NULL UNIQUE,
  reviewer_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  overall_comment text DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  modified_at timestamptz,
  modified_by text,
  deleted_on timestamptz,
  deleted_by text
);

ALTER TABLE public.registry_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for registry_reviews"
  ON public.registry_reviews FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_registry_reviews_registry_id ON public.registry_reviews(registry_id);
CREATE INDEX idx_registry_reviews_reviewer_id ON public.registry_reviews(reviewer_id);

-- registry_review_items: one row per (review, skill)
CREATE TABLE public.registry_review_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL,
  skill_id text NOT NULL,
  manager_score integer,
  manager_comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz,
  UNIQUE (review_id, skill_id)
);

ALTER TABLE public.registry_review_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for registry_review_items"
  ON public.registry_review_items FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_registry_review_items_review_id ON public.registry_review_items(review_id);