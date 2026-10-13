import { describe, it, expect } from 'vitest';
import { sortTeamRegistryRows, nextSort, DEFAULT_TEAM_REGISTRY_SORT, type SortableTeamRow } from './teamRegistrySort';

const row = (id: string, p: Partial<SortableTeamRow> = {}): SortableTeamRow => ({
  latestId: id, fullName: 'X', domainName: 'D', status: 'draft', completionPct: 0, avgOnFive: null, metricsLoading: false, ...p,
});
const ids = (r: SortableTeamRow[]) => r.map((x) => x.latestId);

describe('team registry sort', () => {
  it('defaults to Team Member ascending', () => {
    expect(DEFAULT_TEAM_REGISTRY_SORT).toEqual({ key: 'member', dir: 'asc' });
  });
  it('new column starts asc, same column toggles', () => {
    expect(nextSort({ key: 'member', dir: 'asc' }, 'rating')).toEqual({ key: 'rating', dir: 'asc' });
    expect(nextSort({ key: 'rating', dir: 'asc' }, 'rating')).toEqual({ key: 'rating', dir: 'desc' });
  });
  it('sorts names case-insensitively', () => {
    const r = [row('1', { fullName: 'bob' }), row('2', { fullName: 'Alice' }), row('3', { fullName: 'carl' })];
    expect(ids(sortTeamRegistryRows(r, { key: 'member', dir: 'asc' }))).toEqual(['2', '1', '3']);
  });
  it('sorts completion numerically (9 before 80)', () => {
    const r = [row('a', { completionPct: 80 }), row('b', { completionPct: 9 })];
    expect(ids(sortTeamRegistryRows(r, { key: 'completion', dir: 'asc' }))).toEqual(['b', 'a']);
  });
  it('treats zero rating as valid and missing last in both directions', () => {
    const r = [row('n', { avgOnFive: null }), row('z', { avgOnFive: 0 }), row('h', { avgOnFive: 4.2 })];
    expect(ids(sortTeamRegistryRows(r, { key: 'rating', dir: 'asc' }))).toEqual(['z', 'h', 'n']);
    expect(ids(sortTeamRegistryRows(r, { key: 'rating', dir: 'desc' }))).toEqual(['h', 'z', 'n']);
  });
  it('sorts status by displayed label', () => {
    const r = [row('1', { status: 'review_pending' }), row('2', { status: 'approved' }), row('3', { status: 'draft' })];
    expect(ids(sortTeamRegistryRows(r, { key: 'status', dir: 'asc' }))).toEqual(['2', '3', '1']);
  });
  it('uses registry ID tie-breaker for stable pages', () => {
    const r = ['e', 'b', 'd', 'a', 'c'].map((id) => row(id, { fullName: 'Same' }));
    const asc = ids(sortTeamRegistryRows(r, { key: 'member', dir: 'asc' }));
    expect(asc).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(ids(sortTeamRegistryRows(r, { key: 'member', dir: 'desc' }))).toEqual(asc);
  });
});
