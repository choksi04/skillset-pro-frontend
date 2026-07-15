ALTER TABLE public.domain_skill_mappings
DROP CONSTRAINT IF EXISTS domain_skill_mappings_domain_id_skill_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS domain_skill_mappings_active_domain_skill_uidx
ON public.domain_skill_mappings (domain_id, skill_id)
WHERE deleted_on IS NULL;