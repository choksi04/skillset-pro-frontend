import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';

import type { SkillRegistry, SkillRegistryItem } from '@/stores/skillRegistryStore';
import type { Domain } from '@/stores/domainStore';
import { computeRegistryMetrics } from '@/lib/registryMetrics';

interface Props {
  loading: boolean;
  domains: Domain[];
  registries: SkillRegistry[];
  items: Map<string, SkillRegistryItem[]>;
  reviewStatuses: Record<string, string | undefined>;
  /** All active employees with their domain assignment. */
  employees: { id: string; domain_id: string | null }[];
  /** Active skills mapped per domain (shared metric rule). */
  domainSkillIdsByDomain: Map<string, string[]>;
  /** Filter: optional domain to highlight. */
  domainFilter?: string;
}

interface DomainBreakdown {
  domainId: string;
  domainName: string;
  approved: number;
  reviewPending: number;
  draft: number;
  notStarted: number;
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-success',
  reviewPending: 'bg-warning',
  draft: 'bg-info',
  notStarted: 'bg-muted-foreground/40',
};

const STATUS_LABELS: Record<string, string> = {
  approved: 'Approved',
  reviewPending: 'Review Pending',
  draft: 'Draft',
  notStarted: 'Not Started',
};

export function DomainReadiness({
  loading,
  domains,
  registries,
  items,
  reviewStatuses,
  employees,
  totalSkillsByDomain,
  domainFilter,
}: Props) {
  const navigate = useNavigate();

  const breakdowns = useMemo<DomainBreakdown[]>(() => {
    const activeDomains = domains.filter((d) => d.status === 'active');
    const filtered = domainFilter ? activeDomains.filter((d) => d.id === domainFilter) : activeDomains;

    const byEmployeeLatest = new Map<string, SkillRegistry>();
    registries.forEach((r) => {
      if (!byEmployeeLatest.has(r.employee_id)) byEmployeeLatest.set(r.employee_id, r);
    });

    return filtered.map<DomainBreakdown>((d) => {
      const teamMembers = employees.filter((e) => e.domain_id === d.id);
      const totalSkills = totalSkillsByDomain.get(d.id) ?? 0;

      let approved = 0;
      let reviewPending = 0;
      let draft = 0;
      let notStarted = 0;

      teamMembers.forEach((emp) => {
        const reg = byEmployeeLatest.get(emp.id);
        if (!reg) {
          notStarted += 1;
          return;
        }
        const its = items.get(reg.id) ?? [];
        const ratedCount = its.filter((i) => i.self_score !== null && i.self_score !== undefined).length;
        const status: RegistryStatus = deriveRegistryStatus({
          registryStatus: reg.status,
          ratedCount,
          totalSkills,
          reviewStatus: (reviewStatuses[reg.id] as 'pending' | 'approved' | 'completed' | undefined) ?? null,
        });
        if (status === 'approved') approved += 1;
        else if (status === 'review_pending') reviewPending += 1;
        else if (status === 'not_started') notStarted += 1;
        else draft += 1; // draft, incomplete, etc.
      });

      return {
        domainId: d.id,
        domainName: d.name,
        approved,
        reviewPending,
        draft,
        notStarted,
        total: teamMembers.length,
      };
    });
  }, [domains, registries, items, reviewStatuses, employees, totalSkillsByDomain, domainFilter]);

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Domain Readiness"
        description="Where each domain stands across the registry lifecycle."
      />
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : breakdowns.length === 0 ? (
            <EmptyState icon={Network} title="No active domains" description="Add domains to track readiness." />
          ) : (
            <div className="space-y-3">
              {breakdowns.map((b) => {
                const segments = [
                  { key: 'approved', value: b.approved },
                  { key: 'reviewPending', value: b.reviewPending },
                  { key: 'draft', value: b.draft },
                  { key: 'notStarted', value: b.notStarted },
                ];
                const denom = b.total || 1;
                return (
                  <button
                    key={b.domainId}
                    type="button"
                    onClick={() => navigate(`/domains/${b.domainId}`)}
                    className="block w-full rounded-md border border-border bg-card px-3 py-2 text-left transition hover:border-primary/40"
                  >
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                      <span className="truncate font-medium text-foreground" title={b.domainName}>
                        {b.domainName}
                      </span>
                      <span className="text-muted-foreground">
                        {b.approved}/{b.total} approved
                      </span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/60">
                      {b.total === 0 ? (
                        <div className="flex w-full items-center justify-center text-[10px] text-muted-foreground">
                          No employees
                        </div>
                      ) : (
                        segments.map((s) =>
                          s.value > 0 ? (
                            <div
                              key={s.key}
                              className={STATUS_COLORS[s.key]}
                              style={{ width: `${(s.value / denom) * 100}%` }}
                              title={`${STATUS_LABELS[s.key]}: ${s.value}`}
                            />
                          ) : null,
                        )
                      )}
                    </div>
                  </button>
                );
              })}
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                {(['approved', 'reviewPending', 'draft', 'notStarted'] as const).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[k]}`} />
                    {STATUS_LABELS[k]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
