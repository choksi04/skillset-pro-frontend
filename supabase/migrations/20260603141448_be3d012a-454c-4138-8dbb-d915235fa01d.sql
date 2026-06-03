CREATE OR REPLACE FUNCTION public.enforce_single_draft_registry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'draft' THEN
    IF EXISTS (
      SELECT 1 FROM public.skill_registries
      WHERE employee_id = NEW.employee_id
        AND status = 'draft'
        AND id != NEW.id
        AND deleted_on IS NULL
    ) THEN
      RAISE EXCEPTION 'Only one draft registry allowed per employee';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;