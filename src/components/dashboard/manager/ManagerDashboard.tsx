import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ClipboardCheck,
  Gauge,
  RefreshCcw,
  ListChecks,
  Inbox,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSkillRegistryStore } from '@/stores/skillRegistryStore';
import { useRegistryReviewStore } from '@/stores/registryReviewStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useCompetencyLevelStore, getLevelColorClass } from '@/stores/competencyLevelStore';
import { deriveRegistryStatus } from '@/lib/registryStatus';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { StatCard } from '../shared/StatCard';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { ActionList, type ActionListItem } from '../shared/ActionList';

interface TeamMember {
  id: string;
  full_name: string;
  designation: string | null;
}

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const day = Math.floor(diff / 86400000);
  if (day === 0) return 'today';
  if (day === 1) return '1 day ago';
  return `${day} days ago`;
}

export function ManagerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const managerDomain = user?.domain_id ?? null;

  const { registries, items, fetchRegistries, fetchItemsForRegistries, initialized: regInit } =
    useSkillRegistryStore();
  const { reviewStatuses, fetchReviewStatusesForRegistries } = useRegistryReviewStore();
  const { domains, mappings, fetchDomains, initialized: domInit } = useDomainStore();
  const { skills, fetchSkills, initialized: skillInit } = useSkillStore();
  const { reviews, fetchReviews, initialized: reviewInit } = useReviewStore();
  const { fetchLevels, initialized: levelInit } = useCompetencyLevelStore();

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  useEffect(() => {
    if (!regInit) fetchRegistries();
    if (!domInit) fetchDomains();
    if (!skillInit) fetchSkills();
    if (!reviewInit) fetchReviews();
    if (!levelInit) fetchLevels();
  }, [
    regInit, domInit, skillInit, reviewInit, levelInit,
    fetchRegistries, fetchDomains, fetchSkills, fetchReviews, fetchLevels,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!managerDomain) {
      setTeam([]);
      setTeamLoading(false);
      return;
    }
    setTeamLoading(true);
    supabase
      .from('users')
      .select('id, full_name, designation, role, status')
      .eq('domain_id', managerDomain)
      .eq('status', 'active')
      .is('deleted_on', null)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Failed to load team:', error);
          setTeam([]);
        } else {
          setTeam(
            (data ?? []).map((u: any) => ({
              id: u.id,
              full_name: u.full_name,
              designation: u.designation ?? null,
            })),
          );
        }
        setTeamLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [managerDomain]);

  const teamIds = useMemo(() => new Set(team.map((t) => t.id)), [team]);
  const teamById = useMemo(() => new Map(team.map((t) => [t.id, t])), [team]);

  const teamRegistries = useMemo(
    () => registries.filter((r) => teamIds.has(r.employee_id)),
    [registries, teamIds],
  );

  useEffect(() => {
    if (teamRegistries.length === 0) return;
    fetchItemsForRegistries(teamRegistries.map((r) => r.id));
    fetchReviewStatusesForRegistries(teamRegistries.map((r) => r.id));
  }, [teamRegistries, fetchItemsForRegistries, fetchReviewStatusesForRegistries]);

  const totalDomainSkills = useMemo(
    () => (managerDomain ? mappings.filter((m) => m.domain_id === managerDomain).length : 0),
    [mappings, managerDomain],
  );

  const latestPerMember = useMemo(() => {
    const out: Record<
      string,
      {
        registry: (typeof registries)[number] | undefined;
        status: ReturnType<typeof deriveRegistryStatus>;
      }
    > = {};
    team.forEach((m) => {
      const mine = teamRegistries.filter((r) => r.employee_id === m.id);
      const latest = mine[0];
      const its = latest ? items.get(latest.id) ?? [] : [];
      const ratedCount = its.filter((i) => i.self_score !== null && i.self_score !== undefined)
        .length;
      out[m.id] = {
        registry: latest,
        status: deriveRegistryStatus({
          registryStatus: latest?.status ?? null,
          ratedCount,
          totalSkills: totalDomainSkills,
          reviewStatus: latest ? reviewStatuses[latest.id] ?? null : null,
        }),
      };
    });
    return out;
  }, [team, teamRegistries, items, reviewStatuses, totalDomainSkills]);

  const pendingRegistryReviews = useMemo(() => {
    return teamRegistries.filter(
      (r) => r.status === 'submitted' && reviewStatuses[r.id] !== 'approved',
    );
  }, [teamRegistries, reviewStatuses]);

  const pendingAssessmentReviews = useMemo(() => {
    if (!user) return [];
    return reviews.filter(
      (r) =>
        r.reviewer_id === user.id &&
        (r.status === 'pending' || r.status === 'in_progress'),
    );
  }, [reviews, user]);

  const totalPendingCount = pendingRegistryReviews.length + pendingAssessmentReviews.length;

  const teamAvgLevel = useMemo(() => {
    const approved = teamRegistries.filter(
      (r) => r.status === 'submitted' && reviewStatuses[r.id] === 'approved',
    );
    if (approved.length === 0) return null;
    let sum = 0;
    let n = 0;
    approved.forEach((r) => {
      const its = items.get(r.id) ?? [];
      its.forEach((i) => {
        if (i.self_score !== null && i.self_score !== undefined) {
          sum += i.self_score;
          n += 1;
        }
      });
    });
    if (n === 0) return null;
    return sum / n;
  }, [teamRegistries, reviewStatuses, items]);

  const reassessmentsOpen = pendingAssessmentReviews.length;
  const oldestReassessmentDays = useMemo(() => {
    if (pendingAssessmentReviews.length === 0) return null;
    const oldest = pendingAssessmentReviews.reduce((acc, r) =>
      new Date(r.created_at).getTime() < new Date(acc.created_at).getTime() ? r : acc,
    );
    return Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / 86400000);
  }, [pendingAssessmentReviews]);

  const matrix = useMemo(() => {
    if (!managerDomain) return null;
    const domainSkills = mappings
      .filter((m) => m.domain_id === managerDomain)
      .map((m) => skills.find((s) => s.id === m.skill_id))
      .filter((s): s is NonNullable<typeof s> => !!s);

    const topSkills = domainSkills.slice(0, 8);

    const cells: Record<string, Record<string, number | null>> = {};
    team.forEach((m) => {
      cells[m.id] = {};
      const mine = teamRegistries.filter((r) => r.employee_id === m.id);
      const approved = mine.find(
        (r) => r.status === 'submitted' && reviewStatuses[r.id] === 'approved',
      );
      const source = approved ?? mine[0];
      const its = source ? items.get(source.id) ?? [] : [];
      topSkills.forEach((s) => {
        const it = its.find((i) => i.skill_id === s.id);
        cells[m.id][s.id] = it?.self_score ?? null;
      });
    });

    return { skills: topSkills, cells };
  }, [managerDomain, mappings, skills, team, teamRegistries, items, reviewStatuses]);

  const reviewQueueItems: ActionListItem[] = useMemo(() => {
    const out: ActionListItem[] = [];

    pendingRegistryReviews
      .slice()
      .sort(
        (a, b) =>
          new Date(a.submitted_at ?? a.created_at).getTime() -
          new Date(b.submitted_at ?? b.created_at).getTime(),
      )
      .slice(0, 5)
      .forEach((r) => {
        const m = teamById.get(r.employee_id);
        out.push({
          id: `reg-${r.id}`,
          title: `Registry — ${m?.full_name ?? 'Unknown'}`,
          description: `v${r.version_number} · submitted ${formatRelative(r.submitted_at ?? r.created_at)}`,
          badge: <Badge variant="outline" className="text-[11px]">Registry</Badge>,
          icon: ClipboardCheck,
          onClick: () => navigate(`/team-registry/${r.id}`),
        });
      });

    pendingAssessmentReviews
      .slice()
      .sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .slice(0, 5)
      .forEach((r) => {
        out.push({
          id: `rev-${r.id}`,
          title: `Assessment — ${r.employee_name}`,
          description: `assigned ${formatRelative(r.created_at)}`,
          badge: <Badge variant="outline" className="text-[11px]">Assessment</Badge>,
          icon: ClipboardCheck,
          onClick: () => navigate(`/manager-reviews`),
        });
      });

    return out;
  }, [pendingRegistryReviews, pendingAssessmentReviews, teamById, navigate]);

  const stuckItems: ActionListItem[] = useMemo(() => {
    const out: ActionListItem[] = [];
    const STUCK_DAYS = 14;
    Object.entries(latestPerMember).forEach(([memberId, info]) => {
      const m = teamById.get(memberId);
      if (!m) return;
      if (!info.registry) {
        if (totalDomainSkills > 0) {
          out.push({
            id: `not-started-${memberId}`,
            title: m.full_name,
            description: 'Has not started their registry yet',
            badge: <Badge variant="outline" className="text-[11px]">Not Started</Badge>,
            icon: AlertTriangle,
          });
        }
        return;
      }
      if (info.status === 'approved') return;
      const ts = info.registry.modified_at ?? info.registry.created_at;
      const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
      if (days >= STUCK_DAYS) {
        out.push({
          id: `stuck-${memberId}`,
          title: m.full_name,
          description: `${info.status.replace('_', ' ')} for ${days} days`,
          badge: <Badge variant="outline" className="text-[11px]">{info.status.replace('_', ' ')}</Badge>,
          icon: AlertTriangle,
          onClick: info.registry
            ? () => navigate(`/team-registry/${info.registry!.id}`)
            : undefined,
        });
      }
    });
    return out.slice(0, 5);
  }, [latestPerMember, teamById, totalDomainSkills, navigate]);

  const loading =
    !regInit || !domInit || !skillInit || !reviewInit || !levelInit || teamLoading;
  const firstName = user?.full_name?.split(' ')[0];

  if (!managerDomain && !loading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Manager dashboard.</p>
        </div>
        <EmptyState
          icon={Users}
          title="You're not assigned to a domain yet"
          description="Ask an admin to assign you to a domain so you can see your team's skill data here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your team's capability and review queue at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Team Size"
          value={team.length}
          hint={
            domains.find((d) => d.id === managerDomain)?.name
              ? `in ${domains.find((d) => d.id === managerDomain)?.name}`
              : 'in your domain'
          }
          icon={Users}
          tone="primary"
          loading={loading}
        />
        <StatCard
          label="Pending My Review"
          value={totalPendingCount}
          hint={
            totalPendingCount === 0
              ? 'Nothing waiting on you'
              : `${pendingRegistryReviews.length} registry · ${pendingAssessmentReviews.length} assessment`
          }
          icon={Inbox}
          tone="warning"
          loading={loading}
          onClick={
            totalPendingCount > 0
              ? () =>
                  navigate(
                    pendingRegistryReviews.length >= pendingAssessmentReviews.length
                      ? '/team-registry'
                      : '/manager-reviews',
                  )
              : undefined
          }
        />
        <StatCard
          label="Team Avg Validated Level"
          value={teamAvgLevel !== null ? teamAvgLevel.toFixed(1) : '—'}
          hint={teamAvgLevel !== null ? 'across approved registries' : 'No approvals yet'}
          icon={Gauge}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Reassessments Open"
          value={reassessmentsOpen}
          hint={
            reassessmentsOpen === 0
              ? 'None outstanding'
              : oldestReassessmentDays !== null
                ? `oldest: ${oldestReassessmentDays}d`
                : ''
          }
          icon={RefreshCcw}
          tone="info"
          loading={loading}
        />
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="Team Skill Matrix"
          description="Each member's most recent rating across the top skills in your domain."
          action={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => navigate('/team-registry')}
            >
              Open team registry <ArrowRight size={14} />
            </Button>
          }
        />
        <Card>
          <CardContent className="p-4">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : !matrix || matrix.skills.length === 0 || team.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No matrix data yet"
                description={
                  team.length === 0
                    ? 'No team members in your domain yet.'
                    : 'No skills mapped to this domain yet — ask an admin to map domain skills.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                        Member
                      </th>
                      {matrix.skills.map((s) => (
                        <th
                          key={s.id}
                          className="px-2 py-2 text-center font-medium text-muted-foreground"
                          title={s.skill_name}
                        >
                          <span className="line-clamp-2 inline-block max-w-[110px]">
                            {s.skill_name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                          <div className="truncate" title={m.full_name}>{m.full_name}</div>
                          {m.designation ? (
                            <div className="truncate text-[10px] text-muted-foreground">
                              {m.designation}
                            </div>
                          ) : null}
                        </td>
                        {matrix.skills.map((s) => {
                          const v = matrix.cells[m.id]?.[s.id] ?? null;
                          return (
                            <td key={s.id} className="px-2 py-2 text-center">
                              {v === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span
                                  className={
                                    'inline-flex h-6 min-w-[28px] items-center justify-center rounded-md px-1.5 text-[11px] font-medium ' +
                                    getLevelColorClass(Math.round(v))
                                  }
                                >
                                  L{Math.round(v)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <SectionHeader
            title="Review Queue"
            description="Items waiting on your action, oldest first."
          />
          <ActionList
            items={reviewQueueItems}
            loading={loading}
            emptyTitle="Nothing waiting"
            emptyDescription="You have no pending registry or assessment reviews."
            emptyIcon={Inbox}
          />
        </div>
        <div className="space-y-3">
          <SectionHeader
            title="Stuck Employees"
            description="Team members blocked or inactive for 14+ days."
          />
          <ActionList
            items={stuckItems}
            loading={loading}
            emptyTitle="No one's stuck"
            emptyDescription="Everyone is moving along."
            emptyIcon={Users}
          />
        </div>
      </div>
    </div>
  );
}
