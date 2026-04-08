import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore, OfficialSkillEntry } from '@/stores/reviewStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useRegistryStore } from '@/stores/registryStore';
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
import { Download, Search, Database, Users, BarChart3 } from 'lucide-react';

// levelLabels and levelColors now come from competencyLevelStore

// ── Skills view aggregation ──
interface SkillAgg {
  skill_id: string;
  skillName: string;
  category: string;
  totalEmps: number;
  levels: Record<number, number>; // level -> count
  avgLevel: number;
}

// ── Employee view aggregation ──
interface EmployeeAgg {
  employee_id: string;
  employeeName: string;
  domainName: string;
  selfAvg: number;
  assessmentAvg: number;
  finalAvg: number;
  submissionId: string | null;
  entryCount: number;
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

// ── CSV exports ──
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
  const header = ['Employee Name', 'Domain', 'Self Avg', 'Assessment Avg', 'Final Avg', 'Skills'];
  const csv = [header, ...rows.map(r => [
    r.employeeName, r.domainName, String(r.selfAvg), String(r.assessmentAvg), String(r.finalAvg), String(r.entryCount),
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
  const { officialEntries, fetchReviews } = useReviewStore();
  const { skills, fetchSkills, initialized: skillsInit } = useSkillStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { submissions, fetchRegistry, initialized: regInit } = useRegistryStore();

  const [viewMode, setViewMode] = useState<'skills' | 'employees'>('skills');
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchReviews();
    if (!skillsInit) fetchSkills();
    fetchDomains();
    if (!regInit) fetchRegistry();
  }, []);

  // Fetch user names for employee view
  useEffect(() => {
    if (officialEntries.length === 0) return;
    const empIds = [...new Set(officialEntries.map(e => e.employee_id))];
    if (empIds.length === 0) return;
    supabase.from('users').select('id, full_name').in('id', empIds).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(u => { map[u.id] = u.full_name; });
        setUserNames(map);
      }
    });
  }, [officialEntries]);

  const skillMap = useMemo(() => new Map(skills.map(s => [s.id, { skill_name: s.skill_name, skill_category: s.skill_category || 'Uncategorized' }])), [skills]);
  const domainMap = useMemo(() => new Map(domains.map(d => [d.id, d.name])), [domains]);

  // Domain-filtered entries
  const domainFiltered = useMemo(() => {
    if (domainFilter === 'all') return officialEntries;
    const domainSkillIds = new Set(mappings.filter(m => m.domain_id === domainFilter).map(m => m.skill_id));
    return officialEntries.filter(e => domainSkillIds.has(e.skill_id));
  }, [officialEntries, domainFilter, mappings]);

  // ── Skills aggregation ──
  const skillAggs = useMemo<SkillAgg[]>(() => {
    const map = new Map<string, { empLevels: Map<string, number> }>();
    domainFiltered.forEach(e => {
      if (!map.has(e.skill_id)) map.set(e.skill_id, { empLevels: new Map() });
      map.get(e.skill_id)!.empLevels.set(e.employee_id, e.final_level);
    });
    const result: SkillAgg[] = [];
    map.forEach((val, skillId) => {
      const info = skillMap.get(skillId);
      const levels: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      val.empLevels.forEach(level => {
        const clamped = Math.max(1, Math.min(5, level));
        levels[clamped] = (levels[clamped] || 0) + 1;
        sum += level;
      });
      result.push({
        skill_id: skillId,
        skillName: info?.skill_name || skillId,
        category: info?.skill_category || 'Uncategorized',
        totalEmps: val.empLevels.size,
        levels,
        avgLevel: Math.round((sum / val.empLevels.size) * 10) / 10,
      });
    });
    return result.sort((a, b) => a.skillName.localeCompare(b.skillName));
  }, [domainFiltered, skillMap]);

  const filteredSkills = useMemo(() => {
    if (!search) return skillAggs;
    const q = search.toLowerCase();
    return skillAggs.filter(s => s.skillName.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [skillAggs, search]);

  // ── Employee aggregation ──
  const employeeAggs = useMemo<EmployeeAgg[]>(() => {
    const map = new Map<string, OfficialSkillEntry[]>();
    domainFiltered.forEach(e => {
      if (!map.has(e.employee_id)) map.set(e.employee_id, []);
      map.get(e.employee_id)!.push(e);
    });
    const result: EmployeeAgg[] = [];
    map.forEach((entries, empId) => {
      const sub = submissions.find(s => s.employee_id === empId);
      const domainId = sub?.domain_id;
      result.push({
        employee_id: empId,
        employeeName: userNames[empId] || empId.slice(0, 8),
        domainName: domainId ? (domainMap.get(domainId) || 'Unknown') : '—',
        selfAvg: avg(entries.map(e => e.self_rating)),
        assessmentAvg: avg(entries.map(e => e.ai_level)),
        finalAvg: avg(entries.map(e => e.final_level)),
        submissionId: sub?.id || null,
        entryCount: entries.length,
      });
    });
    return result.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [domainFiltered, userNames, submissions, domainMap]);

  const filteredEmployees = useMemo(() => {
    if (!search) return employeeAggs;
    const q = search.toLowerCase();
    return employeeAggs.filter(e => e.employeeName.toLowerCase().includes(q) || e.domainName.toLowerCase().includes(q));
  }, [employeeAggs, search]);

  const handleExport = () => {
    if (viewMode === 'skills') exportSkillsCSV(filteredSkills);
    else exportEmployeesCSV(filteredEmployees);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">All Registries</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Organization-wide validated skill registry entries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'skills' | 'employees')}>
            <TabsList className="h-9">
              <TabsTrigger value="skills" className="gap-1.5 text-xs px-3">
                <BarChart3 size={14} /> By Skills
              </TabsTrigger>
              <TabsTrigger value="employees" className="gap-1.5 text-xs px-3">
                <Users size={14} /> By Employee
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'skills' ? 'Search by skill or category…' : 'Search by employee or domain…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue placeholder="All Domains" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            {domains.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* View: By Skills */}
      {viewMode === 'skills' && (
        filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Database size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No skill registry data found.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-medium">Skill Name</TableHead>
                  <TableHead className="text-xs font-medium">Category</TableHead>
                  <TableHead className="text-xs font-medium text-center">Employees</TableHead>
                  {[1, 2, 3, 4, 5].map(l => (
                    <TableHead key={l} className="text-xs font-medium text-center">L{l}</TableHead>
                  ))}
                  <TableHead className="text-xs font-medium text-center">Avg Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSkills.map(row => (
                  <TableRow key={row.skill_id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-sm font-medium">{row.skillName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.category}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[11px]">{row.totalEmps}</Badge>
                    </TableCell>
                    {[1, 2, 3, 4, 5].map(l => (
                      <TableCell key={l} className="text-center">
                        <Badge variant="outline" className={`text-[10px] ${row.levels[l] > 0 ? levelColors[l] : 'opacity-40'}`}>
                          {row.levels[l]}
                        </Badge>
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] ${levelColors[Math.round(row.avgLevel)] || ''}`}>
                        {row.avgLevel}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* View: By Employee */}
      {viewMode === 'employees' && (
        filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Database size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No employee registry data found.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-medium">Employee Name</TableHead>
                  <TableHead className="text-xs font-medium">Domain</TableHead>
                  <TableHead className="text-xs font-medium text-center">Self Avg</TableHead>
                  <TableHead className="text-xs font-medium text-center">Assessment Avg</TableHead>
                  <TableHead className="text-xs font-medium text-center">Final Avg</TableHead>
                  <TableHead className="text-xs font-medium text-center">Skills</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map(row => (
                  <TableRow
                    key={row.employee_id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => row.submissionId && navigate(`/team-registry/${row.submissionId}`)}
                  >
                    <TableCell className="text-sm font-medium">{row.employeeName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.domainName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px]">L{row.selfAvg}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px]">L{row.assessmentAvg}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] ${levelColors[Math.round(row.finalAvg)] || ''}`}>
                        {levelLabels[Math.round(row.finalAvg)] || `L${row.finalAvg}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{row.entryCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}
    </div>
  );
}
