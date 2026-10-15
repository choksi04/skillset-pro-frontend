export type TeamAssessmentSortKey = 'employee' | 'assessment' | 'status' | 'achieved' | 'verified';
export type SortDir = 'asc' | 'desc';
export interface TeamAssessmentSort { key: TeamAssessmentSortKey; dir: SortDir }

export const DEFAULT_TEAM_ASSESSMENT_SORT: TeamAssessmentSort = { key: 'employee', dir: 'asc' };

/** Values already displayed in the table (computed by existing helpers). */
export interface SortableAssessmentRow {
  id: string;
  employeeName: string;
  assessmentName: string;
  statusLabel: string;
  achievedLevel: number | null;
  verifiedLevel: number | null;
}

const KEYS: readonly TeamAssessmentSortKey[] = ['employee', 'assessment', 'status', 'achieved', 'verified'];

export function nextAssessmentSort(cur: TeamAssessmentSort, key: TeamAssessmentSortKey): TeamAssessmentSort {
  if (!KEYS.includes(key)) return DEFAULT_TEAM_ASSESSMENT_SORT;
  return cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
}

const text = (s: string) => { const t = (s ?? '').trim(); return t && t !== '—' ? t : null; };
const num = (n: number | null) => (n === null || n === undefined || !Number.isFinite(n) ? null : n);

function valueOf(r: SortableAssessmentRow, key: TeamAssessmentSortKey): string | number | null {
  switch (key) {
    case 'employee': return text(r.employeeName);
    case 'assessment': return text(r.assessmentName);
    case 'status': return text(r.statusLabel);
    case 'achieved': return num(r.achievedLevel);
    case 'verified': return num(r.verifiedLevel);
  }
}

/** Sort the full filtered list (before pagination). Missing last both directions; ID tie-breaker. */
export function sortTeamAssessmentRows<T>(items: T[], toRow: (t: T) => SortableAssessmentRow, sort: TeamAssessmentSort): T[] {
  const mult = sort.dir === 'asc' ? 1 : -1;
  const rows = items.map((item) => ({ item, row: toRow(item) }));
  rows.sort((A, B) => {
    const a = A.row, b = B.row;
    const va = valueOf(a, sort.key), vb = valueOf(b, sort.key);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    let c = 0;
    if (va !== null && vb !== null) {
      c = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true });
    }
    if (c !== 0) return c * mult;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return rows.map((r) => r.item);
}
