import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Network, ArrowRight } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  useCompetencyLevelStore,
  getLevelColorClass,
} from '@/stores/competencyLevelStore';

import type { Domain } from '@/stores/domainStore';
import type { Skill, SkillCategory } from '@/stores/skillStore';
import type {
  SkillRegistry,
  SkillRegistryItem,
} from '@/stores/skillRegistryStore';

import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';

interface SkillHeatmapProps {
  loading: boolean;
  domains: Domain[];
  categories: SkillCategory[];
  skills: Skill[];
  registries: SkillRegistry[];
  items: Map<string, SkillRegistryItem[]>;
  reviewStatuses: Record<string, string | undefined>;
}

interface CellAgg {
  sum: number;
  itemCount: number;
  employees: Set<string>;
}

function formatRelative(date: Date | null): string {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function SkillHeatmap({
  loading,
  domains,
  categories,
  skills,
  registries,
  items,
  reviewStatuses,
}: SkillHeatmapProps) {
  const navigate = useNavigate();
  const { levels } = useCompetencyLevelStore();
  const [hideEmpty, setHideEmpty] = useState<boolean | null>(null);

  // Latest APPROVED registry per employee
  const latestApprovedPerEmployee = useMemo(() => {
    const out = new Map<string, SkillRegistry>();
    registries.forEach((r) => {
      if (
        r.status === 'submitted' &&
        reviewStatuses[r.id] === 'approved' &&
        !out.has(r.employee_id)
      ) {
        out.set(r.employee_id, r);
      }
    });
    return out;
  }, [registries, reviewStatuses]);

  // Aggregate cells: domainId|categoryId -> { sum, itemCount, employees }
  const { cells, lastUpdated } = useMemo(() => {
    const acc = new Map<string, CellAgg>();
    let maxTs = 0;
    latestApprovedPerEmployee.forEach((reg) => {
      const ts = new Date(reg.modified_at ?? reg.created_at).getTime();
      if (ts > maxTs) maxTs = ts;
      const empDomain = reg.domain_id;
      if (!empDomain) return;
      const its = items.get(reg.id) ?? [];
      its.forEach((i) => {
        const skill = skills.find((s) => s.id === i.skill_id);
        if (!skill?.skill_category) return;
        if (i.self_score === null || i.self_score === undefined) return;
        const k = `${empDomain}|${skill.skill_category}`;
        const cur = acc.get(k) ?? { sum: 0, itemCount: 0, employees: new Set() };
        cur.sum += i.self_score;
        cur.itemCount += 1;
        cur.employees.add(reg.employee_id);
        acc.set(k, cur);
      });
    });
    return {
      cells: acc,
      lastUpdated: maxTs > 0 ? new Date(maxTs) : null,
    };
  }, [latestApprovedPerEmployee, items, skills]);

  const activeDomains = useMemo(
    () => domains.filter((d) => d.status === 'active'),
    [domains],
  );
  const activeCategories = useMemo(
    () => categories.filter((c) => c.status === 'active'),
    [categories],
  );

  // Determine which rows/cols have any data
  const populatedDomainIds = useMemo(() => {
    const s = new Set<string>();
    cells.forEach((_, k) => s.add(k.split('|')[0]));
    return s;
  }, [cells]);

  const populatedCategoryIds = useMemo(() => {
    const s = new Set<string>();
    cells.forEach((_, k) => s.add(k.split('|')[1]));
    return s;
  }, [cells]);

  // Auto-detect sparseness for default toggle
  const sparseDefault = useMemo(() => {
    const total = activeDomains.length * activeCategories.length;
    if (total === 0) return false;
    return cells.size / total < 0.5;
  }, [cells.size, activeDomains.length, activeCategories.length]);

  const effectiveHideEmpty = hideEmpty === null ? sparseDefault : hideEmpty;

  const visibleDomains = effectiveHideEmpty
    ? activeDomains.filter((d) => populatedDomainIds.has(d.id))
    : activeDomains;
  const visibleCategories = effectiveHideEmpty
    ? activeCategories.filter((c) => populatedCategoryIds.has(c.id))
    : activeCategories;

  // Row totals (per visible domain)
  const rowTotals = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    visibleDomains.forEach((d) => {
      let sum = 0;
      let n = 0;
      visibleCategories.forEach((c) => {
        const v = cells.get(`${d.id}|${c.id}`);
        if (v) {
          sum += v.sum / v.itemCount;
          n += 1;
        }
      });
      m.set(d.id, { sum, n });
    });
    return m;
  }, [visibleDomains, visibleCategories, cells]);

  // Column totals (per visible category)
  const colTotals = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    visibleCategories.forEach((c) => {
      let sum = 0;
      let n = 0;
      visibleDomains.forEach((d) => {
        const v = cells.get(`${d.id}|${c.id}`);
        if (v) {
          sum += v.sum / v.itemCount;
          n += 1;
        }
      });
      m.set(c.id, { sum, n });
    });
    return m;
  }, [visibleDomains, visibleCategories, cells]);

  const totalCells = activeDomains.length * activeCategories.length;
  const populatedCells = cells.size;

  const sortedLevels = useMemo(
    () =>
      [...levels]
        .filter((l) => l.status === 'active')
        .sort((a, b) => a.level - b.level),
    [levels],
  );

  // ─── Render branches ───
  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 flex-1" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, r) => (
            <div key={r} className="flex gap-2">
              <Skeleton className="h-8 w-32" />
              {Array.from({ length: 6 }).map((_, c) => (
                <Skeleton key={c} className="h-8 flex-1" />
              ))}
            </div>
          ))}
        </div>
      );
    }

    if (activeDomains.length === 0 || activeCategories.length === 0) {
      return (
        <EmptyState
          icon={Network}
          title="Set up your skill framework first"
          description="Add at least one active domain and one skill category to populate the heatmap."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate('/domains')}>
                Manage domains
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/skill-framework')}
              >
                Skill framework
              </Button>
            </div>
          }
        />
      );
    }

    if (latestApprovedPerEmployee.size === 0) {
      return (
        <EmptyState
          icon={CheckCircle2}
          title="No approved registries yet"
          description="The heatmap fills in once managers start approving team registries."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/all-registries')}
              className="gap-1"
            >
              Open All Registries <ArrowRight size={14} />
            </Button>
          }
        />
      );
    }

    if (visibleDomains.length === 0 || visibleCategories.length === 0) {
      return (
        <EmptyState
          icon={Network}
          title="No populated rows or columns to show"
          description="Toggle “Show only populated” off to see the full grid."
          compact
        />
      );
    }

    return (
      <TooltipProvider delayDuration={150}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                  Domain
                </th>
                {visibleCategories.map((c) => (
                  <th
                    key={c.id}
                    className="px-2 py-2 text-center font-medium text-muted-foreground"
                    title={c.name}
                  >
                    <span className="line-clamp-2 inline-block max-w-[110px]">{c.name}</span>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold text-muted-foreground">
                  Avg
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleDomains.map((d) => {
                const row = rowTotals.get(d.id);
                const rowAvg = row && row.n > 0 ? row.sum / row.n : null;
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                      <div className="truncate" title={d.name}>{d.name}</div>
                    </td>
                    {visibleCategories.map((c) => {
                      const v = cells.get(`${d.id}|${c.id}`);
                      if (!v) {
                        return (
                          <td key={c.id} className="px-2 py-2 text-center">
                            <span className="text-muted-foreground">—</span>
                          </td>
                        );
                      }
                      const avg = v.sum / v.itemCount;
                      return (
                        <td key={c.id} className="px-2 py-2 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/all-registries?domain=${encodeURIComponent(d.id)}&category=${encodeURIComponent(c.id)}`,
                                  )
                                }
                                className={
                                  'inline-flex h-6 min-w-[40px] items-center justify-center rounded-md px-2 text-[11px] font-medium transition hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary ' +
                                  getLevelColorClass(Math.round(avg))
                                }
                              >
                                {avg.toFixed(1)}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="font-medium">
                                {d.name} · {c.name}
                              </div>
                              <div className="text-muted-foreground">
                                Avg L{avg.toFixed(2)} · {v.employees.size} employee
                                {v.employees.size === 1 ? '' : 's'} · {v.itemCount} rating
                                {v.itemCount === 1 ? '' : 's'}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">
                      {rowAvg === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="font-semibold text-foreground">
                          {rowAvg.toFixed(1)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-border bg-muted/30">
                <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2 font-semibold text-muted-foreground">
                  Avg
                </td>
                {visibleCategories.map((c) => {
                  const col = colTotals.get(c.id);
                  const colAvg = col && col.n > 0 ? col.sum / col.n : null;
                  return (
                    <td key={c.id} className="px-2 py-2 text-center">
                      {colAvg === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="font-semibold text-foreground">
                          {colAvg.toFixed(1)}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2" />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend + footer note */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {sortedLevels.map((l) => (
              <span
                key={l.id}
                className={
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ' +
                  getLevelColorClass(l.level)
                }
                title={l.description}
              >
                L{l.level} <span className="opacity-80">{l.label}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              — No data
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {populatedCells} of {totalCells} cell{totalCells === 1 ? '' : 's'} populated
          </div>
        </div>
      </TooltipProvider>
    );
  };

  const showToggle =
    !loading &&
    activeDomains.length > 0 &&
    activeCategories.length > 0 &&
    latestApprovedPerEmployee.size > 0;

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Skill Heatmap"
        description="Average validated level by domain × skill category."
        action={
          <div className="flex items-center gap-3">
            {showToggle ? (
              <div className="flex items-center gap-2">
                <Switch
                  id="heatmap-hide-empty"
                  checked={effectiveHideEmpty}
                  onCheckedChange={(v) => setHideEmpty(v)}
                />
                <Label
                  htmlFor="heatmap-hide-empty"
                  className="text-xs text-muted-foreground"
                >
                  Show only populated
                </Label>
              </div>
            ) : null}
            {lastUpdated ? (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Updated {formatRelative(lastUpdated)}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => navigate('/all-registries')}
            >
              See all <ArrowRight size={14} />
            </Button>
          </div>
        }
      />
      <Card>
        <CardContent className="p-4">{renderBody()}</CardContent>
      </Card>
    </div>
  );
}
