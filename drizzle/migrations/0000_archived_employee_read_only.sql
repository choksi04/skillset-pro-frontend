CREATE OR REPLACE FUNCTION public.block_archived_employee_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp uuid; rec record;
BEGIN
  rec := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_TABLE_NAME = 'registry_reviews' THEN
    SELECT employee_id INTO emp FROM skill_registries WHERE id = rec.registry_id;
  ELSIF TG_TABLE_NAME = 'registry_review_items' THEN
    SELECT sr.employee_id INTO emp FROM registry_reviews rr JOIN skill_registries sr ON sr.id = rr.registry_id WHERE rr.id = rec.review_id;
  ELSIF TG_TABLE_NAME = 'assessment_questions' THEN
    SELECT employee_id INTO emp FROM assessments WHERE id = rec.assessment_id;
  ELSIF TG_TABLE_NAME = 'assessments' THEN
    emp := rec.employee_id;
  END IF;
  IF emp IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE id = emp AND status IS NOT NULL AND status <> 'active') THEN
    RAISE EXCEPTION 'This employee is archived (inactive); their records are read-only.' USING ERRCODE = 'P0001';
  END IF;
  RETURN rec;
END $$;

CREATE TRIGGER trg_archived_ro_registry_reviews BEFORE INSERT OR UPDATE OR DELETE ON public.registry_reviews FOR EACH ROW EXECUTE FUNCTION public.block_archived_employee_writes();
CREATE TRIGGER trg_archived_ro_registry_review_items BEFORE INSERT OR UPDATE OR DELETE ON public.registry_review_items FOR EACH ROW EXECUTE FUNCTION public.block_archived_employee_writes();
CREATE TRIGGER trg_archived_ro_assessment_questions BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_questions FOR EACH ROW EXECUTE FUNCTION public.block_archived_employee_writes();
CREATE TRIGGER trg_archived_ro_assessments BEFORE UPDATE OR DELETE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.block_archived_employee_writes();