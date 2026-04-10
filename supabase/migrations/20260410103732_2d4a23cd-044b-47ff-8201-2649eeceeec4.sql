
-- Step 1: Update questions.competency_level from name to UUID string
UPDATE public.questions SET competency_level = cl.id::text
FROM public.competency_levels cl
WHERE questions.competency_level = cl.name;

-- Step 2: Update assessment_questions.target_level from name to UUID string
UPDATE public.assessment_questions SET target_level = cl.id::text
FROM public.competency_levels cl
WHERE assessment_questions.target_level = cl.name;

-- Step 3: Alter questions.competency_level to uuid type
ALTER TABLE public.questions
  ALTER COLUMN competency_level TYPE uuid USING competency_level::uuid;

-- Step 4: Alter assessment_questions.target_level to uuid type
ALTER TABLE public.assessment_questions
  ALTER COLUMN target_level TYPE uuid USING target_level::uuid;

-- Step 5: Add foreign key constraints
ALTER TABLE public.questions
  ADD CONSTRAINT questions_competency_level_fkey
  FOREIGN KEY (competency_level) REFERENCES public.competency_levels(id);

ALTER TABLE public.assessment_questions
  ADD CONSTRAINT assessment_questions_target_level_fkey
  FOREIGN KEY (target_level) REFERENCES public.competency_levels(id);
