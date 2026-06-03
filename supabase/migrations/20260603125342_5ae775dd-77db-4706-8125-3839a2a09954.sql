ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS category_id text;

UPDATE public.skills s
SET category_id = c.id
FROM public.skill_categories c
WHERE c.name = s.skill_category
  AND c.deleted_on IS NULL
  AND s.category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_skills_category_id ON public.skills(category_id);