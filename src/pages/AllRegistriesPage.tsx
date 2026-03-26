import { useState, useMemo, useEffect } from 'react';
import { useReviewStore, OfficialSkillEntry } from '@/stores/reviewStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Download, Search, Database } from 'lucide-react';

const levelLabels: Record<number, string> = {
  1: 'L1 – Basic', 2: 'L2 – Working', 3: 'L3 – Independent', 4: 'L4 – Advanced', 5: 'L5 – Expert',
};

const levelColors: Record<number, string> = {
  1: 'bg-muted text-muted-foreground',
  2: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  3: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  4: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  5: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

function exportToCSV(entries: OfficialSkillEntry[], skillMap: Map<string, string>) {
  const rows = [
    ['Employee ID', 'Skill', 'Self Rating', 'AI Level', 'Final Level', 'Cycle', 'Date'],
    ...entries.map((e) => [
      e.employee_id,
      skillMap.get(e.skill_id) || e.skill_id,
      String(e.self_rating),
      String(e.ai_level),
      String(e.final_level),
      e.cycle,
      new Date(e.timestamp).toLocaleDateString(),
    ]),
  ];
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'skill_registries.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function AllRegistriesPage() {
  const { officialEntries, fetchReviews } = useReviewStore();
  const { skills, fetchSkills, initialized: skillsInit } = useSkillStore();
  const { domains, mappings, fetchDomains } = useDomainStore();

  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');

  useEffect(() => {
    fetchReviews();
    if (!skillsInit) fetchSkills();
    fetchDomains();
  }, []);

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s.skill_name])), [skills]);

  const filtered = useMemo(() => {
    let result = officialEntries;
    if (domainFilter !== 'all') {
      const domainSkillIds = new Set(mappings.filter((m) => m.domain_id === domainFilter).map((m) => m.skill_id));
      result = result.filter((e) => domainSkillIds.has(e.skill_id));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) => {
        const skillName = skillMap.get(e.skill_id) || '';
        return skillName.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q);
      });
    }
    return result;
  }, [officialEntries, domainFilter, search, mappings, skillMap]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">All Registries</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Organization-wide validated skill registry entries.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered, skillMap)} className="gap-1.5">
          <Download size={14} /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by skill or employee…"
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
            {domains.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Database size={32} className="mb-2 opacity-40" />
          <p className="text-sm">No registry entries found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-medium sticky top-0">Skill</TableHead>
                <TableHead className="text-xs font-medium sticky top-0">Employee</TableHead>
                <TableHead className="text-xs font-medium sticky top-0 text-center">Self Rating</TableHead>
                <TableHead className="text-xs font-medium sticky top-0 text-center">AI Level</TableHead>
                <TableHead className="text-xs font-medium sticky top-0 text-center">Final Level</TableHead>
                <TableHead className="text-xs font-medium sticky top-0">Cycle</TableHead>
                <TableHead className="text-xs font-medium sticky top-0">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-sm font-medium">{skillMap.get(entry.skill_id) || entry.skill_id}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono text-xs">{entry.employee_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px]">L{entry.self_rating}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px]">L{entry.ai_level}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-[10px] ${levelColors[entry.final_level] || ''}`}>
                      {levelLabels[entry.final_level] || `L${entry.final_level}`}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.cycle}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
