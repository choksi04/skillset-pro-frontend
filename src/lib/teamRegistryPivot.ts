import type { CsvCell } from '@/lib/csv';

/** Mean of valid ratings, rounded once to 2 decimals; blank when none. */
export function avg2(sum: number, count: number): number | null {
  return count > 0 ? Math.round((sum / count) * 100) / 100 : null;
}

/**
 * Admin HR pivot: per domain, one row per employee, one column per skill (by ID),
 * cells = self-rating level of the exported registry version; blanks for unrated.
 * Built from the long export rows so the version rule and skill set stay identical.
 */
export function buildAdminPivot(args: {
  longRows: CsvCell[][];
  skills: { id: string; skill_name: string; status: string }[];
  mappings: { domain_id: string; skill_id: string }[];
}): CsvCell[][] {
  const { longRows, skills, mappings } = args;
  const skillById = new Map(skills.map((s) => [s.id, s]));
  type Dom = { name: string; emps: Map<string, { name: string; cells: Map<string, number> }>; skillIds: Set<string> };
  const doms = new Map<string, Dom>();
  for (const r of longRows) {
    const empId = String(r[0]); const empName = String(r[1] ?? '');
    const domId = String(r[3]); const domName = String(r[4] ?? domId);
    const skillId = r[14] == null ? null : String(r[14]);
    const self = typeof r[17] === 'number' && Number.isFinite(r[17]) && r[17] >= 0 ? r[17] : null;
    if (!doms.has(domId)) doms.set(domId, { name: domName, emps: new Map(), skillIds: new Set() });
    const d = doms.get(domId)!;
    if (!d.emps.has(empId)) d.emps.set(empId, { name: empName, cells: new Map() });
    if (skillId) {
      d.skillIds.add(skillId);
      if (self != null) d.emps.get(empId)!.cells.set(skillId, self);
    }
  }

  const blocks: CsvCell[][][] = [];
  const sortedDoms = [...doms.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name) || a[0].localeCompare(b[0]));
  for (const [domId, d] of sortedDoms) {
    const live = new Set(mappings.filter((m) => m.domain_id === domId).map((m) => m.skill_id));
    const isCurrent = (id: string) => live.has(id) && skillById.get(id)?.status === 'active';
    const nameOf = (id: string) => skillById.get(id)?.skill_name ?? id;
    const byName = (a: string, b: string) => nameOf(a).localeCompare(nameOf(b)) || a.localeCompare(b);
    const ids = [...d.skillIds];
    const cols = [...ids.filter(isCurrent).sort(byName), ...ids.filter((i) => !isCurrent(i)).sort(byName)];
    // Duplicate display names stay separate columns, disambiguated.
    const count = new Map<string, number>();
    cols.forEach((id) => count.set(nameOf(id), (count.get(nameOf(id)) ?? 0) + 1));
    const label = (id: string) => {
      const n = nameOf(id);
      if ((count.get(n) ?? 0) < 2) return n;
      const cur = isCurrent(id);
      const peers = cols.filter((c) => nameOf(c) === n && isCurrent(c) === cur).length;
      const base = cur ? n : `${n} (inactive)`;
      return peers > 1 ? `${base} [${id.slice(-6)}]` : base;
    };
    const emps = [...d.emps.entries()];
    const nameCount = new Map<string, number>();
    emps.forEach(([, e]) => nameCount.set(e.name, (nameCount.get(e.name) ?? 0) + 1));
    emps.sort((a, b) => a[1].name.localeCompare(b[1].name) || a[0].localeCompare(b[0]));

    const block: CsvCell[][] = [
      [d.name.toUpperCase()],
      ['Sum of Self Rating (Level)', 'Skills'],
      ['Row Labels', ...cols.map(label), 'Average Rating'],
    ];
    const colTotals = cols.map(() => 0);
    let grand = 0;
    let grandCount = 0;
    for (const [empId, e] of emps) {
      let rowTotal = 0;
      let rowCount = 0;
      const cells = cols.map((c, i) => {
        const v = e.cells.get(c);
        if (v == null) return null;
        rowTotal += v; rowCount += 1; colTotals[i] += v; return v;
      });
      grand += rowTotal; grandCount += rowCount;
      block.push([(nameCount.get(e.name) ?? 0) > 1 ? `${e.name} [${empId}]` : e.name, ...cells, avg2(rowTotal, rowCount)]);
    }
    block.push(['Grand Total', ...colTotals, avg2(grand, grandCount)]);
    blocks.push(block);
  }
  const width = Math.max(0, ...blocks.flat().map((r) => r.length));
  const pad = (r: CsvCell[]) => [...r, ...Array(width - r.length).fill(null)];
  const out: CsvCell[][] = [];
  blocks.forEach((b, i) => { if (i > 0) out.push(pad([])); b.forEach((r) => out.push(pad(r))); });
  return out;
}
