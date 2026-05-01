import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSkillRegistryStore } from '@/stores/skillRegistryStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useCompetencyLevelStore, getLevelColorClass } from '@/stores/competencyLevelStore';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Search, Database, Users, BarChart3, ChevronRight } from 'lucide-react';

type ReviewStatus = 'approved' | 'pending';

interface SkillEmployee {
  employee_id: string;
  name: string;
  domain: string;
  level: number;
  registryId: string;
  reviewStatus: ReviewStatus;
}

interface SkillAgg {
  skill_id: string;
  skillName: string;
  category: string;
  totalEmps: number;
  levels: Record<number, number>;
  avgLevel: number;
  employees: SkillEmployee[];
}

interface EmployeeAgg {
  employee_id: string;
  employeeName: string;
  domainName: string;
  selfAvg: number;
  entryCount: number;
  latestRegistryId: string | null;
  reviewStatus: ReviewStatus;
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

function exportSkillsCSV(rows: SkillAgg[]) {
  const header = ['Skill Name', 'Category', 'Employees', 'L1', 'L2', 'L3', 'L4', 'L5', 'Avg Level'];
  const csv = [header, ...rows.map(r => [
    r.skillName, r.category, String(r.totalEmps),
    String(r.levels[1] || 0), String(r.levels[2] || 0), String(r.levels[3] || 0),
    String(r.levels[4] || 0), String(r.levels[5] || 0), String(r.avgLevel),
  ])].map(r => r.join(',')).join('\n');
  downloadCSV(csv, 'registry_by_skills.csv');
}

function exportEmployeesCSV(rows: EmployeeAgg[]) {
  const header = ['Employee Name', 'Domain', 'Self Avg', 'Skills', 'Status'];
  const csv = [header, ...rows.map(r => [
    r.employeeName, r.domainName, String(r.selfAvg), String(r.entryCount),
    r.reviewStatus === 'approved' ? 'Approved' : 'Pending review',
  ])].map(r => r.join(',')).join('\n');
  downloadCSV(csv, 'registry_by_employees.csv');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AllRegistriesPage() {
  const navigate = useNavigate();
  const { registries, fetchRegistries, fetchItems, loading: regsLoading, initialized: regsInit } = useSkillRegistryStore();
  const { skills, fetchSkills, initialized: skillsInit } = useSkillStore();
  const { domains, mappings, fetchDomains } = useDomainStore();

  const [viewMode, setViewMode] = useState<'skills' | 'employees'>('skills');
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [allItems, setAllItems] = useState<Record<string, { skill_id: string; self_score: number }[]>>({});
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, ReviewStatus>>({});
  const [selectedSkill, setSelectedSkill] = useState<SkillAgg | null>(null);
  const [drawerSearch, setDrawerSearch] = useState('');

  useEffect(() => {
    fetchRegistries();
    if (!skillsInit) fetchSkills();
    fetchDomains();
  }, []);

  // Only use submitted registries for all-registries view
  const submittedRegistries = useMemo(
    () => registries.filter((r) => r.status === 'submitted'),
    [registries]
  );

  // Fetch review status (display-only, does NOT filter rows)
  useEffect(() => {
    const ids = submittedRegistries.map((r) => r.id);
    if (ids.length === 0) {
      setReviewStatuses({});
      return;
    }
    supabase
      .from('registry_reviews')
      .select('registry_id, status, deleted_on')
      .in('registry_id', ids)
      .is('deleted_on', null)
      .then(({ data }) => {
        const map: Record<string, ReviewStatus> = {};
        (data ?? []).forEach((r: any) => {
          map[r.registry_id] = r.status === 'approved' ? 'approved' : 'pending';
        });
        setReviewStatuses(map);
      });
  }, [submittedRegistries]);

  const getReviewStatus = (regId: string): ReviewStatus =>
    reviewStatuses[regId] ?? 'pending';

  // Fetch items for all submitted registries
  useEffect(() => {
    const ids = submittedRegistries.map((r) => r.id);
    if (ids.length === 0) return;
    supabase.from('skill_registry_items').select('registry_id, skill_id, self_score').in('registry_id', ids).then(({ data }) => {
      if (!data) return;
      const map: Record<string, { skill_id: string; self_score: number }[]> = {};
      data.forEach((i: any) => {
        if (!map[i.registry_id]) map[i.registry_id] = [];
        map[i.registry_id].push({ skill_id: i.skill_id, self_score: i.self_score });
      });
      setAllItems(map);
    });
  }, [submittedRegistries]);

  // Fetch user names
  useEffect(() => {
    const empIds = [...new Set(submittedRegistries.map(r => r.employee_id))];
    if (empIds.length === 0) return;
    supabase.from('users').select('id, full_name').in('id', empIds).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(u => { map[u.id] = u.full_name; });
        setUserNames(map);
      }
    });
  }, [submittedRegistries]);

  const skillMap = useMemo(() => new Map(skills.map(s => [s.id, { skill_name: s.skill_name, skill_category: s.skill_category || 'Uncategorized' }])), [skills]);
  const domainMap = useMemo(() => new Map(domains.map(d => [d.id, d.name])), [domains]);

  // Get latest version per employee
  const latestPerEmployee = useMemo(() => {
    const map = new Map<string, typeof submittedRegistries[0]>();
    submittedRegistries.forEach((r) => {
      const existing = map.get(r.employee_id);
      if (!existing || r.version_number > existing.version_number) {
        map.set(r.employee_id, r);
      }
    });
    return map;
  }, [submittedRegistries]);

  // Domain filtering
  const filteredLatest = useMemo(() => {
    const entries = Array.from(latestPerEmployee.values());
    if (domainFilter === 'all') return entries;
    return entries.filter(r => r.domain_id === domainFilter);
  }, [latestPerEmployee, domainFilter]);

  // Skills aggregation from latest approved registries (also collects employee drill-down list)
  const skillAggs = useMemo<SkillAgg[]>(() => {
    // skill_id -> employee_id -> { level, registryId }
    const map = new Map<string, Map<string, { level: number; registryId: string }>>();
    filteredLatest.forEach(reg => {
      const items = allItems[reg.id] || [];
      items.forEach(item => {
        if (!map.has(item.skill_id)) map.set(item.skill_id, new Map());
        map.get(item.skill_id)!.set(reg.employee_id, { level: item.self_score, registryId: reg.id });
      });
    });
    const result: SkillAgg[] = [];
    map.forEach((empMap, skillId) => {
      const info = skillMap.get(skillId);
      const levels: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      const employees: SkillEmployee[] = [];
      empMap.forEach(({ level, registryId }, employee_id) => {
        const clamped = Math.max(1, Math.min(5, level));
        levels[clamped] = (levels[clamped] || 0) + 1;
        sum += level;
        // Look up employee's domain from their registry
        const reg = filteredLatest.find(r => r.id === registryId);
        employees.push({
          employee_id,
          name: userNames[employee_id] || employee_id.slice(0, 8),
          domain: reg ? (domainMap.get(reg.domain_id) || 'Unknown') : 'Unknown',
          level,
          registryId,
          reviewStatus: getReviewStatus(registryId),
        });
      });
      employees.sort((a, b) => a.name.localeCompare(b.name));
      result.push({
        skill_id: skillId,
        skillName: info?.skill_name || skillId,
        category: info?.skill_category || 'Uncategorized',
        totalEmps: empMap.size,
        levels,
        avgLevel: Math.round((sum / empMap.size) * 10) / 10,
        employees,
      });
    });
    return result.sort((a, b) => a.skillName.localeCompare(b.skillName));
  }, [filteredLatest, allItems, skillMap, userNames, domainMap, reviewStatuses]);

  const filteredSkills = useMemo(() => {
    if (!search) return skillAggs;
    const q = search.toLowerCase();
    return skillAggs.filter(s => s.skillName.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [skillAggs, search]);

  // Employee aggregation
  const employeeAggs = useMemo<EmployeeAgg[]>(() => {
    return filteredLatest.map(reg => {
      const items = allItems[reg.id] || [];
      return {
        employee_id: reg.employee_id,
        employeeName: userNames[reg.employee_id] || reg.employee_id.slice(0, 8),
        domainName: domainMap.get(reg.domain_id) || 'Unknown',
        selfAvg: avg(items.map(i => i.self_score)),
        entryCount: items.length,
        latestRegistryId: reg.id,
        reviewStatus: getReviewStatus(reg.id),
      };
    }).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [filteredLatest, allItems, userNames, domainMap, reviewStatuses]);

  const filteredEmployees = useMemo(() => {
    if (!search) return employeeAggs;
    const q = search.toLowerCase();
    return employeeAggs.filter(e => e.employeeName.toLowerCase().includes(q) || e.domainName.toLowerCase().includes(q));
  }, [employeeAggs, search]);

  const handleExport = () => {
    if (viewMode === 'skills') exportSkillsCSV(filteredSkills);
    else exportEmployeesCSV(filteredEmployees);
  };

  // Drawer: filter employees by search
  const drawerEmployees = useMemo(() => {
    if (!selectedSkill) return [];
    if (!drawerSearch.trim()) return selectedSkill.employees;
    const q = drawerSearch.toLowerCase();
    return selectedSkill.employees.filter(e =>
      e.name.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q)
    );
  }, [selectedSkill, drawerSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">All Registries</h2>
          <p className="text-sm text-muted-foreground mt-1">Organization-wide skill registry data from latest submitted versions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'skills' | 'employees')}>
            <TabsList className="h-9">
              <TabsTrigger value="skills" className="gap-1.5 text-xs px-3"><BarChart3 size={14} /> By Skills</TabsTrigger>
              <TabsTrigger value="employees" className="gap-1.5 text-xs px-3"><Users size={14} /> By Employee</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5"><Download size={14} /> Export CSV</Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'skills' ? 'Search by skill or category…' : 'Search by employee or domain…'}
            value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="w-48 h-9 text-sm"><SelectValue placeholder="All Domains" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            {domains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {regsLoading && !regsInit ? (
        <div className="rounded-lg border border-border p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      ) : viewMode === 'skills' && (
        filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Database size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No approved registry data found.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-medium">Skill Name</TableHead>
                  <TableHead className="text-xs font-medium">Category</TableHead>
                  <TableHead className="text-xs font-medium text-center">Employees</TableHead>
                  {[1, 2, 3, 4, 5].map(l => <TableHead key={l} className="text-xs font-medium text-center">L{l}</TableHead>)}
                  <TableHead className="text-xs font-medium text-center">Avg Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSkills.map(row => (
                  <TableRow key={row.skill_id}>
                    <TableCell className="text-sm font-medium">{row.skillName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.category}</TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => { setDrawerSearch(''); setSelectedSkill(row); }}
                        className="inline-flex items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label={`View ${row.totalEmps} employees with skill ${row.skillName}`}
                      >
                        <Badge
                          variant="secondary"
                          className="text-[11px] cursor-pointer hover:bg-secondary/80"
                        >
                          {row.totalEmps}
                        </Badge>
                      </button>
                    </TableCell>
                    {[1, 2, 3, 4, 5].map(l => (
                      <TableCell key={l} className="text-center">
                        <Badge variant="outline" className={`text-[10px] ${row.levels[l] > 0 ? getLevelColorClass(l) : 'opacity-40'}`}>{row.levels[l]}</Badge>
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] ${getLevelColorClass(Math.round(row.avgLevel))}`}>{row.avgLevel}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {!(regsLoading && !regsInit) && viewMode === 'employees' && (
        filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Database size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No approved employee registry data found.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-medium">Employee Name</TableHead>
                  <TableHead className="text-xs font-medium">Domain</TableHead>
                  <TableHead className="text-xs font-medium text-center">Self Avg</TableHead>
                  <TableHead className="text-xs font-medium text-center">Skills</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map(row => (
                  <TableRow
                    key={row.employee_id}
                    className="cursor-pointer"
                    onClick={() => row.latestRegistryId && navigate(`/team-registry/${row.latestRegistryId}`)}
                  >
                    <TableCell className="text-sm font-medium">{row.employeeName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.domainName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px]">L{row.selfAvg}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{row.entryCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* Skill drill-down drawer */}
      <Sheet open={!!selectedSkill} onOpenChange={(open) => { if (!open) setSelectedSkill(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-lg">{selectedSkill?.skillName}</SheetTitle>
            <SheetDescription className="flex items-center gap-2 text-xs">
              <span>{selectedSkill?.category}</span>
              <span>·</span>
              <span>{selectedSkill?.totalEmps} {selectedSkill?.totalEmps === 1 ? 'employee' : 'employees'}</span>
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by employee or domain…"
              value={drawerSearch}
              onChange={(e) => setDrawerSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="mt-4 flex-1 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-medium">Employee</TableHead>
                  <TableHead className="text-xs font-medium">Domain</TableHead>
                  <TableHead className="text-xs font-medium text-center">Self Level</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {drawerEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                      No employees match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  drawerEmployees.map((emp) => (
                    <TableRow
                      key={emp.employee_id}
                      className="cursor-pointer"
                      onClick={() => {
                        navigate(`/team-registry/${emp.registryId}`);
                        setSelectedSkill(null);
                      }}
                    >
                      <TableCell className="text-sm font-medium">{emp.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{emp.domain}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[10px] ${getLevelColorClass(Math.max(1, Math.min(5, emp.level)))}`}>
                          L{emp.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRight size={14} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
