ALTER TABLE public.review_skill_entries
  ALTER COLUMN self_rating DROP NOT NULL;

ALTER TABLE public.official_skill_entries
  ALTER COLUMN self_rating DROP NOT NULL;