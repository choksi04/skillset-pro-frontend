CREATE OR REPLACE FUNCTION public.block_archived_employee_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp text; rec record;
BEGIN
  rec := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_TABLE_NAME = 'registry_reviews' THEN
    SELECT employee_id::text INTO emp FROM skill_registries WHERE id::text = rec.registry_id::text;
  ELSIF TG_TABLE_NAME = 'registry_review_items' THEN
    SELECT sr.employee_id::text INTO emp FROM registry_reviews rr JOIN skill_registries sr ON sr.id::text = rr.registry_id::text WHERE rr.id::text = rec.review_id::text;
  ELSIF TG_TABLE_NAME = 'assessment_questions' THEN
    SELECT employee_id::text INTO emp FROM assessments WHERE id::text = rec.assessment_id::text;
  ELSIF TG_TABLE_NAME = 'assessments' THEN
    emp := rec.employee_id::text;
  END IF;
  IF emp IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE id::text = emp AND status IS NOT NULL AND status <> 'active') THEN
    RAISE EXCEPTION 'This employee is archived (inactive); their records are read-only.' USING ERRCODE = 'P0001';
  END IF;
  RETURN rec;
END $$;