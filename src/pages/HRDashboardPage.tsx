import { useState, useMemo, useCallback, useEffect } from 'react';
import { useReviewStore, OfficialSkillEntry, ManagerReview } from '@/stores/reviewStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useRegistryStore, RatingLevel } from '@/stores/registryStore';
import { useCompetencyLevelStore, getFormattedLevelLabel, getShortLevelLabel, getLevelColorClass } from '@/stores/competencyLevelStore';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Shield, Database, TrendingUp, Users, MessageSquare, Download,
  ClipboardCheck, Clock, CheckCircle, AlertTriangle, BarChart3, PieChart as PieIcon,
  FileText, Filter,
} from 'lucide-react';

// ── Shared constants ──

// levelLabels and levelFullLabels now come from competencyLevelStore

const CHART_COLORS = [
  'hsl(210, 75%, 42%)',   // primary
  'hsl(174, 62%, 40%)',   // accent
  'hsl(38, 92%, 50%)',    // warning
  'hsl(152, 60%, 40%)',   // success
  'hsl(0, 72%, 51%)',     // destructive
  'hsl(270, 60%, 50%)',
  'hsl(200, 70%, 55%)',
  'hsl(320, 55%, 48%)',
];

const LEVEL_CHART_COLORS: Record<number, string> = {
  1: 'hsl(215, 14%, 50%)',
  2: 'hsl(210, 75%, 55%)',
  3: 'hsl(174, 62%, 40%)',
  4: 'hsl(38, 92%, 50%)',
  5: 'hsl(152, 60%, 40%)',
};

// ── Stat Card ──

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        {icon} {label}
      </div>
      <span className="text-2xl font-bold text-card-foreground">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground mt-1">{sub}</span>}
    </div>
  );
}

// ── Level Badge ──

function LevelBadge({ level }: { level: number }) {
  const colors: Record<number, string> = {
    1: 'bg-muted text-muted-foreground',
    2: 'bg-info/15 text-info',
    3: 'bg-accent/15 text-accent',
    4: 'bg-warning/15 text-warning',
    5: 'bg-success/15 text-success',
  };
  return (
    <Badge className={`text-xs ${colors[level] ?? 'bg-muted text-muted-foreground'}`}>
      {levelLabels[level] ?? `L${level}`}
    </Badge>
  );
}

// ── Delta Indicator ──

function DeltaIndicator({ self, final: fin }: { self: number; final: number }) {
  const diff = fin - self;
  if (diff === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`text-xs font-medium ${diff > 0 ? 'text-success' : 'text-destructive'}`}>
      {diff > 0 ? '↑' : '↓'}{Math.abs(diff)}
    </span>
  );
}

// ── CSV Export ──

function exportToCSV(entries: OfficialSkillEntry[], skillMap: Map<string, { skill_name: string }>) {
  const headers = ['Employee ID', 'Tenant ID', 'Skill', 'Skill ID', 'Self Rating', 'AI Level', 'Final Level', 'Assessment Ref', 'Manager Comments', 'Cycle', 'Timestamp'];
  const rows = entries.map((e) => [
    e.employee_id,
    e.tenant_id,
    skillMap.get(e.skill_id)?.skill_name ?? e.skill_id,
    e.skill_id,
    `L${e.self_rating}`,
    `L${e.ai_level}`,
    `L${e.final_level}`,
    e.assessment_reference,
    `"${(e.manager_comments || '').replace(/"/g, '""')}"`,
    e.cycle,
    e.timestamp,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skill-registry-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Tab 1: Skill Registry ──

function RegistryTab({
  entries,
  skillMap,
  domainFilter,
  setDomainFilter,
  domains,
  domainMappings,
}: {
  entries: OfficialSkillEntry[];
  skillMap: Map<string, { skill_name: string; skill_category: string; id: string }>;
  domainFilter: string;
  setDomainFilter: (v: string) => void;
  domains: { id: string; name: string }[];
  domainMappings: { domain_id: string; skill_id: string }[];
}) {
  const filtered = useMemo(() => {
    if (domainFilter === 'all') return entries;
    const domainSkillIds = new Set(domainMappings.filter((m) => m.domain_id === domainFilter).map((m) => m.skill_id));
    return entries.filter((e) => domainSkillIds.has(e.skill_id));
  }, [entries, domainFilter, domainMappings]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Filter size={14} className="text-muted-foreground" />
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Filter by domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {domains.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => exportToCSV(filtered, skillMap)}
          disabled={filtered.length === 0}
        >
          <Download size={12} /> Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12">
          <Database size={28} className="text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No registry entries match this filter.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-xs text-muted-foreground">
                  <th className="py-2.5 px-4 text-left font-medium">Employee</th>
                  <th className="py-2.5 px-4 text-left font-medium">Skill</th>
                  <th className="py-2.5 px-4 text-center font-medium">Self</th>
                  <th className="py-2.5 px-4 text-center font-medium">AI</th>
                  <th className="py-2.5 px-4 text-center font-medium">Final</th>
                  <th className="py-2.5 px-4 text-center font-medium">Δ</th>
                  <th className="py-2.5 px-4 text-left font-medium">Comments</th>
                  <th className="py-2.5 px-4 text-left font-medium">Cycle</th>
                  <th className="py-2.5 px-4 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const skill = skillMap.get(entry.skill_id);
                  return (
                    <tr key={entry.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 text-xs text-foreground font-medium">{entry.employee_id}</td>
                      <td className="py-2.5 px-4 text-xs text-foreground">{skill?.skill_name ?? entry.skill_id}</td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge variant="outline" className="text-[10px]">L{entry.self_rating}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge variant="outline" className="text-[10px]">L{entry.ai_level}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-center"><LevelBadge level={entry.final_level} /></td>
                      <td className="py-2.5 px-4 text-center">
                        <DeltaIndicator self={entry.self_rating} final={entry.final_level} />
                      </td>
                      <td className="py-2.5 px-4 max-w-[200px]">
                        {entry.manager_comments ? (
                          <span className="text-xs text-muted-foreground italic truncate block">
                            <MessageSquare size={10} className="inline mr-1" />
                            {entry.manager_comments.slice(0, 80)}{entry.manager_comments.length > 80 ? '…' : ''}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">{entry.cycle}</td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Skill Distribution ──

function DistributionTab({
  entries,
  skillMap,
  domains,
  domainMappings,
}: {
  entries: OfficialSkillEntry[];
  skillMap: Map<string, { skill_name: string; id: string }>;
  domains: { id: string; name: string }[];
  domainMappings: { domain_id: string; skill_id: string }[];
}) {
  // Level distribution (pie)
  const levelDist = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    entries.forEach((e) => { counts[e.final_level] = (counts[e.final_level] ?? 0) + 1; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: levelLabels[Number(k)], value: v, level: Number(k) }));
  }, [entries]);

  // Per-domain avg level (bar)
  const domainAvg = useMemo(() => {
    return domains.map((d) => {
      const dSkills = new Set(domainMappings.filter((m) => m.domain_id === d.id).map((m) => m.skill_id));
      const domainEntries = entries.filter((e) => dSkills.has(e.skill_id));
      const avg = domainEntries.length > 0
        ? domainEntries.reduce((s, e) => s + e.final_level, 0) / domainEntries.length
        : 0;
      return { domain: d.name.length > 16 ? d.name.slice(0, 14) + '…' : d.name, avgLevel: Math.round(avg * 10) / 10, count: domainEntries.length };
    }).filter((d) => d.count > 0);
  }, [entries, domains, domainMappings]);

  // Per-skill level (bar)
  const skillAvg = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    entries.forEach((e) => {
      if (!map[e.skill_id]) map[e.skill_id] = { total: 0, count: 0 };
      map[e.skill_id].total += e.final_level;
      map[e.skill_id].count += 1;
    });
    return Object.entries(map).map(([id, { total, count }]) => ({
      skill: skillMap.get(id)?.skill_name ?? id,
      avgLevel: Math.round((total / count) * 10) / 10,
      count,
    })).sort((a, b) => b.avgLevel - a.avgLevel);
  }, [entries, skillMap]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center py-12">
        <BarChart3 size={28} className="text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Complete the assessment and review workflow to see distribution analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Level Distribution Pie */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <PieIcon size={14} className="text-primary" /> Level Distribution
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={levelDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {levelDist.map((entry) => (
                    <Cell key={entry.level} fill={LEVEL_CHART_COLORS[entry.level] ?? CHART_COLORS[0]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Domain Average Bar */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-accent" /> Average Level by Domain
          </h3>
          {domainAvg.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No domain-linked entries yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domainAvg} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                  <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="domain" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: number) => [v.toFixed(1), 'Avg Level']} />
                  <Bar dataKey="avgLevel" fill="hsl(174, 62%, 40%)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Per-skill bar chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <BarChart3 size={14} className="text-primary" /> Average Validated Level by Skill
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skillAvg} margin={{ left: 10, right: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
              <XAxis dataKey="skill" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
              <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [v.toFixed(1), 'Avg Level']}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="avgLevel" radius={[4, 4, 0, 0]} barSize={32}>
                {skillAvg.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Assessment Tracking ──

function TrackingTab({
  reviews,
  domains,
}: {
  reviews: ManagerReview[];
  domains: { id: string; name: string }[];
}) {
  const { assessments } = useAssessmentStore();
  const { attempts } = useAttemptStore();
  const domainMap = useMemo(() => new Map(domains.map((d) => [d.id, d.name])), [domains]);

  const totalAssessments = assessments.length;
  const completedAssessments = assessments.filter((a) => a.status === 'completed' || a.status === 'reviewed').length;
  const pendingReviews = reviews.filter((r) => r.status !== 'completed').length;
  const completedReviews = reviews.filter((r) => r.status === 'completed').length;

  // Per-status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, reviewed: 0 };
    assessments.forEach((a) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return counts;
  }, [assessments]);

  const statusStyle: Record<string, { bg: string; icon: React.ReactNode }> = {
    pending: { bg: 'bg-muted text-muted-foreground', icon: <Clock size={12} /> },
    in_progress: { bg: 'bg-info/15 text-info', icon: <Clock size={12} /> },
    completed: { bg: 'bg-success/15 text-success', icon: <CheckCircle size={12} /> },
    reviewed: { bg: 'bg-accent/15 text-accent', icon: <Shield size={12} /> },
  };

  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<FileText size={14} />} label="Total Assessments" value={totalAssessments} />
        <StatCard icon={<CheckCircle size={14} />} label="Completed" value={completedAssessments} sub={totalAssessments > 0 ? `${Math.round((completedAssessments / totalAssessments) * 100)}% rate` : undefined} />
        <StatCard icon={<AlertTriangle size={14} />} label="Pending Reviews" value={pendingReviews} />
        <StatCard icon={<Shield size={14} />} label="Reviews Done" value={completedReviews} />
      </div>

      {/* Assessment list */}
      {assessments.length === 0 ? (
        <div className="flex flex-col items-center py-12">
          <ClipboardCheck size={28} className="text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No assessments created yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-xs text-muted-foreground">
                  <th className="py-2.5 px-4 text-left font-medium">Employee</th>
                  <th className="py-2.5 px-4 text-left font-medium">Domain</th>
                  <th className="py-2.5 px-4 text-center font-medium">Questions</th>
                  <th className="py-2.5 px-4 text-center font-medium">AI Score</th>
                  <th className="py-2.5 px-4 text-center font-medium">Assessment</th>
                  <th className="py-2.5 px-4 text-center font-medium">Review</th>
                  <th className="py-2.5 px-4 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => {
                  const attempt = attempts.find((at) => at.assessment_id === a.id);
                  const review = reviews.find((r) => r.assessment_id === a.id);
                  const st = statusStyle[a.status] ?? statusStyle.pending;
                  const rvSt = review ? (statusStyle[review.status] ?? statusStyle.pending) : null;

                  return (
                    <tr key={a.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 text-xs text-foreground font-medium">{a.employee_id}</td>
                      <td className="py-2.5 px-4 text-xs text-foreground">{domainMap.get(a.domain_id) ?? a.domain_id}</td>
                      <td className="py-2.5 px-4 text-center text-xs text-muted-foreground">{a.assessment_questions.length}</td>
                      <td className="py-2.5 px-4 text-center">
                        {attempt?.total_ai_score != null ? (
                          <span className={`text-xs font-semibold ${
                            attempt.total_ai_score >= 75 ? 'text-success' :
                            attempt.total_ai_score >= 50 ? 'text-warning' : 'text-destructive'
                          }`}>{attempt.total_ai_score}%</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge className={`text-[10px] gap-1 ${st.bg}`}>
                          {st.icon} {a.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {rvSt ? (
                          <Badge className={`text-[10px] gap-1 ${rvSt.bg}`}>
                            {rvSt.icon} {review!.status}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

export default function HRDashboardPage() {
  const { officialEntries, reviews, fetchReviews } = useReviewStore();
  const { skills, fetchSkills } = useSkillStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { assessments, fetchAssessments } = useAssessmentStore();
  const { fetchAttempts } = useAttemptStore();
  const { currentRole } = useAuth();
  const [domainFilter, setDomainFilter] = useState('all');

  useEffect(() => {
    fetchAssessments(); fetchAttempts(); fetchReviews(); fetchSkills(); fetchDomains();
  }, [fetchAssessments, fetchAttempts, fetchReviews, fetchSkills, fetchDomains]);

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const isHROrAdmin = currentRole === 'admin';

  // Stats
  const uniqueEmployees = new Set(officialEntries.map((e) => e.employee_id)).size;
  const uniqueSkills = new Set(officialEntries.map((e) => e.skill_id)).size;
  const avgLevel = officialEntries.length > 0
    ? (officialEntries.reduce((s, e) => s + e.final_level, 0) / officialEntries.length).toFixed(1)
    : '—';
  const pendingReviews = reviews.filter((r) => r.status !== 'completed').length;

  if (!isHROrAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Shield size={32} className="mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold text-card-foreground">HR / Admin Access Required</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Switch to HR or Admin role to view the organizational skill dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Organization-wide skill analytics, validated registry, and assessment pipeline tracking.
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Database size={14} />} label="Registry Entries" value={officialEntries.length} />
        <StatCard icon={<Users size={14} />} label="Employees Assessed" value={uniqueEmployees} />
        <StatCard icon={<TrendingUp size={14} />} label="Avg. Validated Level" value={avgLevel} sub={`across ${uniqueSkills} skills`} />
        <StatCard
          icon={<AlertTriangle size={14} />}
          label="Pending Reviews"
          value={pendingReviews}
          sub={`${assessments.length} total assessments`}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="registry" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="registry" className="gap-1.5 text-xs">
            <FileText size={12} /> Skill Registry
          </TabsTrigger>
          <TabsTrigger value="distribution" className="gap-1.5 text-xs">
            <BarChart3 size={12} /> Distribution
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-1.5 text-xs">
            <ClipboardCheck size={12} /> Assessment Tracking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registry">
          <RegistryTab
            entries={officialEntries}
            skillMap={skillMap}
            domainFilter={domainFilter}
            setDomainFilter={setDomainFilter}
            domains={domains}
            domainMappings={mappings}
          />
        </TabsContent>

        <TabsContent value="distribution">
          <DistributionTab
            entries={officialEntries}
            skillMap={skillMap}
            domains={domains}
            domainMappings={mappings}
          />
        </TabsContent>

        <TabsContent value="tracking">
          <TrackingTab reviews={reviews} domains={domains} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
