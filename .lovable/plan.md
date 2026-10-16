# Domain module: skill count and membership

## Findings (confirmed from live data and code)
- **Domain:** DevOps (`dom-1776230313025`). Linked skills (6, all active): CI/CD, Cloud, Monitoring, Server Management, Containerization and Orchestration, IaC.
- **New skills:** between 11:33 and 12:32 UTC today Sarvesh created **17 skills** in the DevOps category (`cat-1776230448231`), from Scripting & Automation (`skill-1792150426920`) to AI Security & Governance (`skill-1792153965323`). All active, **none linked to any domain**.
- **Why:** in the existing workflow, creating a skill in the Skill Library does not link it to a domain. Skills are reusable, and the link is made separately in Domains > (domain) > Skills. A skill being in the "DevOps" category does not put it in the DevOps domain. So **"6 skills" is accurate today**. It is not a cache or paging bug.
- **Second, real mismatch:** the Domains list counts every link, including links to skills that are disabled or deleted. Across all domains, **28 of 432 links** point to disabled or deleted skills. So in some domains the card count is higher than the skill list and the registry totals, which already use active skills only. No duplicate links exist.
- No paging problem: all 432 links load in one request, under the 1000-row limit.

## Count definition
Domain skill count = distinct skills linked to the domain whose skill is **active and not deleted**. This is the same rule the Team Registry and registry totals already use.

## Changes
1. **Domains list count:** use the definition above, so the card matches the detail list.
2. **Domain detail skill list:** apply the same rule. Disabled skills still linked are shown in a separate, muted "Disabled (not counted)" group, so nothing silently disappears.
3. **After creating a skill in the Skill Library:** the success message says "Not linked to any domain yet — add it from Domains > Skills." Creation itself is unchanged.
4. **Refresh:** after linking or unlinking skills, and after creating, disabling or deleting a skill, the domain list reloads its links, so counts update without a hard refresh.
5. **Registries:** the frozen approved versions stay as they are.

## Data repair — needs your confirmation
I will **not** link the 17 skills automatically: being in the DevOps category does not prove they belong in the DevOps domain. Once you confirm (or Sarvesh links them through Domains > DevOps > Skills, the existing workflow), DevOps goes from 6 to 23 skills. Linking adds the skills to draft and new registries only, never to approved versions.

## Technical details
- New `src/lib/domainSkillCount.ts`, with `eligibleDomainSkillIds(domainId, mappings, skills)` returning a deduplicated set; the matching rule is unit-tested.
- `DomainsPage.tsx` `getSkillCount`, and `DomainDetailPage.tsx` `currentMappings`, use the helper. `DomainSkillManager.tsx` is unchanged.
- `skillStore.ts`: after create, status change or delete, call `useDomainStore.getState().fetchDomains()` (the existing reload). The toast text goes in `SkillFormDialog.tsx`.
- No database or permission changes. Update the User Guide line for Domains.

## Verification
- Browser as Admin, and as Sarvesh: the DevOps card and detail list both show 6. Link a test skill and the count becomes 7 without reloading; unlink it to restore 6.
- Check a domain with a disabled linked skill: the card and list now agree.
