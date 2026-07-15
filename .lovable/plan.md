## Root cause

The .NET domain is showing `Skills (0)`, but the save flow is hitting duplicate-key errors because old soft-deleted rows still exist in `domain_skill_mappings` for the same `.NET domain + skill` pairs.

Current database constraint is:

```text
UNIQUE (domain_id, skill_id)
```

That constraint still blocks re-adding a skill even when the previous mapping was soft-deleted.

## Plan

1. **Verify .NET domain mapping rows**
   - Check `domain_skill_mappings` for domain `dom-1779952772407`.
   - Separate:
     - active mappings: `deleted_on IS NULL`
     - stale soft-deleted mappings: `deleted_on IS NOT NULL`

2. **Hard-delete only stale mapping rows for .NET domain**
   - Delete rows from `domain_skill_mappings` for the .NET domain where `deleted_on IS NOT NULL`.
   - Do **not** hard-delete actual skills from the `skills` master table.
   - Do **not** delete active mappings unless explicitly confirmed, because that would remove currently mapped skills from the domain.

3. **Prevent the issue from happening again**
   - Replace the current full unique constraint on `(domain_id, skill_id)` with a partial unique index:

```sql
UNIQUE (domain_id, skill_id) WHERE deleted_on IS NULL
```

   - This allows historical soft-deleted mappings while still preventing duplicate active mappings.

4. **Fix false success in the UI**
   - Update `domainStore.addMapping` / `removeMapping` so backend errors are thrown instead of silently logged.
   - Update `DomainSkillManager` so it only shows success when every selected mapping is actually saved.
   - Show a clear error if any mapping fails.

5. **Refresh after save**
   - Force-refresh domain mappings after saving so Domain Detail > Skills immediately shows the saved skills.

## Safety note

I will treat “hard-delete the skills already mapped with .NET domain” as hard-delete stale rows from `domain_skill_mappings`, not deleting records from the master `skills` table, because deleting master skills would break questions, registry history, assessments, and reports.