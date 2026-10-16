import { describe, it, expect } from 'vitest';
import { buildAdminPivot } from './teamRegistryPivot';

const row = (emp: string, name: string, dom: string, skill: string | null, self: number | null) => {
  const r: any[] = Array(24).fill(null);
  r[0] = emp; r[1] = name; r[3] = dom; r[4] = dom === 'd1' ? 'Data' : 'Java'; r[14] = skill; r[17] = self;
  return r;
};
const skills = [
  { id: 's1', skill_name: 'B Skill', status: 'active' },
  { id: 's2', skill_name: 'A Skill', status: 'active' },
  { id: 's3', skill_name: 'A Skill', status: 'disabled' },
  { id: 's4', skill_name: 'Old', status: 'disabled' },
];
const mappings = [{ domain_id: 'd1', skill_id: 's1' }, { domain_id: 'd1', skill_id: 's2' }];

describe('buildAdminPivot', () => {
  const out = buildAdminPivot({
    longRows: [
      row('e2', 'Zed', 'd1', 's1', 3), row('e2', 'Zed', 'd1', 's2', null), row('e2', 'Zed', 'd1', 's4', 2),
      row('e1', 'Amy', 'd1', 's1', 4), row('e1', 'Amy', 'd1', 's2', 5), row('e1', 'Amy', 'd1', 's3', 1),
      row('e3', 'Bo', 'd2', 's1', 2),
    ], skills, mappings, emails: { e1: 'amy@x.com', e2: 'zed@x.com', e3: 'bo@x.com' },
  });

  it('builds header rows with Employee Email after Row Labels', () => {
    expect(out[0][0]).toBe('DATA');
    expect(out[1].slice(0, 3)).toEqual(['Sum of Self Rating (Level)', null, 'Skills']);
    expect(out[2].slice(0, 7)).toEqual(['Row Labels', 'Employee Email', 'A Skill', 'B Skill', 'A Skill (inactive)', 'Old', 'Average Rating']);
  });
  it('sorts employees, keeps blanks, averages only rated cells', () => {
    expect(out[3].slice(0, 7)).toEqual(['Amy', 'amy@x.com', 5, 4, 1, null, 3.33]);
    expect(out[4].slice(0, 7)).toEqual(['Zed', 'zed@x.com', null, 3, null, 2, 2.5]);
  });
  it('has no Grand Total summary row', () => {
    expect(out.flat().some((c) => c === 'Grand Total')).toBe(false);
  });
  it('adds a separate padded block per domain', () => {
    expect(out[5].every((c) => c === null)).toBe(true);
    expect(out[6][0]).toBe('JAVA');
    expect(out[9].slice(0, 2)).toEqual(['Bo', 'bo@x.com']);
    expect(new Set(out.map((r) => r.length)).size).toBe(1);
  });
});

describe('same-name employees', () => {
  it('stay separate, show emails, never internal IDs; missing email is blank', () => {
    const o = buildAdminPivot({ longRows: [
      row('919ccabc-uuid', 'Dhruv Patel', 'd1', 's1', 4), row('d40a110d-uuid', 'Dhruv Patel', 'd1', 's1', 2),
      row('zz', 'Zoe', 'd1', 's1', 1),
    ], skills, mappings, emails: { '919ccabc-uuid': 'dhruv.patel@x.com', 'd40a110d-uuid': 'dhruv.n.patel@x.com' } });
    expect(o[3].slice(0, 3)).toEqual(['Dhruv Patel', 'dhruv.patel@x.com', 4]);
    expect(o[4].slice(0, 3)).toEqual(['Dhruv Patel', 'dhruv.n.patel@x.com', 2]);
    expect(o[5].slice(0, 3)).toEqual(['Zoe', null, 1]);
    expect(o.flat().some((c) => typeof c === 'string' && c.includes('uuid'))).toBe(false);
  });
});

describe('Average Rating edge cases', () => {
  const sk = Array.from({ length: 21 }, (_, i) => ({ id: `k${i}`, skill_name: `S${String(i).padStart(2, '0')}`, status: 'active' }));
  const mp = sk.map((s) => ({ domain_id: 'd1', skill_id: s.id }));
  it('61 across 21 rated skills gives 2.90', () => {
    const vals = [2,2,2,2,2,2,2,2,4,3,4,3,4,3,3,3,4,3,4,3,4];
    const o = buildAdminPivot({ longRows: vals.map((v, i) => row('e', 'Abhijit', 'd1', `k${i}`, v)), skills: sk, mappings: mp });
    expect(o[3][23]).toBe(2.9);
  });
  it('no ratings gives blank; zero is a valid rating', () => {
    const o = buildAdminPivot({ longRows: [
      row('a', 'A', 'd1', 'k0', null), row('b', 'B', 'd1', 'k0', 0), row('b', 'B', 'd1', 'k1', 4),
    ], skills: sk.slice(0, 2), mappings: mp });
    expect(o[3][4]).toBeNull();
    expect(o[4].slice(2, 5)).toEqual([0, 4, 2]);
    expect(o.flat().some((c) => c === 'Grand Total')).toBe(false);
  });
});

describe('employee named Grand Total', () => {
  it('keeps the employee row; summaries are removed by purpose, not name', () => {
    const o = buildAdminPivot({ longRows: [row('g', 'Grand Total', 'd1', 's1', 3)], skills, mappings });
    expect(o[3][0]).toBe('Grand Total');
    expect(o.length).toBe(4);
  });
});
