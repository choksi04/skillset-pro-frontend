import { useMemo } from 'react';
import { Scale } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';

import type { SkillRegistry, SkillRegistryItem } from '@/stores/skillRegistryStore';
import type { Domain } from '@/stores/domainStore';
import type { AssessmentAttempt } from '@/stores/attemptStore';
import { getLatestApprovedPerEmployee } from '@/lib/registryHistory';

interface Props {
  loading: boolean;
  domains: Domain[];
  registries: SkillRegistry[];
  items: Map<string, SkillRegistryItem[]>;
  reviewStatuses: Record<string, string | undefined>;
  attempts: AssessmentAttempt[];
  domainFilter?: string;
}

interface BiasRow {
  domainId: string;
  domainName: string;
  bias: number; // self − validated; positive = over-rating
  cohort: number; // # of (employee, skill) data points
}

export function SelfRatingBias({
  loading,
  domains,
  registries,
  items,
  reviewStatuses,
  attempts,
  domainFilter,
}: Props) {
  const rows = useMemo<BiasRow[]>(() => {
    const latestApproved = getLatestApprovedPerEmployee(registries, reviewStatuses);

    // Build self-map: employee|skill → self_score
    const selfMap = new Map<string, { selfScore: number; domainId: string }>();
    latestApproved.forEach((reg, empId) => {
      (items.get(reg.id) ?? []).forEach((i) => {
        if (i.self_score === null || i.self_score === undefined) return;
        selfMap.set(`${empId}|${i.skill_id}`, { selfScore: i.self_score, domainId: reg.domain_id });
      });
    });

    // Build validated proxy: employee|skill → avg calculated_level across attempts
    const valMap = new Map<string, { sum: number; n: number }>();
    attempts.forEach((a) => {
      a.skill_scores.forEach((s) => {
        const k = `${a.employee_id}|${s.skill_id}`;
        if (!selfMap.has(k)) return;
        const cur = valMap.get(k) ?? { sum: 0, n: 0 };
        cur.sum += s.calculated_level;
        cur.n += 1;
        valMap.set(k, cur);
      });
    });

    if (valMap.size === 0) return [];

    // Aggregate per domain
    const acc = new Map<string, { sum: number; n: number }>();
    valMap.forEach((v, key) => {
      const ent = selfMap.get(key);
      if (!ent) return;
      const validated = v.sum / v.n;
      const bias = ent.selfScore - validated;
      const cur = acc.get(ent.domainId) ?? { sum: 0, n: 0 };
      cur.sum += bias;
      cur.n += 1;
      acc.set(ent.domainId, cur);
    });

    const activeDomains = domains.filter((d) => d.status === 'active');
    return activeDomains
      .filter((d) => !domainFilter || d.id === domainFilter)
      .map<BiasRow>((d) => {
        const v = acc.get(d.id);
        return {
          domainId: d.id,
          domainName: d.name,
          bias: v ? v.sum / v.n : 0,
          cohort: v?.n ?? 0,
        };
      })
      .sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));
  }, [domains, registries, items, reviewStatuses, attempts, domainFilter]);

  const populated = rows.filter((r) => r.cohort > 0);
  const maxAbs = Math.max(0.5, ...populated.map((r) => Math.abs(r.bias)));

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Self-Rating Bias by Domain"
        description="Avg(self − validated) per domain. Positive = over-rating; negative = under-rating."
      />
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : populated.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="Not enough validated data"
              description="Need approved registries plus evaluated assessments to compute bias."
            />
          ) : (
            <div className="space-y-2">
              {populated.map((r) => {
                const pct = (Math.abs(r.bias) / maxAbs) * 50;
                const isOver = r.bias > 0;
                return (
                  <div key={r.domainId} className="flex items-center gap-2 text-xs">
                    <div className="w-32 truncate text-muted-foreground" title={r.domainName}>
                      {r.domainName}
                    </div>
                    <div className="relative h-5 flex-1 rounded bg-muted/40">
                      {/* center divider */}
                      <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                      <div
                        className={
                          'absolute top-0 h-full rounded ' +
                          (isOver ? 'bg-warning/60' : 'bg-info/60')
                        }
                        style={{
                          [isOver ? 'left' : 'right']: '50%',
                          width: `${pct}%`,
                        } as React.CSSProperties}
                      />
                    </div>
                    <div
                      className={
                        'w-12 text-right font-medium ' +
                        (isOver ? 'text-warning' : 'text-info')
                      }
                    >
                      {r.bias > 0 ? '+' : ''}
                      {r.bias.toFixed(2)}
                    </div>
                    <div className="w-10 text-right text-[10px] text-muted-foreground">
                      n={r.cohort}
                    </div>
                  </div>
                );
              })}
              <p className="pt-2 text-[10px] text-muted-foreground">
                Validated proxy = avg AI-calculated level across attempts. Final manager scores
                will replace this in Phase 3.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
