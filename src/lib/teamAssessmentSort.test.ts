import { describe, it, expect } from 'vitest';
import { sortTeamAssessmentRows, nextAssessmentSort, DEFAULT_TEAM_ASSESSMENT_SORT, type SortableAssessmentRow } from './teamAssessmentSort';

const row = (id: string, p: Partial<SortableAssessmentRow> = {}): SortableAssessmentRow => ({
  id, employeeName: 'X', statusLabel: 'Not Started', achievedLevel: null, verifiedLevel: null, ...p,
});
const run = (r: SortableAssessmentRow[], key: any, dir: 'asc' | 'desc' = 'asc') =>
  sortTeamAssessmentRows(r, (x) => x, { key, dir }).map((x) => x.id);

describe('team assessment sort', () => {
  it('defaults to Employee ascending', () => {
    expect(DEFAULT_TEAM_ASSESSMENT_SORT).toEqual({ key: 'employee', dir: 'asc' });
  });
  it('new column starts asc, same column toggles, unknown key falls back', () => {
    expect(nextAssessmentSort(DEFAULT_TEAM_ASSESSMENT_SORT, 'verified')).toEqual({ key: 'verified', dir: 'asc' });
    expect(nextAssessmentSort({ key: 'verified', dir: 'asc' }, 'verified')).toEqual({ key: 'verified', dir: 'desc' });
    expect(nextAssessmentSort({ key: 'status', dir: 'asc' }, 'bogus' as never)).toEqual(DEFAULT_TEAM_ASSESSMENT_SORT);
  });
  it('assessment details is not sortable and falls back to Employee ascending', () => {
    expect(nextAssessmentSort({ key: 'status', dir: 'desc' }, 'assessment' as never)).toEqual(DEFAULT_TEAM_ASSESSMENT_SORT);
    const r = [row('2', { employeeName: 'bob' }), row('1', { employeeName: 'Alice' })];
    expect(run(r, 'assessment')).toEqual(['1', '2']);
  });
  it('sorts employee names case-insensitively, missing name last', () => {
    const r = [row('1', { employeeName: 'bob' }), row('2', { employeeName: '—' }), row('3', { employeeName: 'Alice' })];
    expect(run(r, 'employee')).toEqual(['3', '1', '2']);
    expect(run(r, 'employee', 'desc')).toEqual(['1', '3', '2']);
  });
  it('duplicate employee names use assessment ID tie-breaker in both directions', () => {
    const r = ['c', 'a', 'b'].map((id) => row(id, { employeeName: 'Dhruv Patel' }));
    expect(run(r, 'employee')).toEqual(['a', 'b', 'c']);
    expect(run(r, 'employee', 'desc')).toEqual(['a', 'b', 'c']);
  });
  it('sorts status by displayed label', () => {
    const r = [row('1', { statusLabel: 'Under Review' }), row('2', { statusLabel: 'Approved' }), row('3', { statusLabel: 'In Progress' })];
    expect(run(r, 'status')).toEqual(['2', '3', '1']);
  });
  it('levels sort numerically, zero valid, missing last both directions', () => {
    const r = [row('n'), row('z', { achievedLevel: 0 }), row('h', { achievedLevel: 4 }), row('m', { achievedLevel: 2 })];
    expect(run(r, 'achieved')).toEqual(['z', 'm', 'h', 'n']);
    expect(run(r, 'achieved', 'desc')).toEqual(['h', 'm', 'z', 'n']);
  });
  it('achieved and verified sort independently', () => {
    const r = [row('1', { achievedLevel: 4, verifiedLevel: 2 }), row('2', { achievedLevel: 3, verifiedLevel: 5 }), row('3', { achievedLevel: 5 })];
    expect(run(r, 'achieved')).toEqual(['2', '1', '3']);
    expect(run(r, 'verified')).toEqual(['1', '2', '3']);
  });
});
