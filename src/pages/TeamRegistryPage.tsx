import { useState, useMemo, useEffect } from 'react';
import { getManagerDomainIds } from "@/lib/managerScope";
import { useSkillRegistryStore } from '@/stores/skillRegistryStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useCompetencyLevelStore } from '@/stores/competencyLevelStore';
import { useRegistryReviewStore } from '@/stores/registryReviewStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import SearchableSelect from '@/components/ui/searchable-select';
import { Users, Search, Filter, Star, ChevronRight, Download, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import {
  sortTeamRegistryRows, nextSort, DEFAULT_TEAM_REGISTRY_SORT,
  type TeamRegistrySort, type TeamRegistrySortKey,
} from '@/lib/teamRegistrySort';
import {
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';

const PAGE_SIZE = 10;
import { toast } from '@/hooks/use-toast';
import { toCsv, downloadCsv, timestampedFilename } from '@/lib/csv';
import { buildTeamRegistryExport, TEAM_REGISTRY_HEADER } from '@/lib/teamRegistryExport';
import { useNavigate } from 'react-router-dom';
import { registryStatusConfig, type RegistryStatus } from '@/lib/registryStatus';
import { computeRegistryMetrics } from '@/lib/registryMetrics';
import { RegistryStatusBadge } from '@/components/registry/RegistryStatusBadge';

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr).getTime();
  const diff = Date.now() - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? '' : 's'} ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function getInitials(name: string): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Status filter accepts any RegistryStatus or 'all'
type StatusFilter = 'all' | RegistryStatus;

export default function TeamRegistryPage() {
  const { user, currentRole } = useAuth();
  const navigate = useNavigate();
  const { registries, fetchRegistries, items, fetchItemsForRegistries, initialized } = useSkillRegistryStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { levels, fetchLevels } = useCompetencyLevelStore();
  const { reviewStatuses, fetchReviewStatusesForRegistries } = useRegistryReviewStore();

  const [userMeta, setUserMeta] = useState<Record<string, { full_name: string; designation: string }>>({});
  const [namesLoading, setNamesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');

  const maxLevel = levels.length > 0 ? levels.length : 5;

  useEffect(() => {
    fetchRegistries();
    fetchDomains();
    fetchSkills();
    fetchLevels();
  }, []);

  // Manager scope — domains they lead plus their own assigned domain
  const ledDomainIds = useMemo(() => {
    if (currentRole !== 'manager' || !user) return new Set<string>();
    return getManagerDomainIds(user, domains);
  }, [domains, currentRole, user]);

  // Role-scoped registries (admin sees all; manager sees their scoped domains)
  const teamRegistries = useMemo(() => {
    if (currentRole === 'admin') return registries;
    if (currentRole === 'manager') {
      if (ledDomainIds.size === 0) return [];
      return registries.filter((r) => ledDomainIds.has(r.domain_id));
    }
    return [];
  }, [registries, currentRole, ledDomainIds]);

  const notDomainLead = currentRole === 'manager' && ledDomainIds.size === 0;

  // Group by employee → latest version
  const groupedByEmployee = useMemo(() => {
    const map = new Map<string, typeof teamRegistries>();
    teamRegistries.forEach((r) => {
      if (!map.has(r.employee_id)) map.set(r.employee_id, []);
      map.get(r.employee_id)!.push(r);
    });
    map.forEach((regs) => regs.sort((a, b) => b.version_number - a.version_number));
    return map;
  }, [teamRegistries]);

  // Fetch employee meta
  useEffect(() => {
    if (!initialized) return;
    const employeeIds = Array.from(groupedByEmployee.keys());
    const missing = employeeIds.filter((id) => !(id in userMeta));
    if (missing.length === 0) {
      setNamesLoading(false);
      return;
    }
    setNamesLoading(true);
    supabase.from('users').select('id, full_name, designation').in('id', missing).then(({ data }) => {
      if (data) {
        setUserMeta((prev) => {
          const next = { ...prev };
          data.forEach((u: any) => {
            next[u.id] = { full_name: u.full_name ?? '—', designation: u.designation ?? '' };
          });
          return next;
        });
      }
      setNamesLoading(false);
    }, () => setNamesLoading(false));
  }, [groupedByEmployee, initialized]);

  // Items + review statuses for latest registries (one batched fetch each)
  useEffect(() => {
    const ids = Array.from(groupedByEmployee.values()).map((regs) => regs[0].id);
    if (ids.length > 0) {
      fetchItemsForRegistries(ids);
      fetchReviewStatusesForRegistries(ids);
    }
  }, [groupedByEmployee]);

  // Build display rows
  const rows = useMemo(() => {
    return Array.from(groupedByEmployee.entries()).map(([empId, regs]) => {
      const latest = regs[0];
      const domain = domains.find((d) => d.id === latest.domain_id);
      // Shared metric rules (see src/lib/registryMetrics.ts) — active domain skills only.
      const domainSkillIds = mappings
        .filter((m) => m.domain_id === latest.domain_id)
        .map((m) => m.skill_id)
        .filter((id) => skills.some((s) => s.id === id && s.status === 'active'));
      const metrics = computeRegistryMetrics({
        registryStatus: latest.status as 'draft' | 'submitted',
        items: items.get(latest.id),
        domainSkillIds,
        maxLevel,
        reviewStatus: reviewStatuses[latest.id] ?? null,
      });
      const { totalSkills, ratedCount, completionPct, avgOnFive, loading: metricsLoading } = metrics;
      const status: RegistryStatus = metrics.status;

      const updatedAt = latest.status === 'submitted'
        ? (latest.submitted_at ?? latest.modified_at ?? latest.created_at)
        : (latest.modified_at ?? latest.created_at);

      const meta = userMeta[empId];
      return {
        empId,
        latestId: latest.id,
        fullName: meta?.full_name ?? '',
        designation: meta?.designation ?? '',
        domainName: domain?.name ?? 'Unknown domain',
        domainId: latest.domain_id,
        status,
        ratedCount,
        totalSkills,
        completionPct,
        avgOnFive,
        metricsLoading,
        hasRatings: ratedCount > 0,
        updatedAt,
      };
    });
  }, [groupedByEmployee, domains, mappings, skills, items, userMeta, maxLevel, reviewStatuses]);

  // Filter + search
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (domainFilter !== 'all' && r.domainId !== domainFilter) return false;
      if (q) {
        const hay = `${r.fullName} ${r.designation}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, domainFilter]);

  // Sort the full filtered list (before pagination); export uses the same order.
  const [sort, setSort] = useState<TeamRegistrySort>(DEFAULT_TEAM_REGISTRY_SORT);
  const sortedRows = useMemo(() => sortTeamRegistryRows(filteredRows, sort), [filteredRows, sort]);

  // Pagination (display only — export always uses the full sortedRows list)
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, statusFilter, domainFilter]);
  const handleSort = (key: TeamRegistrySortKey) => { setSort((s) => nextSort(s, key)); setPage(1); };
  const total = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);

  const isLoading = !initialized || namesLoading || (currentRole === 'manager' && domains.length === 0);
  const filtersActive = statusFilter !== 'all' || domainFilter !== 'all';

  // Domains visible in filter dropdown
  const filterDomains = useMemo(() => {
    const visible = new Set(rows.map((r) => r.domainId));
    return domains.filter((d) => visible.has(d.id));
  }, [domains, rows]);

  // Status filter dropdown only needs to show statuses that actually appear in the data,
  // plus the canonical order.
  const statusFilterOptions: RegistryStatus[] = ['draft', 'incomplete', 'review_pending', 'approved'];

  // Export: Admin / Manager only, scoped to the same filtered rows the table shows.
  const canExport = currentRole === 'admin' || currentRole === 'manager';
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (!canExport || exporting) return;
    if (filteredRows.length === 0) {
      toast({ title: 'Nothing to export', description: 'No team registries match the current search and filters.' });
      return;
    }
    setExporting(true);
    try {
      const exportRows = sortedRows.map((r) => {
        const reg = groupedByEmployee.get(r.empId)![0];
        return {
          empId: r.empId, fullName: r.fullName, designation: r.designation,
          domainId: r.domainId, domainName: r.domainName,
          registry: { id: reg.id, version_number: reg.version_number, status: reg.status, submitted_at: reg.submitted_at, updatedAt: r.updatedAt },
        };
      });
      const data = await buildTeamRegistryExport({ rows: exportRows, mappings, skills, maxLevel });
      downloadCsv(toCsv(TEAM_REGISTRY_HEADER, data), timestampedFilename('Team_Registry'));
      toast({ title: 'Export complete', description: `${exportRows.length} registries, ${data.length} rows exported.` });
    } catch (e: any) {
      console.error('Team registry export failed', e);
      toast({ title: 'Export failed', description: 'No file was downloaded. Please try again.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Team Registries</h2>
          <p className="text-sm text-muted-foreground mt-1">Review and manage skill assessments submitted by your team.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {canExport && (
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExport} disabled={exporting || isLoading}>
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          )}
          <div className="relative w-full sm:w-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members or roles..."
              className="pl-9 w-full sm:w-[260px] h-9 text-sm"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <Filter size={13} />
                Filter
                {filtersActive && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Status</label>
                <SearchableSelect
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as any)}
                  className="w-full h-8 text-sm"
                  options={[
                    { value: 'all', label: 'All statuses' },
                    ...statusFilterOptions.map((s) => ({ value: s, label: registryStatusConfig[s].label })),
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Domain</label>
                <SearchableSelect
                  value={domainFilter}
                  onValueChange={setDomainFilter}
                  className="w-full h-8 text-sm"
                  options={[
                    { value: 'all', label: 'All domains' },
                    ...filterDomains.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                />
              </div>
              {filtersActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setStatusFilter('all'); setDomainFilter('all'); }}
                >
                  Clear filters
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Table */}
      <Card className="border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-border">
              {([
                ['member', 'Team Member', 'w-[24%]'],
                ['subject', 'Registry Subject', 'w-[20%]'],
                ['status', 'Status', 'w-[12%]'],
                ['completion', 'Completion', 'w-[20%]'],
                ['rating', 'Avg Rating', 'w-[12%]'],
              ] as [TeamRegistrySortKey, string, string][]).map(([key, label, w]) => {
                const active = sort.key === key;
                const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <TableHead
                    key={key}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`text-[11px] uppercase tracking-wide text-muted-foreground font-medium py-3 px-5 ${w}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(key)}
                      className={`inline-flex items-center gap-1 uppercase tracking-wide rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'text-foreground' : ''}`}
                      aria-label={`Sort by ${label}${active ? (sort.dir === 'asc' ? ', currently ascending' : ', currently descending') : ''}`}
                    >
                      {label}
                      <Icon size={12} className={active ? '' : 'opacity-40'} aria-hidden="true" />
                    </button>
                  </TableHead>
                );
              })}
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium py-3 px-5 w-[12%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <TableRow key={i} className="border-border">
                  <TableCell className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-5"><div className="space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-20" /></div></TableCell>
                  <TableCell className="py-4 px-5"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell className="py-4 px-5"><div className="space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-1.5 w-full" /></div></TableCell>
                  <TableCell className="py-4 px-5"><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell className="py-4 px-5 text-right"><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredRows.length === 0 ? (
              <TableRow className="hover:bg-transparent border-border">
                <TableCell colSpan={6} className="py-16">
                  {rows.length === 0 ? (
                    <div className="flex flex-col items-center text-center">
                      <Users size={28} className="text-muted-foreground mb-3" />
                      <h3 className="text-base font-semibold text-foreground mb-1">
                        {notDomainLead ? 'No Domain Assigned' : 'No Registries Yet'}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        {notDomainLead
                          ? "You're not assigned to a domain yet. Ask an admin to assign you."
                          : 'No team members have submitted their skill registries yet.'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">No team members match your filters.</p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((r) => (
                <TableRow
                  key={r.empId}
                  className="border-border cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate(`/team-registry/${r.latestId}`)}
                >
                  {/* Team Member */}
                  <TableCell className="py-4 px-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {getInitials(r.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{r.fullName || '—'}</p>
                        {r.designation && (
                          <p className="text-xs text-muted-foreground truncate">{r.designation}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Registry Subject */}
                  <TableCell className="py-4 px-5">
                    <p className="text-sm font-semibold text-foreground truncate">{r.domainName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Updated {formatRelative(r.updatedAt)}</p>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-4 px-5">{r.metricsLoading ? <Skeleton className="h-5 w-20 rounded-full" /> : <RegistryStatusBadge status={r.status} size="sm" />}</TableCell>

                  {/* Completion */}
                  <TableCell className="py-4 px-5">
                    <div className="space-y-1.5 max-w-[220px]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {r.metricsLoading ? '—' : `${r.ratedCount} / ${r.totalSkills} Rated`}
                        </span>
                        <span className="font-semibold text-foreground">
                          {r.metricsLoading ? '' : `${r.completionPct}%`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full transition-all ${r.completionPct >= 100 ? 'bg-success' : 'bg-primary'}`}
                          style={{ width: `${r.metricsLoading ? 0 : Math.max(0, Math.min(100, r.completionPct))}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>

                  {/* Avg Rating */}
                  <TableCell className="py-4 px-5">
                    {!r.metricsLoading && r.avgOnFive !== null ? (
                      <div className="flex items-center gap-1.5">
                        <Star size={14} className="text-warning fill-warning" />
                        <span className="text-sm font-semibold text-foreground">{r.avgOnFive.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-4 px-5 text-right">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/team-registry/${r.latestId}`); }}
                      className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
                    >
                      Review <ChevronRight size={14} />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{pageStart + 1}</span> to{' '}
            <span className="font-medium text-foreground">{Math.min(pageStart + PAGE_SIZE, total)}</span> of{' '}
            <span className="font-medium text-foreground">{total}</span> team members
          </p>
          {pageCount > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent className="flex-wrap">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                    className={safePage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {(() => {
                  const list: (number | 'ellipsis')[] = [];
                  if (pageCount <= 7) {
                    for (let i = 1; i <= pageCount; i++) list.push(i);
                  } else {
                    list.push(1);
                    if (safePage > 3) list.push('ellipsis');
                    for (let i = Math.max(2, safePage - 1); i <= Math.min(pageCount - 1, safePage + 1); i++) list.push(i);
                    if (safePage < pageCount - 2) list.push('ellipsis');
                    list.push(pageCount);
                  }
                  return list.map((item, idx) =>
                    item === 'ellipsis' ? (
                      <PaginationItem key={`e-${idx}`}><PaginationEllipsis /></PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink href="#" isActive={item === safePage} onClick={(e) => { e.preventDefault(); setPage(item); }}>
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  );
                })()}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(pageCount, p + 1)); }}
                    className={safePage === pageCount ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  );
}
