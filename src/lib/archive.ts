/**
 * Archive = the person's account status is not 'active' (set on the Users page).
 * Records stay untouched; lists just hide archived people unless asked to include them.
 */
export const isArchivedStatus = (status: string | null | undefined): boolean =>
  status != null && status !== 'active';

export function filterArchived<T>(rows: T[], getEmployeeId: (r: T) => string, statusById: Record<string, string | undefined>, includeArchived: boolean): T[] {
  if (includeArchived) return rows;
  return rows.filter((r) => !isArchivedStatus(statusById[getEmployeeId(r)]));
}
