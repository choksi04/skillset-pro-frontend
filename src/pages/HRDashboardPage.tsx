import { useMemo } from 'react';
import { useReviewStore, OfficialSkillEntry } from '@/stores/reviewStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { ratingLabels, RatingLevel } from '@/stores/registryStore';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Database, TrendingUp, Users, MessageSquare,
} from 'lucide-react';

const levelLabels: Record<number, string> = {
  1: 'L1 – Basic Awareness',
  2: 'L2 – Working Knowledge',
  3: 'L3 – Independent',
  4: 'L4 – Advanced',
  5: 'L5 – Expert',
};

const levelColors: Record<number, string> = {
  1: 'bg-muted text-muted-foreground',
  2: 'bg-info/15 text-info',
  3: 'bg-accent/15 text-accent',
  4: 'bg-warning/15 text-warning',
  5: 'bg-success/15 text-success',
};

function LevelBadge({ level }: { level: number }) {
  return (
    <Badge className={`text-xs ${levelColors[level] ?? 'bg-muted text-muted-foreground'}`}>
      {levelLabels[level] ?? `L${level}`}
    </Badge>
  );
}

function DeltaIndicator({ self, ai, final: fin }: { self: number; ai: number; final: number }) {
  const diff = fin - self;
  if (diff === 0) return <span className="text-xs text-muted-foreground">No change</span>;
  return (
    <span className={`text-xs font-medium ${diff > 0 ? 'text-success' : 'text-destructive'}`}>
      {diff > 0 ? '↑' : '↓'} {Math.abs(diff)} level{Math.abs(diff) > 1 ? 's' : ''}
    </span>
  );
}

export default function HRDashboardPage() {
  const { officialEntries } = useReviewStore();
  const { skills } = useSkillStore();
  const { domains } = useDomainStore();
  const { assessments } = useAssessmentStore();
  const { currentRole } = useAuth();

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  const isHROrAdmin = currentRole === 'hr' || currentRole === 'admin';

  // Stats
  const uniqueEmployees = new Set(officialEntries.map((e) => e.employee_id)).size;
  const uniqueSkills = new Set(officialEntries.map((e) => e.skill_id)).size;
  const avgLevel = officialEntries.length > 0
    ? (officialEntries.reduce((s, e) => s + e.final_level, 0) / officialEntries.length).toFixed(1)
    : '—';

  // Group entries by employee
  const byEmployee = useMemo(() => {
    const map = new Map<string, OfficialSkillEntry[]>();
    for (const entry of officialEntries) {
      const list = map.get(entry.employee_id) ?? [];
      list.push(entry);
      map.set(entry.employee_id, list);
    }
    return map;
  }, [officialEntries]);

  if (!isHROrAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Shield size={32} className="mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold text-card-foreground">HR / Admin Access Required</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Switch to HR or Admin role to view the validated skill registry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Official validated skill registry — final levels approved through the manager review process.
      </p>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Database size={14} /> Registry Entries
          </div>
          <span className="text-2xl font-bold text-card-foreground">{officialEntries.length}</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Users size={14} /> Employees Assessed
          </div>
          <span className="text-2xl font-bold text-card-foreground">{uniqueEmployees}</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp size={14} /> Avg. Validated Level
          </div>
          <span className="text-2xl font-bold text-card-foreground">{avgLevel}</span>
        </div>
      </div>

      {officialEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Database size={32} className="text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-1">No Registry Entries Yet</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Validated skill entries will appear here after managers complete their reviews and approve skill levels.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Validated Skill Registry</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-xs text-muted-foreground">
                    <th className="py-2.5 px-4 text-left font-medium">Employee</th>
                    <th className="py-2.5 px-4 text-left font-medium">Skill</th>
                    <th className="py-2.5 px-4 text-center font-medium">Self Rating</th>
                    <th className="py-2.5 px-4 text-center font-medium">AI Level</th>
                    <th className="py-2.5 px-4 text-center font-medium">Final Level</th>
                    <th className="py-2.5 px-4 text-center font-medium">Delta</th>
                    <th className="py-2.5 px-4 text-left font-medium">Manager Comments</th>
                    <th className="py-2.5 px-4 text-left font-medium">Cycle</th>
                    <th className="py-2.5 px-4 text-left font-medium">Validated At</th>
                  </tr>
                </thead>
                <tbody>
                  {officialEntries.map((entry) => {
                    const skill = skillMap.get(entry.skill_id);
                    return (
                      <tr key={entry.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 text-xs text-foreground font-medium">{entry.employee_id}</td>
                        <td className="py-3 px-4 text-xs text-foreground">{skill?.skill_name ?? entry.skill_id}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className="text-xs">L{entry.self_rating}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className="text-xs">L{entry.ai_level}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <LevelBadge level={entry.final_level} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <DeltaIndicator self={entry.self_rating} ai={entry.ai_level} final={entry.final_level} />
                        </td>
                        <td className="py-3 px-4">
                          {entry.manager_comments ? (
                            <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                              <MessageSquare size={10} /> {entry.manager_comments.slice(0, 60)}{entry.manager_comments.length > 60 ? '…' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">{entry.cycle}</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
