import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => {
  const q: any = {};
  ['select', 'in', 'order', 'is', 'range'].forEach((m) => (q[m] = () => q));
  q.then = (res: any) => res({ data: [], error: null });
  return { supabase: { from: () => q } };
});

import { buildTeamRegistryExport } from './teamRegistryExport';

const row = (empId: string, archived?: boolean) => ({
  empId, fullName: 'Name ' + empId, designation: '', domainId: 'd', domainName: 'D', archived,
  registry: { id: 'r' + empId, version_number: 1, status: 'submitted' as const, submitted_at: null, updatedAt: null },
});

describe('export archive label', () => {
  it('suffixes only archived employees', async () => {
    const out = await buildTeamRegistryExport({ rows: [row('a'), row('b', true)], mappings: [], skills: [], maxLevel: 5 });
    expect(out.map((r) => r[1])).toEqual(['Name a', 'Name b (Archived)']);
  });
});
