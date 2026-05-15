# Role Capabilities — Current vs Proposed

Goal of this step: agree on the capability matrix per feature for **Admin**, **Manager (incl. Domain Lead)**, and **Employee**, before touching any code. No implementation in this plan — only scope confirmation.

Conventions:

- ✅ full access · 👁 view only · ❌ no access · 🟡 scoped (own domain / own data)
- "Manager" = user with `role = manager`. "Domain Lead" = manager additionally set as `domain_lead_id` on a domain.

---

## 1. Skill Library (Categories / Skills / Topics)


| Capability                                    | Admin (now → proposed) | Manager (now → proposed) | Employee |
| --------------------------------------------- | ---------------------- | ------------------------ | -------- |
| View library                                  | ✅ → ✅                  | 👁 → 👁 *(list)*         | ❌        |
| Create / edit / disable / delete **Category** | ✅ → ✅                  | ❌ → **✅**                | ❌        |
| Create / edit / disable / delete **Skill**    | ✅ → ✅                  | ❌ → **✅**                | ❌        |
| Add / edit / remove **Topics**                | ✅ → ✅                  | ❌ → **✅**                | ❌        |


Note: Open scope (any category / any skill), **not** restricted to manager's domain — per your call to keep it simple now.

---

## 2. Domains


| Capability                     | Admin  | Manager — not a Domain Lead | Manager — Domain Lead of domain X | Employee |
| ------------------------------ | ------ | --------------------------- | --------------------------------- | -------- |
| View domain list               | ✅ → ✅  | 👁 → 👁                     | 👁 → 👁                           | ❌        |
| Create domain                  | ✅ → ✅  | ❌ → ❌                       | ❌ → ❌                             | ❌        |
| Edit domain (name/desc/status) | ✅ → ✅  | ❌ → ❌                       | ❌ → **✅ (only domain X)**         | ❌        |
| Delete domain                  | ✅ → ✅  | ❌ → ❌                       | ❌ → ❌                             | ❌        |
| Assign / change Domain Lead    | ✅ → ✅  | ❌ → ❌                       | ❌ → **✅ (only domain X)**         | ❌        |
| View users in domain           | 👁 → ✅ | 👁 → 👁                     | 👁 → **✅ (domain X)**             | ❌        |
| Add / remove users in domain   | ✅ → ✅  | ❌ → ❌                       | ❌ → **✅ (domain X)**              | ❌        |
| Map / unmap skills to domain   | ✅ → ✅  | ❌ → ❌                       | ❌ → **✅ (domain X)**              | ❌        |


Open question — see Q1 below: should *any* manager be able to manage domains where they're **assigned** (employee_domain_assignments) but not Lead?

---

## 3. Question Bank


| Capability                                     | Admin | Manager                    | Employee |
| ---------------------------------------------- | ----- | -------------------------- | -------- |
| View questions                                 | ✅ → ✅ | ✅ → ✅                      | ❌        |
| Create / edit / delete questions (manual + AI) | ✅ → ✅ | ✅ → ✅ *(already in place)* | ❌        |


No change. Already open to manager.

---

## 4. Assessment Templates


| Capability                                    | Admin | Manager                    | Employee |
| --------------------------------------------- | ----- | -------------------------- | -------- |
| View templates                                | ✅ → ✅ | ✅ → ✅                      | ❌        |
| Create / edit / delete templates (any domain) | ✅ → ✅ | ✅ → ✅ *(already in place)* | ❌        |
| Assign templates to employees                 | ✅ → ✅ | ✅ → ✅                      | ❌        |


No change.

---

## 5. Team Registry & Team Assessments


| Capability                | Admin         | Manager (Domain Lead of X) | Employee |
| ------------------------- | ------------- | -------------------------- | -------- |
| View Team Registry        | ✅ all domains | 🟡 only domain X           | ❌        |
| Approve / adjust registry | ✅             | 🟡 domain X                | ❌        |
| View Team Assessments     | ✅ all         | 🟡 domain X                | ❌        |
| Review assessment results | ✅             | 🟡 domain X                | ❌        |


No change — current behavior matches.

---

## 6. Admin-only areas (unchanged)

Users, Assessment Config, All Registries, Setup Progress — remain **Admin only**.

---

## 7. Employee (unchanged)

Self registry, take assigned assessments, view own results, dashboard. No admin-style operations anywhere.

---

## Net changes from this plan

1. **Skill Library** opens fully to Manager (Categories, Skills, Topics — create/edit/disable/delete).
2. **Domain detail** becomes editable for the Manager who is that domain's **Domain Lead**: edit metadata, assign Lead, manage users in domain, map skills.
3. **Domain list / create / delete** stays Admin-only.
4. Sidebar + RoleGuard already allow `manager` on `/skill-library` and `/domains`; only the in-page `isAdmin` gates need to be relaxed (with Domain-Lead checks where scoped).

---

## Open questions before I write the implementation plan

**Q1 — Domain edit scope for managers:** Should domain editing be limited to *Domain Lead* only, or to **any manager assigned to that domain** (via `employee_domain_assignments`)?   
Ans: Only domain lead. Manager is an additional role, so basically, someone assigned as domain lead, we can assign them a manager role automatically.

**Q2 — Reassigning Domain Lead:** When a Domain Lead reassigns the lead role to someone else, should they immediately lose edit rights on that domain? (Default: yes.) Ans: Yes

**Q3 — Adding users to a domain (Domain Lead):** Limited to picking from existing users, or also create new user accounts? Ans: pick existing only — user creation stays Admin.)

**Q4 — Skill Library deletes by Manager:** Same safety rules as Admin (block delete if skill/category in use), correct? (Default: yes, identical guardrails.)

Once you confirm Q1–Q4, I'll produce the implementation plan (files to touch, gating logic, UI changes).