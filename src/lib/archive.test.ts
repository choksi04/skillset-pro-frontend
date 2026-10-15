import { describe, it, expect } from 'vitest';
import { filterArchived, isArchivedStatus } from './archive';

const rows = [{ e: 'a' }, { e: 'b' }, { e: 'c' }];
const status = { a: 'active', b: 'inactive' } as Record<string, string>;

describe('archive filter', () => {
  it('hides inactive people by default', () => {
    expect(filterArchived(rows, (r) => r.e, status, false).map((r) => r.e)).toEqual(['a', 'c']);
  });
  it('keeps inactive people when Include archived is on', () => {
    expect(filterArchived(rows, (r) => r.e, status, true)).toHaveLength(3);
  });
  it('treats only non-active status as archived', () => {
    expect(isArchivedStatus('inactive')).toBe(true);
    expect(isArchivedStatus('active')).toBe(false);
    expect(isArchivedStatus(undefined)).toBe(false);
  });
});
