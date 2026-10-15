import { supabase } from '@/integrations/supabase/client';
import { computeRegistryMetrics, versionSkillIds } from '@/lib/registryMetrics';
import { registryStatusConfig } from '@/lib/registryStatus';
import type { CsvCell } from '@/lib/csv';

const CHUNK = 200;
const PAGE = 1000;

/** Fetch every row for `.in(col, ids)` with chunking + range paging. Throws on any error. */
async function fetchAllIn<T>(table: string, cols: string, col: string, ids: string[], extra?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    for (let from = 0; ; from += PAGE) {
      let q: any = (supabase.from(table as any) as any).select(cols).in(col, slice).order('id').range(from, from + PAGE - 1);
      if (extra) q = extra(q);
      const { data, error } = await q;
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE) break;
    }
  }
  return out;
}

export interface ExportRegistryRow {
  empId: string;
  fullName: string;
  designation: string;
  domainId: string;
  domainName: string;
  /** Archived (inactive) employee — name is suffixed so exports identify them. */
  archived?: boolean;
  registry: { id: string; version_number: number; status: 'draft' | 'submitted'; submitted_at: string | null; updatedAt: string | null };
}

export const TEAM_REGISTRY_HEADER = [
  'Employee ID', 'Employee Name', 'Designation', 'Domain ID', 'Domain Name',
  'Registry ID', 'Registry Version', 'Registry Status', 'Submitted At', 'Last Updated',
  'Rated Skills', 'Total Skills', 'Completion %', 'Avg Self Rating (/5)',
  'Skill ID', 'Skill Name', 'Skill Category', 'Self Rating (Level)', 'Self Comment',
  'Manager Score (Level)', 'Manager Comment', 'Review Status', 'Review Overall Comment', 'Review Completed At',
];

export async function buildTeamRegistryExport(args: {
  rows: ExportRegistryRow[];
  mappings: { domain_id: string; skill_id: string }[];
  skills: { id: string; skill_name: string; skill_category: string; status: string }[];
  maxLevel: number;
}): Promise<CsvCell[][]> {
  const { rows, mappings, skills, maxLevel } = args;
  const regIds = rows.map((r) => r.registry.id);
  if (regIds.length === 0) return [];

  const items = await fetchAllIn<{ id: string; registry_id: string; skill_id: string; self_score: number | null; comment: string | null }>(
    'skill_registry_items', 'id, registry_id, skill_id, self_score, comment', 'registry_id', regIds);
  const reviews = await fetchAllIn<{ id: string; registry_id: string; status: string; overall_comment: string | null; completed_at: string | null; created_at: string }>(
    'registry_reviews', 'id, registry_id, status, overall_comment, completed_at, created_at', 'registry_id', regIds,
    (q) => q.is('deleted_on', null));
  // Latest review per registry (same "latest wins" rule as the review store)
  const latestReview = new Map<string, (typeof reviews)[number]>();
  reviews.forEach((rv) => {
    const cur = latestReview.get(rv.registry_id);
    if (!cur || rv.created_at > cur.created_at) latestReview.set(rv.registry_id, rv);
  });
  const reviewItems = await fetchAllIn<{ id: string; review_id: string; skill_id: string; manager_score: number | null; manager_comment: string | null }>(
    'registry_review_items', 'id, review_id, skill_id, manager_score, manager_comment', 'review_id',
    Array.from(latestReview.values()).map((r) => r.id));

  const itemsByReg = new Map<string, typeof items>();
  items.forEach((i) => { if (!itemsByReg.has(i.registry_id)) itemsByReg.set(i.registry_id, []); itemsByReg.get(i.registry_id)!.push(i); });
  const rItemsByReview = new Map<string, Map<string, (typeof reviewItems)[number]>>();
  reviewItems.forEach((ri) => { if (!rItemsByReview.has(ri.review_id)) rItemsByReview.set(ri.review_id, new Map()); rItemsByReview.get(ri.review_id)!.set(ri.skill_id, ri); });
  const skillById = new Map(skills.map((s) => [s.id, s]));

  // Keep the caller's order (the table's selected sort).
  const sorted = rows;
  const out: CsvCell[][] = [];
  for (const r of sorted) {
    const regItems = itemsByReg.get(r.registry.id) ?? [];
    const review = latestReview.get(r.registry.id) ?? null;
    const reviewStatus = review ? (review.status === 'approved' ? 'approved' : 'pending') : null;
    const currentDomainSkillIds = mappings.filter((m) => m.domain_id === r.domainId).map((m) => m.skill_id)
      .filter((id) => skillById.get(id)?.status === 'active');
    // Approved versions export their own saved skills (frozen history).
    const domainSkillIds = versionSkillIds({ registryStatus: r.registry.status, reviewStatus, items: regItems, domainSkillIds: currentDomainSkillIds })
      .filter((id) => skillById.has(id));
    const m = computeRegistryMetrics({ registryStatus: r.registry.status, items: regItems, domainSkillIds, maxLevel, reviewStatus: reviewStatus as any });
    const base: CsvCell[] = [
      r.empId, r.archived ? `${r.fullName} (Archived)` : r.fullName, r.designation, r.domainId, r.domainName,
      r.registry.id, r.registry.version_number, registryStatusConfig[m.status].label, r.registry.submitted_at, r.registry.updatedAt,
      m.ratedCount, m.totalSkills, m.completionPct, m.avgOnFive,
    ];
    const reviewTail: CsvCell[] = [review?.status ?? null, review?.overall_comment ?? null, review?.completed_at ?? null];
    const skillIds = [...domainSkillIds].sort((a, b) => {
      const sa = skillById.get(a)!, sb = skillById.get(b)!;
      return (sa.skill_category || '').localeCompare(sb.skill_category || '') || sa.skill_name.localeCompare(sb.skill_name);
    });
    if (skillIds.length === 0) { out.push([...base, null, null, null, null, null, null, null, ...reviewTail]); continue; }
    const itemBySkill = new Map(regItems.map((i) => [i.skill_id, i]));
    const rMap = review ? rItemsByReview.get(review.id) : undefined;
    for (const sid of skillIds) {
      const s = skillById.get(sid)!;
      const it = itemBySkill.get(sid);
      const self = it && it.self_score && Number(it.self_score) > 0 ? Number(it.self_score) : null;
      const ri = rMap?.get(sid);
      out.push([...base, sid, s.skill_name, s.skill_category || null, self, it?.comment ?? null,
        ri?.manager_score ?? null, ri?.manager_comment ?? null, ...reviewTail]);
    }
  }
  return out;
}
