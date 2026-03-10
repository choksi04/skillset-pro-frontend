
-- =============================================
-- 1. New tables for all remaining stores
-- =============================================

CREATE TABLE IF NOT EXISTS domains (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  modified_by text,
  modified_at timestamptz,
  deleted_by text,
  deleted_on timestamptz
);

CREATE TABLE IF NOT EXISTS skill_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS skills (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  skill_name text NOT NULL,
  skill_description text DEFAULT '',
  skill_category text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  modified_by text,
  modified_at timestamptz,
  deleted_by text,
  deleted_on timestamptz
);

CREATE TABLE IF NOT EXISTS questions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  skill_id text NOT NULL,
  competency_level text NOT NULL,
  question_type text NOT NULL,
  question_text text NOT NULL,
  evaluation_guidelines text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  ai_generated boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  modified_by text,
  modified_at timestamptz,
  deleted_by text,
  deleted_on timestamptz
);

CREATE TABLE IF NOT EXISTS domain_skill_mappings (
  id text PRIMARY KEY,
  domain_id text NOT NULL,
  skill_id text NOT NULL,
  tenant_id text NOT NULL,
  skill_weight numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  modified_by text,
  modified_at timestamptz,
  deleted_by text,
  deleted_on timestamptz,
  UNIQUE(domain_id, skill_id)
);

CREATE TABLE IF NOT EXISTS skill_registry_submissions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  employee_id text NOT NULL,
  domain_id text NOT NULL,
  cycle text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  modified_by text,
  modified_at timestamptz,
  deleted_by text,
  deleted_on timestamptz,
  UNIQUE(employee_id, cycle)
);

CREATE TABLE IF NOT EXISTS skill_self_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id text NOT NULL REFERENCES skill_registry_submissions(id) ON DELETE CASCADE,
  skill_id text NOT NULL,
  rating integer NOT NULL,
  UNIQUE(submission_id, skill_id)
);

CREATE TABLE IF NOT EXISTS employee_domain_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  domain_id text NOT NULL,
  tenant_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  UNIQUE(employee_id, domain_id)
);

CREATE TABLE IF NOT EXISTS manager_reviews (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  assessment_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  employee_id text NOT NULL,
  employee_name text NOT NULL,
  domain_id text NOT NULL,
  reviewer_id text NOT NULL,
  overall_comment text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by text,
  modified_by text,
  modified_at timestamptz,
  deleted_by text,
  deleted_on timestamptz,
  UNIQUE(assessment_id)
);

CREATE TABLE IF NOT EXISTS review_skill_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id text NOT NULL REFERENCES manager_reviews(id) ON DELETE CASCADE,
  skill_id text NOT NULL,
  self_rating integer NOT NULL,
  ai_calculated_level integer NOT NULL,
  ai_score integer NOT NULL DEFAULT 0,
  manager_action text,
  manager_adjusted_level integer,
  manager_comment text DEFAULT '',
  UNIQUE(review_id, skill_id)
);

CREATE TABLE IF NOT EXISTS official_skill_entries (
  id text PRIMARY KEY,
  employee_id text NOT NULL,
  tenant_id text NOT NULL,
  skill_id text NOT NULL,
  final_level integer NOT NULL,
  assessment_reference text NOT NULL,
  manager_comments text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  cycle text NOT NULL,
  self_rating integer NOT NULL,
  ai_level integer NOT NULL,
  review_id text NOT NULL,
  created_by text,
  modified_by text,
  modified_at timestamptz,
  deleted_by text,
  deleted_on timestamptz
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  target_role text NOT NULL,
  target_user_id text,
  message text NOT NULL,
  type text NOT NULL,
  reference_id text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- 2. Add audit columns to existing tables
-- =============================================

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS modified_by text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS modified_at timestamptz;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS deleted_by text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS deleted_on timestamptz;

ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS modified_by text;
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS modified_at timestamptz;
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS deleted_by text;
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS deleted_on timestamptz;

ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS modified_by text;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS modified_at timestamptz;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS deleted_by text;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS deleted_on timestamptz;

ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS modified_by text;
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS modified_at timestamptz;
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS deleted_by text;
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS deleted_on timestamptz;

ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS modified_by text;
ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS modified_at timestamptz;
ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS deleted_by text;
ALTER TABLE ai_evaluations ADD COLUMN IF NOT EXISTS deleted_on timestamptz;

ALTER TABLE attempt_skill_scores ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE attempt_skill_scores ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE attempt_skill_scores ADD COLUMN IF NOT EXISTS modified_by text;
ALTER TABLE attempt_skill_scores ADD COLUMN IF NOT EXISTS modified_at timestamptz;
ALTER TABLE attempt_skill_scores ADD COLUMN IF NOT EXISTS deleted_by text;
ALTER TABLE attempt_skill_scores ADD COLUMN IF NOT EXISTS deleted_on timestamptz;

-- =============================================
-- 3. Clean up existing duplicate data
-- =============================================

DELETE FROM ai_evaluations a
USING ai_evaluations b
WHERE a.id > b.id
  AND a.attempt_id = b.attempt_id
  AND a.question_id = b.question_id;

DELETE FROM attempt_skill_scores a
USING attempt_skill_scores b
WHERE a.id > b.id
  AND a.attempt_id = b.attempt_id
  AND a.skill_id = b.skill_id;

-- =============================================
-- 4. Unique constraints to prevent future duplicates
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_evaluations_unique ON ai_evaluations(attempt_id, question_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attempt_skill_scores_unique ON attempt_skill_scores(attempt_id, skill_id);

-- =============================================
-- 5. Enable RLS on all new tables
-- =============================================

ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_skill_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_registry_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_self_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_domain_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_skill_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_skill_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Permissive policies (to be tightened with real auth)
CREATE POLICY "Allow all" ON domains FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON skill_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON skills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON domain_skill_mappings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON skill_registry_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON skill_self_ratings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON employee_domain_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON manager_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON review_skill_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON official_skill_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON notifications FOR ALL USING (true) WITH CHECK (true);
