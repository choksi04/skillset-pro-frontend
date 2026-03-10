
-- Assessments table
CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'reviewed')),
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessment questions junction
CREATE TABLE public.assessment_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  target_level TEXT NOT NULL
);

-- Assessment attempts
CREATE TABLE public.assessment_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  tenant_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'evaluated', 'reviewed')),
  total_ai_score INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ
);

-- Attempt answers
CREATE TABLE public.attempt_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.assessment_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT NOT NULL,
  answer_text TEXT NOT NULL DEFAULT '',
  time_spent_seconds INTEGER NOT NULL DEFAULT 0
);

-- AI evaluations
CREATE TABLE public.ai_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.assessment_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  feedback TEXT NOT NULL DEFAULT '',
  dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0
);

-- Skill scores per attempt
CREATE TABLE public.attempt_skill_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.assessment_attempts(id) ON DELETE CASCADE NOT NULL,
  skill_id TEXT NOT NULL,
  avg_score INTEGER NOT NULL DEFAULT 0,
  calculated_level INTEGER NOT NULL DEFAULT 1,
  question_count INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS on all tables (permissive for now since auth is mock)
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_skill_scores ENABLE ROW LEVEL SECURITY;

-- Permissive policies (will be tightened when real auth is added)
CREATE POLICY "Allow all for assessments" ON public.assessments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for assessment_questions" ON public.assessment_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for assessment_attempts" ON public.assessment_attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for attempt_answers" ON public.attempt_answers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for ai_evaluations" ON public.ai_evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for attempt_skill_scores" ON public.attempt_skill_scores FOR ALL USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX idx_assessments_employee ON public.assessments(employee_id);
CREATE INDEX idx_assessments_tenant ON public.assessments(tenant_id);
CREATE INDEX idx_assessment_questions_assessment ON public.assessment_questions(assessment_id);
CREATE INDEX idx_attempts_assessment ON public.assessment_attempts(assessment_id);
CREATE INDEX idx_attempts_employee ON public.assessment_attempts(employee_id);
CREATE INDEX idx_answers_attempt ON public.attempt_answers(attempt_id);
CREATE INDEX idx_evaluations_attempt ON public.ai_evaluations(attempt_id);
CREATE INDEX idx_skill_scores_attempt ON public.attempt_skill_scores(attempt_id);
