import { registryStatusConfig, type RegistryStatus } from '@/lib/registryStatus';

export type TeamRegistrySortKey = 'member' | 'status' | 'completion' | 'rating';
export type SortDir = 'asc' | 'desc';
export interface TeamRegistrySort { key: TeamRegistrySortKey; dir: SortDir }

export const DEFAULT_TEAM_REGISTRY_SORT: TeamRegistrySort = { key: 'member', dir: 'asc' };

export interface SortableTeamRow {
  latestId: string;
  fullName: string;
  domainName: string;
  status: RegistryStatus;
  completionPct: number;
  avgOnFive: number | null;
  metricsLoading: boolean;
}

const SORTABLE_KEYS: readonly TeamRegistrySortKey[] = ['member', 'status', 'completion', 'rating'];

/** Next sort state when a header is clicked: new column → asc, same column → toggle.
 *  Unsortable keys (e.g. a legacy saved 'subject' sort) fall back to the default. */
export function nextSort(cur: TeamRegistrySort, key: TeamRegistrySortKey): TeamRegistrySort {
  if (!SORTABLE_KEYS.includes(key)) return DEFAULT_TEAM_REGISTRY_SORT;
  return cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
}

function valueOf(r: SortableTeamRow, key: TeamRegistrySortKey): string | number | null {
  switch (key) {
    case 'member': return r.fullName.trim() || null;
    case 'subject': return r.domainName.trim() || null;
    case 'status': return registryStatusConfig[r.status]?.label ?? null;
    case 'completion': return r.metricsLoading || !Number.isFinite(r.completionPct) ? null : r.completionPct;
    case 'rating': return r.metricsLoading || r.avgOnFive === null || !Number.isFinite(r.avgOnFive) ? null : r.avgOnFive;
  }
}

/** Sort a full row list (before pagination). Missing values last in both directions; registry ID tie-breaker. */
export function sortTeamRegistryRows<T extends SortableTeamRow>(rows: T[], sort: TeamRegistrySort): T[] {
  const mult = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = valueOf(a, sort.key);
    const vb = valueOf(b, sort.key);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    let c = 0;
    if (va !== null && vb !== null) {
      c = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true });
    }
    if (c !== 0) return c * mult;
    return a.latestId < b.latestId ? -1 : a.latestId > b.latestId ? 1 : 0;
  });
}
