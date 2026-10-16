# DevOps skill count: make Sarvesh Domain Lead so he can link his skills

## Confirmed root cause
- **DevOps domain:** `dom-1776230313025`. It is the only domain with that name. Active.
- **Saved links:** exactly 6 active links: CI/CD, Cloud, Monitoring, Server Management, Containerization and Orchestration, IaC. All were created in April.
- **The 17 skills Sarvesh created today** are in the "DevOps" *category* (`cat-1776230448231`). They are active, but **none has ever been linked to any domain**, and no link attempt was saved and then removed. The count of 6 is therefore exactly what is stored. It is not a cache, paging, stored-count, policy or hardcoded-value problem. Both pages read the same link list (`domain_skill_mappings`), so their counts agree.
- **Why the skills were never linked:**
  - Creating a skill in the Skill Library does not link it to a domain.
  - Linking ("Manage Skills" on the domain page) is allowed only for Admins or that domain's Domain Lead.
  - DevOps has **no Domain Lead**, and Sarvesh is a Manager there, not its lead, so the Manage Skills button never appeared for him.
- **Why earlier fixes missed it:** they fixed counting rules and refresh. There were no links to count.

## Account change (confirmed by you)
1. Set Sarvesh (`ec77eb29-dfd2-4590-a4a9-5b8ca86a0f03`) as the **DevOps Domain Lead**. This uses the existing domain-lead field, the same thing as assigning a lead on the domain page. His role stays Manager. No other domain changes.
2. He then links the skills he wants via Domains > DevOps > Skills > Manage Skills. I will not link any skills myself.

## Small reusable code fix
- On the domain detail Skills tab, when the viewer cannot link skills, show the line "Only an Admin or this domain's Domain Lead can link skills." That way the next Manager isn't left guessing. Permissions are unchanged.

## Verification
- Before and after: DevOps shows 6, both stored and on screen.
- In the browser as Sarvesh after the change: the Manage Skills button is visible on DevOps. I'll link one test skill, check the count goes from 6 to 7 on the list and detail pages for both Sarvesh and Admin, then unlink it so it goes back to 6. I leave the real linking to him.
- Reload and a fresh login keep the result. Other domains and approved registry versions are untouched (linking affects draft and new registries only).

## Technical details
- Data: `update domains set domain_lead_id = '<sarvesh id>', modified_at = now(), modified_by = 'admin' where id = 'dom-1776230313025' and domain_lead_id is null`.
- `DomainDetailPage.tsx`: one muted text line when `!canManage` in the Skills tab header.
