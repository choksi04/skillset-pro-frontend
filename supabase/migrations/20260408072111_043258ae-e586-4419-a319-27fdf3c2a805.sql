
-- Rename question_settings to competency_levels
ALTER TABLE public.question_settings RENAME TO competency_levels;

-- Rename the RLS policy
ALTER POLICY "Allow all for question_settings" ON public.competency_levels RENAME TO "Allow all for competency_levels";
