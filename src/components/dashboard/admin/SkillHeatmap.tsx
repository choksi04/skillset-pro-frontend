import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Network, ArrowRight } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

type Mode = 'approved' | 'all_submitted';

interface CellAgg {
  sum: number;
  itemCount: number;
  employees: Set<string>;
  hasPending: boolean;
  lastApprovedAt: number; // 0 if none
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
  const [mode, setMode] = useState<Mode>('approved');

  // Pick the qualifying registry per employee based on mode.
  // Registries are pre-sorted by version_number desc, so iterate in order
  // and take the FIRST matching one per employee.
  const qualifyingPerEmployee = useMemo(() => {
    const out = new Map<string, SkillRegistry>();
    registries.forEach((r) => {
      if (r.status !== 'submitted') return;
      if (out.has(r.employee_id)) return;
      if (mode === 'approved') {
        if (reviewStatuses[r.id] === 'approved') out.set(r.employee_id, r);
      } else {
        out.set(r.employee_id, r);
      }
    });
    return out;
  }, [registries, reviewStatuses, mode]);

  // Aggregate cells: domainId|categoryId
  const { cells, lastUpdated } = useMemo(() => {
    const acc = new Map<string, CellAgg>();
    let maxTs = 0;
    qualifyingPerEmployee.forEach((reg) => {
      const ts = new Date(reg.modified_at ?? reg.submitted_at ?? reg.created_at).getTime();
      if (ts > maxTs) maxTs = ts;
      const isApproved = reviewStatuses[reg.id] === 'approved';
      const empDomain = reg.domain_id;
      if (!empDomain) return;
      const its = items.get(reg.id) ?? [];
      its.forEach((i) => {
        const skill = skills.find((s) => s.id === i.skill_id);
        if (!skill?.skill_category) return;
        if (i.self_score === null || i.self_score === undefined) return;
        const k = `${empDomain}|${skill.skill_category}`;
        const cur =
          acc.get(k) ??
          {
            sum: 0,
            itemCount: 0,
            employees: new Set<string>(),
            hasPending: false,
            lastApprovedAt: 0,
          };
        cur.sum += i.self_score;
        cur.itemCount += 1;
        cur.employees.add(reg.employee_id);
        if (!isApproved) cur.hasPending = true;
        if (isApproved && ts > cur.lastApprovedAt) cur.lastApprovedAt = ts;
        acc.set(k, cur);
      });
    });
    return {
      cells: acc,
      lastUpdated: maxTs > 0 ? new Date(maxTs) : null,
    };
  }, [qualifyingPerEmployee, items, skills, reviewStatuses]);

  const activeDomains = useMemo(
    () => domains.filter((d) => d.status === 'active'),
    [domains],
  );
  const activeCategories = useMemo(
    () => categories.filter((c) => c.status === 'active'),
    [categories],
  );

  // Row totals
  const rowTotals = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    activeDomains.forEach((d) => {
      let sum = 0;
      let n = 0;
      activeCategories.forEach((c) => {
        const v = cells.get(`${d.id}|${c.id}`);
        if (v) {
          sum += v.sum / v.itemCount;
          n += 1;
        }
      });
      m.set(d.id, { sum, n });
    });
    return m;
  }, [activeDomains, activeCategories, cells]);

  // Column totals
  const colTotals = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    activeCategories.forEach((c) => {
      let sum = 0;
      let n = 0;
      activeDomains.forEach((d) => {
        const v = cells.get(`${d.id}|${c.id}`);
        if (v) {
          sum += v.sum / v.itemCount;
          n += 1;
        }
      });
      m.set(c.id, { sum, n });
    });
    return m;
  }, [activeDomains, activeCategories, cells]);

  const totalCells = activeDomains.length * activeCategories.length;
  const populatedCells = cells.size;

  // Total active employees who have any submitted registry (as denominator)
  const employeesWithAnySubmitted = useMemo(() => {
    const s = new Set<string>();
    registries.forEach((r) => {
      if (r.status === 'submitted') s.add(r.employee_id);
    });
    return s.size;
  }, [registries]);

  const employeesIncluded = qualifyingPerEmployee.size;

  const sortedLevels = useMemo(
    () =>
      [...levels]
        .filter((l) => l.status === 'active')
        .sort((a, b) => a.level - b.level),
    [levels],
  );

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

    if (qualifyingPerEmployee.size === 0) {
      const isApprovedMode = mode === 'approved';
      return (
        <EmptyState
          icon={CheckCircle2}
          title={
            isApprovedMode
              ? 'No approved registries yet'
              : 'No submitted registries yet'
          }
          description={
            isApprovedMode
              ? `0 of ${employeesWithAnySubmitted} employee${employeesWithAnySubmitted === 1 ? '' : 's'} have an approved registry. Switch to “All submitted” to include in-flight data.`
              : 'Once employees submit a registry, the heatmap will start filling in.'
          }
          action={
            isApprovedMode && employeesWithAnySubmitted > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMode('all_submitted')}
              >
                Show all submitted
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/all-registries')}
                className="gap-1"
              >
                Open All Registries <ArrowRight size={14} />
              </Button>
            )
          }
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
                {activeCategories.map((c) => (
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
              {activeDomains.map((d) => {
                const row = rowTotals.get(d.id);
                const rowAvg = row && row.n > 0 ? row.sum / row.n : null;
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                      <div className="truncate" title={d.name}>{d.name}</div>
                    </td>
                    {activeCategories.map((c) => {
                      const v = cells.get(`${d.id}|${c.id}`);
                      if (!v) {
                        return (
                          <td key={c.id} className="px-2 py-2 text-center">
                            <span className="text-muted-foreground">—</span>
                          </td>
                        );
                      }
                      const avg = v.sum / v.itemCount;
                      const lastApproved = v.lastApprovedAt > 0 ? new Date(v.lastApprovedAt) : null;
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
                                  'relative inline-flex h-6 min-w-[40px] items-center justify-center rounded-md px-2 text-[11px] font-medium transition hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary ' +
                                  getLevelColorClass(Math.round(avg))
                                }
                              >
                                {avg.toFixed(1)}
                                {v.hasPending ? (
                                  <span
                                    className="absolute -right-1 -top-1 inline-block h-2 w-2 rounded-full bg-warning ring-2 ring-card"
                                    aria-label="includes pending"
                                  />
                                ) : null}
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
                              {lastApproved ? (
                                <div className="text-muted-foreground">
                                  Last approved {formatRelative(lastApproved)}
                                </div>
                              ) : null}
                              {v.hasPending ? (
                                <div className="text-warning">Includes unapproved data</div>
                              ) : null}
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
                {activeCategories.map((c) => {
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

        {/* Legend */}
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
            {mode === 'all_submitted' ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-warning" />
                Includes pending
              </span>
            ) : null}
          </div>
        </div>
      </TooltipProvider>
    );
  };

  const showCoverage = !loading && activeDomains.length > 0 && activeCategories.length > 0;

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Skill Heatmap"
        description="Average self-rated level by domain × skill category, sourced from employee registries."
        action={
          <div className="flex items-center gap-3">
            {!loading ? (
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved only</SelectItem>
                  <SelectItem value="all_submitted">All submitted</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Coverage strip */}
      {showCoverage ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
            <div className="text-muted-foreground">Employees included</div>
            <div className="mt-0.5 font-semibold text-foreground">
              {employeesIncluded}{' '}
              <span className="font-normal text-muted-foreground">
                of {employeesWithAnySubmitted} submitted
              </span>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
            <div className="text-muted-foreground">Cells populated</div>
            <div className="mt-0.5 font-semibold text-foreground">
              {populatedCells}{' '}
              <span className="font-normal text-muted-foreground">of {totalCells}</span>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
            <div className="text-muted-foreground">Source</div>
            <div className="mt-0.5 font-semibold text-foreground">
              {mode === 'approved' ? 'Approved registries only' : 'All submitted registries'}
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-4">{renderBody()}</CardContent>
      </Card>
    </div>
  );
}
