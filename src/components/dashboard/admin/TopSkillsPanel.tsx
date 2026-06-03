import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';

import type { SkillRegistry, SkillRegistryItem } from '@/stores/skillRegistryStore';
import type { Skill } from '@/stores/skillStore';
import type { DomainSkillMap } from '@/stores/domainStore';
import { getLatestApprovedPerEmployee } from '@/lib/registryHistory';
import { getLevelColorClass } from '@/stores/competencyLevelStore';

interface Props {
  loading: boolean;
  registries: SkillRegistry[];
  items: Map<string, SkillRegistryItem[]>;
  reviewStatuses: Record<string, string | undefined>;
  skills: Skill[];
  mappings: DomainSkillMap[];
  /** Filter: if set, only consider employees in this domain. */
  domainFilter?: string;
  /** Filter: if set, only consider this skill category (skill_categories.id). */
  categoryFilter?: string;
  /** Threshold level used to define "covered". Default 4. */
  targetLevel?: number;
}

interface SkillStat {
  skillId: string;
  skillName: string;
  category: string;
  avg: number;
  ratedBy: number;
  atOrAboveTarget: number;
  required: number; // # of employees in domains that map this skill
}

export function TopSkillsPanel({
  loading,
  registries,
  items,
  reviewStatuses,
  skills,
  mappings,
  domainFilter,
  categoryFilter,
  targetLevel = 4,
}: Props) {
  const navigate = useNavigate();

  const stats = useMemo<SkillStat[]>(() => {
    const skillById = new Map(skills.map((s) => [s.id, s]));
    const latest = getLatestApprovedPerEmployee(registries, reviewStatuses);

    // Optional: scope to a single domain
    const scopedRegistries = new Map<string, SkillRegistry>();
    latest.forEach((reg, empId) => {
      if (domainFilter && reg.domain_id !== domainFilter) return;
      scopedRegistries.set(empId, reg);
    });

    // Required denominator per skill: # employees whose domain requires the skill
    const requiredBySkill = new Map<string, number>();
    scopedRegistries.forEach((reg) => {
      mappings
        .filter((m) => m.domain_id === reg.domain_id)
        .forEach((m) => {
          requiredBySkill.set(m.skill_id, (requiredBySkill.get(m.skill_id) ?? 0) + 1);
        });
    });

    const acc = new Map<string, { sum: number; n: number; meets: number }>();
    scopedRegistries.forEach((reg) => {
      (items.get(reg.id) ?? []).forEach((i) => {
        if (i.self_score === null || i.self_score === undefined) return;
        const sk = skillById.get(i.skill_id);
        if (!sk || sk.status !== 'active') return;
        if (categoryFilter && sk.category_id !== categoryFilter) return;
        const cur = acc.get(i.skill_id) ?? { sum: 0, n: 0, meets: 0 };
        cur.sum += i.self_score;
        cur.n += 1;
        if (i.self_score >= targetLevel) cur.meets += 1;
        acc.set(i.skill_id, cur);
      });
    });

    return Array.from(acc.entries())
      .map<SkillStat | null>(([skillId, v]) => {
        const sk = skillById.get(skillId);
        if (!sk) return null;
        return {
          skillId,
          skillName: sk.skill_name,
          category: sk.skill_category || 'Uncategorised',
          avg: v.sum / v.n,
          ratedBy: v.n,
          atOrAboveTarget: v.meets,
          required: requiredBySkill.get(skillId) ?? v.n,
        };
      })
      .filter((s): s is SkillStat => !!s);
  }, [registries, items, reviewStatuses, skills, mappings, domainFilter, categoryFilter, targetLevel]);

  const top = useMemo(
    () =>
      stats
        .slice()
        .sort((a, b) => b.avg - a.avg || b.ratedBy - a.ratedBy)
        .slice(0, 5),
    [stats],
  );

  const gaps = useMemo(
    () =>
      stats
        .filter((s) => s.required > 0 && s.atOrAboveTarget < s.required)
        .map((s) => ({ ...s, gapRatio: 1 - s.atOrAboveTarget / Math.max(1, s.required) }))
        .sort((a, b) => b.gapRatio - a.gapRatio || b.required - a.required)
        .slice(0, 5),
    [stats],
  );

  const renderTable = (rows: SkillStat[], emptyHint: string, gapsMode = false) => {
    if (loading) return <Skeleton className="h-40 w-full" />;
    if (rows.length === 0) {
      return (
        <EmptyState
          compact
          icon={Sparkles}
          title="No data yet"
          description={emptyHint}
        />
      );
    }
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">Skill</th>
            <th className="px-2 py-1.5 text-right font-medium">{gapsMode ? 'At ≥ L' + targetLevel : 'Avg'}</th>
            <th className="px-2 py-1.5 text-right font-medium">{gapsMode ? 'Required' : 'Raters'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.skillId}
              className="cursor-pointer border-t border-border transition hover:bg-muted/40"
              onClick={() =>
                navigate(`/all-registries?skill=${encodeURIComponent(r.skillId)}`)
              }
            >
              <td className="px-2 py-2">
                <div className="truncate font-medium text-foreground" title={r.skillName}>
                  {r.skillName}
                </div>
                <div className="text-[10px] text-muted-foreground">{r.category}</div>
              </td>
              <td className="px-2 py-2 text-right">
                {gapsMode ? (
                  <span className="font-semibold text-destructive">
                    {r.atOrAboveTarget}/{r.required}
                  </span>
                ) : (
                  <span
                    className={
                      'inline-flex h-5 min-w-[28px] items-center justify-center rounded-md px-1.5 text-[11px] font-medium ' +
                      getLevelColorClass(Math.round(r.avg))
                    }
                  >
                    {r.avg.toFixed(1)}
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-right text-muted-foreground">
                {gapsMode ? r.required : r.ratedBy}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="space-y-2">
        <SectionHeader title="Top 5 Skill Strengths" description="Highest avg approved levels." />
        <Card>
          <CardContent className="p-2">
            {renderTable(top, 'No approved registries match these filters.')}
          </CardContent>
        </Card>
      </div>
      <div className="space-y-2">
        <SectionHeader
          title="Top 5 Skill Gaps"
          description={`Required by domain mapping but not yet covered at L${targetLevel}+.`}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => navigate('/all-registries')}
            >
              See all <ArrowRight size={14} />
            </Button>
          }
        />
        <Card>
          <CardContent className="p-2">
            {renderTable(gaps, 'No coverage gaps found — nice!', true)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Re-export so widgets can show the warning icon if they want to.
export { AlertTriangle };
