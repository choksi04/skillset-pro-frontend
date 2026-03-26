

## Plan: Redesign Skill Library Module

Redesign the Skill Library into a hierarchical Category → Skill → Topic system with a new database table, updated store, and completely rewritten UI pages.

---

### Database Change

**New table: `skill_topics`**

```sql
CREATE TABLE public.skill_topics (
  id text NOT NULL PRIMARY KEY,
  skill_id text NOT NULL,
  tenant_id text NOT NULL DEFAULT 'tenant-001',
  name text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz,
  deleted_on timestamptz,
  created_by text,
  modified_by text,
  deleted_by text
);

ALTER TABLE public.skill_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON public.skill_topics FOR ALL TO public USING (true) WITH CHECK (true);
```

---

### Store Changes

**File: `src/stores/skillStore.ts`**

- Add `SkillTopic` interface and `topics: SkillTopic[]` to store state.
- Add `fetchTopicsForSkill(skillId)` — lazy-loads topics for a single skill (not fetched upfront).
- Add `addTopic`, `updateTopic`, `deleteTopic` actions.
- Update `deleteSkill` to check for domain mappings, question bank usage, and registry usage before allowing deletion (show toast error if blocked).
- Categories and skills continue to load as they do now.

---

### UI Restructure (3 files)

#### 1. Skill Library Landing Page (`src/pages/SkillFrameworkPage.tsx`) — Category List

Complete rewrite. Shows **only categories** in a clean table:

| Category Name | Description | Skills Count | Status | Actions |
|---|---|---|---|---|

- "Create Category" primary CTA button.
- Search bar filters categories by name/description.
- Status filter (active/disabled).
- Clicking a row navigates to `/skill-library/:categoryId`.
- Admin-only edit/delete actions inline (dropdown menu).
- Delete blocked if category has skills (toast error).

#### 2. Category Detail Page (`src/pages/CategoryDetailPage.tsx`) — NEW

Route: `/skill-library/:categoryId`

- Header: Category name + description + back link to `/skill-library`.
- Skills table for this category:

| Skill Name | Description | Tags | Topics | Status | Actions |

- "Add Skill" primary CTA.
- Search + tag filter + status filter.
- Clicking a skill row opens a **Sheet (side drawer)** with skill details + topics.
- Admin edit/delete/toggle actions via dropdown.
- Delete checks: blocked if skill is mapped to a domain, used in questions, or used in registry.

#### 3. Skill Detail Drawer (`src/components/skills/SkillDetailDrawer.tsx`) — NEW

Opens as a right-side `Sheet` when a skill row is clicked.

- Shows: Skill name, description, tags, status.
- Topics section below with a small table:

| Topic Name | Description | Actions |

- "Add Topic" button.
- Inline add/edit via a small dialog or inline form.
- Topics lazy-loaded when drawer opens (`fetchTopicsForSkill`).
- Topics deletable anytime (no restrictions).

---

### Form Updates

**`src/components/skills/SkillFormDialog.tsx`**
- Remove category selector (category is now implicit from the detail page context).
- Accept `categoryName` as a prop instead.

**`src/components/skills/CategoryFormDialog.tsx`**
- No changes needed (already works).

**New: `src/components/skills/TopicFormDialog.tsx`**
- Simple dialog: name (required, max 100) + description (optional, max 300).
- Validates uniqueness within the skill.

---

### Route Changes

**File: `src/App.tsx`**
- Add route: `/skill-library/:categoryId` → `CategoryDetailPage` (admin, manager).
- Import new `CategoryDetailPage`.

---

### Breadcrumb Updates

**File: `src/components/layout/PageHeader.tsx`**
- Add breadcrumb mapping for `/skill-library/:categoryId` → `Settings > Skill Library > [Category Name]`.

---

### Delete Safety Rules (in store)

- **Category**: Cannot delete if `skills.filter(s => s.skill_category === cat.name).length > 0`.
- **Skill**: Cannot delete if:
  - Mapped to any domain (`domain_skill_mappings` table, check via supabase query).
  - Used in question bank (`questions` table where `skill_id = id`).
  - Used in registry (`skill_self_ratings` or `official_skill_entries` where `skill_id = id`).
- **Topic**: Can always be deleted (soft delete).

---

### Performance

- Landing page loads only categories + skill counts (already in store).
- Category detail page filters skills from store by category name.
- Topics loaded lazily per skill when drawer opens.

---

### Documentation

**File: `src/pages/UserGuidePage.tsx`**
- Update Skill Library section with hierarchy explanation (Category → Skill → Topic).
- Add instructions for creating categories, skills, and topics.

---

### Files Summary

| Action | File |
|--------|------|
| Migration | `skill_topics` table |
| Rewrite | `src/pages/SkillFrameworkPage.tsx` (category list) |
| Create | `src/pages/CategoryDetailPage.tsx` |
| Create | `src/components/skills/SkillDetailDrawer.tsx` |
| Create | `src/components/skills/TopicFormDialog.tsx` |
| Modify | `src/stores/skillStore.ts` (add topics) |
| Modify | `src/components/skills/SkillFormDialog.tsx` |
| Modify | `src/App.tsx` (add route) |
| Modify | `src/components/layout/PageHeader.tsx` (breadcrumb) |
| Modify | `src/pages/UserGuidePage.tsx` |

