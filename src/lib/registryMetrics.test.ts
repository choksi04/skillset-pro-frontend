import { describe, it, expect } from 'vitest';
import { computeRegistryMetrics } from './registryMetrics';

const v1 = ['a', 'b', 'c', 'd'];
const added = Array.from({ length: 13 }, (_, i) => `n${i}`);
const items = v1.map((skill_id) => ({ skill_id, self_score: 3 }));

describe('historical registry versions', () => {
  it('approved version keeps its own 4 skills after 13 are added', () => {
    const m = computeRegistryMetrics({ registryStatus: 'submitted', items, domainSkillIds: [...v1, ...added], maxLevel: 5, reviewStatus: 'approved' });
    expect(m.status).toBe('approved');
    expect(m.totalSkills).toBe(4);
    expect(m.completionPct).toBe(100);
  });
  it('pending review is still judged against current domain skills', () => {
    const m = computeRegistryMetrics({ registryStatus: 'submitted', items, domainSkillIds: [...v1, ...added], maxLevel: 5, reviewStatus: 'pending' });
    expect(m.status).toBe('incomplete');
    expect(m.totalSkills).toBe(17);
  });
  it('draft uses current domain total', () => {
    const m = computeRegistryMetrics({ registryStatus: 'draft', items, domainSkillIds: [...v1, ...added], maxLevel: 5 });
    expect(m.totalSkills).toBe(17);
  });
  it('approved version keeps a skill later removed from the domain', () => {
    const m = computeRegistryMetrics({ registryStatus: 'submitted', items, domainSkillIds: ['a', 'b', 'c'], maxLevel: 5, reviewStatus: 'approved' });
    expect(m.totalSkills).toBe(4);
    expect(m.staleItemCount).toBe(0);
    expect(m.status).toBe('approved');
  });
});
