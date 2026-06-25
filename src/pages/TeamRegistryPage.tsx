import { useState, useMemo, useEffect } from 'react';
import { useSkillRegistryStore } from '@/stores/skillRegistryStore';
import { useDomainStore } from '@/stores/domainStore';
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
import { Users, Search, Filter, Star, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deriveRegistryStatus, registryStatusConfig, type RegistryStatus } from '@/lib/registryStatus';
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
    fetchLevels();
  }, []);

  // Domains the current manager leads
  const ledDomainIds = useMemo(() => {
    if (currentRole !== 'manager' || !user) return new Set<string>();
    return new Set(domains.filter((d) => d.domain_lead_id === user.id).map((d) => d.id));
  }, [domains, currentRole, user]);

  // Role-scoped registries (admin sees all; manager sees only domains they lead)
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
      const totalSkills = mappings.filter((m) => m.domain_id === latest.domain_id).length;
      const ratedItems = items.get(latest.id) ?? [];
      const ratedCount = ratedItems.length;
      const completionPct = totalSkills > 0 ? Math.round((ratedCount / totalSkills) * 100) : 0;
      const avgRaw = ratedCount > 0 ? ratedItems.reduce((s, i) => s + i.self_score, 0) / ratedCount : 0;
      const avgOnFive = maxLevel > 0 ? Math.round((avgRaw / maxLevel) * 5 * 10) / 10 : 0;

      const status: RegistryStatus = deriveRegistryStatus({
        registryStatus: latest.status as 'draft' | 'submitted',
        ratedCount,
        totalSkills,
        reviewStatus: reviewStatuses[latest.id] ?? null,
      });

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
        hasRatings: ratedCount > 0,
        updatedAt,
      };
    });
  }, [groupedByEmployee, domains, mappings, items, userMeta, maxLevel, reviewStatuses]);

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

  const isLoading = !initialized || namesLoading;
  const filtersActive = statusFilter !== 'all' || domainFilter !== 'all';

  // Domains visible in filter dropdown
  const filterDomains = useMemo(() => {
    const visible = new Set(rows.map((r) => r.domainId));
    return domains.filter((d) => visible.has(d.id));
  }, [domains, rows]);

  // Status filter dropdown only needs to show statuses that actually appear in the data,
  // plus the canonical order.
  const statusFilterOptions: RegistryStatus[] = ['draft', 'incomplete', 'review_pending', 'approved'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Team Registries</h2>
          <p className="text-sm text-muted-foreground mt-1">Review and manage skill assessments submitted by your team.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members or roles..."
              className="pl-9 w-[260px] h-9 text-sm"
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
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium py-3 px-5 w-[24%]">Team Member</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium py-3 px-5 w-[20%]">Registry Subject</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium py-3 px-5 w-[12%]">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium py-3 px-5 w-[20%]">Completion</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium py-3 px-5 w-[12%]">Avg Rating</TableHead>
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
                        {notDomainLead ? 'Not a Domain Lead' : 'No Registries Yet'}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        {notDomainLead
                          ? "You're not assigned as Domain Lead for any domain. Ask an admin to assign you."
                          : 'No team members have submitted their skill registries yet.'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">No team members match your filters.</p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((r) => (
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
                  <TableCell className="py-4 px-5"><RegistryStatusBadge status={r.status} size="sm" /></TableCell>

                  {/* Completion */}
                  <TableCell className="py-4 px-5">
                    <div className="space-y-1.5 max-w-[220px]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{r.ratedCount} / {r.totalSkills} Rated</span>
                        <span className="font-semibold text-foreground">{r.completionPct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full transition-all ${r.completionPct >= 100 ? 'bg-success' : 'bg-primary'}`}
                          style={{ width: `${Math.max(0, Math.min(100, r.completionPct))}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>

                  {/* Avg Rating */}
                  <TableCell className="py-4 px-5">
                    {r.hasRatings ? (
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
    </div>
  );
}
