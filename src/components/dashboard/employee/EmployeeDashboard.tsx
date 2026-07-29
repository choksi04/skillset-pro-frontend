import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  ClipboardCheck,
  Gauge,
  ListChecks,
  Sparkles,
  CheckCircle2,
  Clock,
  PlayCircle,
  ArrowRight,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { useAuth } from '@/contexts/AuthContext';
import { useSkillRegistryStore } from '@/stores/skillRegistryStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useRegistryReviewStore } from '@/stores/registryReviewStore';
import { useAssignmentStore } from '@/stores/assignmentStore';
import { useCompetencyLevelStore, getRatingLabels } from '@/stores/competencyLevelStore';
import { computeRegistryMetrics } from '@/lib/registryMetrics';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RegistryStatusBadge } from '@/components/registry/RegistryStatusBadge';
import { StatCard } from '../shared/StatCard';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { ActionList, type ActionListItem } from '../shared/ActionList';

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function EmployeeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { registries, items, fetchRegistries, fetchItemsForRegistries, initialized: regInit } =
    useSkillRegistryStore();
  const { domains, mappings, fetchDomains, initialized: domInit } = useDomainStore();
  const { skills, categories, fetchSkills, initialized: skillInit } = useSkillStore();
  const {
    reviewStatuses,
    reviews: reviewMap,
    fetchReviewStatusesForRegistries,
    fetchReviewForRegistry,
  } = useRegistryReviewStore();
  const { assignments, fetchAssignments, initialized: assignInit } = useAssignmentStore();
  const { levels, fetchLevels, initialized: levelInit } = useCompetencyLevelStore();

  useEffect(() => {
    if (!user) return;
    if (!regInit) fetchRegistries(user.id);
    if (!domInit) fetchDomains();
    if (!skillInit) fetchSkills();
    if (!assignInit) fetchAssignments();
    if (!levelInit) fetchLevels();
  }, [
    user, regInit, domInit, skillInit, assignInit, levelInit,
    fetchRegistries, fetchDomains, fetchSkills, fetchAssignments, fetchLevels,
  ]);

  // Pre-fetch items + review statuses for this employee's registries
  useEffect(() => {
    if (!user) return;
    const mine = registries.filter((r) => r.employee_id === user.id);
    if (mine.length === 0) return;
    fetchItemsForRegistries(mine.map((r) => r.id));
    fetchReviewStatusesForRegistries(mine.map((r) => r.id));
  }, [registries, user, fetchItemsForRegistries, fetchReviewStatusesForRegistries]);

  const myRegistries = useMemo(
    () => (user ? registries.filter((r) => r.employee_id === user.id) : []),
    [registries, user],
  );

  const currentRegistry = myRegistries[0]; // sorted desc by version
  const currentItems = currentRegistry ? items.get(currentRegistry.id) ?? [] : [];

  // Shared metric rules (see src/lib/registryMetrics.ts) — active domain skills only.
  const domainSkillIds = useMemo(() => {
    if (!user?.domain_id) return [] as string[];
    return mappings
      .filter((m) => m.domain_id === user.domain_id)
      .map((m) => m.skill_id)
      .filter((id) => skills.some((s) => s.id === id && s.status === 'active'));
  }, [mappings, user, skills]);

  const registryMetrics = useMemo(() => {
    return computeRegistryMetrics({
      registryStatus: (currentRegistry?.status as 'draft' | 'submitted') ?? null,
      items: currentRegistry ? items.get(currentRegistry.id) : [],
      domainSkillIds,
      maxLevel: Math.max(5, ...levels.map((l) => l.level)),
      reviewStatus: currentRegistry
        ? ((reviewStatuses[currentRegistry.id] as 'pending' | 'approved' | 'completed' | undefined) ??
          null)
        : null,
    });
  }, [currentRegistry, items, domainSkillIds, levels, reviewStatuses]);

  const status = registryMetrics.status;
  const statusLoading = registryMetrics.loading;

  // Latest approved registry for level metrics
  const latestApproved = useMemo(() => {
    return myRegistries.find(
      (r) => r.status === 'submitted' && reviewStatuses[r.id] === 'approved',
    );
  }, [myRegistries, reviewStatuses]);

  // Lazy-load the manager review for the latest approved registry to drive Self vs Final
  useEffect(() => {
    if (latestApproved && !reviewMap.get(latestApproved.id)) {
      fetchReviewForRegistry(latestApproved.id);
    }
  }, [latestApproved, reviewMap, fetchReviewForRegistry]);

  const latestApprovedItems = latestApproved ? items.get(latestApproved.id) ?? [] : [];
  const latestReview = latestApproved ? reviewMap.get(latestApproved.id) : undefined;

  // Skills assessed = skills with either a final manager_score or self_score in latest approved
  const skillsAssessed = useMemo(() => {
    if (!latestApproved) return 0;
    if (latestReview) {
      return latestReview.items.filter((i) => i.manager_score !== null).length;
    }
    return latestApprovedItems.length;
  }, [latestApproved, latestReview, latestApprovedItems]);

  const myAvgLevel = useMemo(() => {
    if (latestApproved && latestReview && latestReview.items.length > 0) {
      const scored = latestReview.items.filter((i) => i.manager_score !== null);
      if (scored.length === 0) return null;
      const sum = scored.reduce((a, b) => a + (b.manager_score ?? 0), 0);
      return sum / scored.length;
    }
    if (currentItems.length > 0) {
      const sum = currentItems.reduce((a, b) => a + (b.self_score ?? 0), 0);
      return sum / currentItems.length;
    }
    return null;
  }, [latestApproved, latestReview, currentItems]);

  // Open tasks: assessment assignments in 'new' or 'in_progress'
  const openAssignments = useMemo(() => {
    if (!user) return [];
    return assignments.filter(
      (a) => a.employee_id === user.id && (a.status === 'new' || a.status === 'in_progress'),
    );
  }, [assignments, user]);

  // ─── Skill Snapshot data: validated levels per category ───
  const snapshotData = useMemo(() => {
    const skillById = new Map(skills.map((s) => [s.id, s]));
    const catById = new Map(categories.map((c) => [c.id, c]));

    // Prefer manager-validated levels from latest approved review; fall back to self-scores in current registry.
    const sourceItems: { skillId: string; level: number }[] = [];
    if (latestReview && latestReview.items.length > 0) {
      latestReview.items.forEach((it) => {
        if (it.manager_score !== null && it.manager_score !== undefined) {
          sourceItems.push({ skillId: it.skill_id, level: it.manager_score });
        }
      });
    } else if (currentItems.length > 0) {
      currentItems.forEach((it) => {
        if (it.self_score) sourceItems.push({ skillId: it.skill_id, level: it.self_score });
      });
    }

    if (sourceItems.length === 0) return [];

    const byCat = new Map<string, { sum: number; count: number; name: string }>();
    sourceItems.forEach(({ skillId, level }) => {
      const skill = skillById.get(skillId);
      if (!skill) return;
      const cat = catById.get(skill.category_id);
      const key = cat?.id ?? 'uncategorised';
      const name = cat?.name ?? 'Uncategorised';
      const cur = byCat.get(key) ?? { sum: 0, count: 0, name };
      cur.sum += level;
      cur.count += 1;
      byCat.set(key, cur);
    });
    return Array.from(byCat.values())
      .map((v) => ({ category: v.name, level: Number((v.sum / v.count).toFixed(2)) }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [skills, categories, latestReview, currentItems]);

  const ratingLabels = getRatingLabels(levels);
  const levelMax = Math.max(5, ...levels.map((l) => l.level));

  const loading = !regInit || !domInit || !skillInit || !assignInit || !levelInit;
  const firstName = user?.full_name?.split(' ')[0];

  // ─── Action lane ───
  const actionItems: ActionListItem[] = [];
  if (!user?.domain_id) {
    actionItems.push({
      id: 'no-domain',
      title: 'Get assigned to a domain',
      description: 'Ask your admin or manager to assign you to a domain so you can build a registry.',
      icon: Sparkles,
    });
  } else if (statusLoading) {
    // metrics still loading — avoid a misleading Draft/Incomplete nudge
  } else if (status === 'not_started') {
    actionItems.push({
      id: 'start-registry',
      title: 'Start your skill registry',
      description: 'Self-rate the skills in your domain to begin.',
      icon: ClipboardList,
      onClick: () => navigate('/skill-registry'),
    });
  } else if (status === 'draft' || status === 'incomplete') {
    actionItems.push({
      id: 'finish-registry',
      title: status === 'draft' ? 'Finish your draft registry' : 'Complete your registry',
      description:
        status === 'draft'
          ? 'Continue rating your skills and submit when ready.'
          : 'Some skills still need a self-rating before review.',
      icon: ClipboardList,
      onClick: () => navigate('/skill-registry'),
    });
  } else if (status === 'review_pending') {
    actionItems.push({
      id: 'awaiting-review',
      title: 'Awaiting manager review',
      description: 'Your registry is with your manager.',
      icon: Clock,
    });
  }

  openAssignments.slice(0, 3).forEach((a) => {
    actionItems.push({
      id: `assign-${a.id}`,
      title: a.status === 'in_progress' ? 'Resume your assessment' : 'Take an assigned assessment',
      description: a.status === 'in_progress' ? 'You have an attempt in progress.' : 'A new assessment is waiting.',
      icon: a.status === 'in_progress' ? PlayCircle : ClipboardCheck,
      onClick: () => navigate('/assessments'),
    });
  });

  if (latestApproved) {
    actionItems.push({
      id: 'view-feedback',
      title: 'Review manager feedback',
      description: 'See per-skill comments from your last approved registry.',
      icon: CheckCircle2,
      onClick: () => navigate('/skill-registry'),
    });
  }

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personal skill picture at a glance.
        </p>
      </div>

      {/* Pulse strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="My Registry"
          value={
            loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <RegistryStatusBadge status={status} />
            )
          }
          hint={
            currentRegistry
              ? `v${currentRegistry.version_number} · updated ${formatRelative(
                  currentRegistry.modified_at ?? currentRegistry.created_at,
                )}`
              : 'No registry yet'
          }
          icon={ClipboardList}
          tone="primary"
          loading={loading}
          onClick={() => navigate('/skill-registry')}
        />
        <StatCard
          label="Skills Assessed"
          value={skillsAssessed}
          hint={
            latestApproved
              ? `from approved v${latestApproved.version_number}`
              : 'No approved registry yet'
          }
          icon={ListChecks}
          tone="info"
          loading={loading}
        />
        <StatCard
          label="My Avg Level"
          value={myAvgLevel !== null ? myAvgLevel.toFixed(1) : '—'}
          hint={
            latestApproved
              ? 'manager-validated'
              : currentRegistry
                ? 'self-rated (no approval yet)'
                : 'Not enough data'
          }
          icon={Gauge}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Open Tasks"
          value={openAssignments.length}
          hint={
            openAssignments.length === 0 ? 'You\'re all caught up' : 'Pending assessments'
          }
          icon={ClipboardCheck}
          tone="warning"
          loading={loading}
          onClick={openAssignments.length > 0 ? () => navigate('/assessments') : undefined}
        />
      </div>

      {/* Insight: My Skill Snapshot */}
      <div className="space-y-3">
        <SectionHeader
          title="My Skill Snapshot"
          description={
            latestReview
              ? 'Manager-validated levels grouped by skill category.'
              : currentItems.length > 0
                ? 'Self-rated levels (no approved registry yet) grouped by category.'
                : 'Once you rate skills, your profile appears here.'
          }
          action={
            currentRegistry ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => navigate('/skill-registry')}
              >
                Open registry <ArrowRight size={14} />
              </Button>
            ) : null
          }
        />
        <Card>
          <CardContent className="p-4">
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : snapshotData.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No skill data yet"
                description="Start your skill registry to see your snapshot."
                action={
                  user?.domain_id ? (
                    <Button size="sm" onClick={() => navigate('/skill-registry')}>
                      Go to my registry
                    </Button>
                  ) : undefined
                }
              />
            ) : snapshotData.length < 3 ? (
              // Radar needs ≥ 3 axes — fall back to a simple list
              <ul className="divide-y divide-border">
                {snapshotData.map((d) => (
                  <li key={d.category} className="flex items-center justify-between py-3">
                    <span className="text-sm text-foreground">{d.category}</span>
                    <span className="text-sm font-medium text-primary">
                      L{Math.round(d.level)} · {ratingLabels[Math.round(d.level)] ?? ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={snapshotData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, levelMax]}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    />
                    <Radar
                      dataKey="level"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.25}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`L${v.toFixed(1)}`, 'Avg level']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action lane */}
      <div className="space-y-3">
        <SectionHeader title="What's next" description="Suggested next steps for you." />
        <ActionList
          items={actionItems}
          loading={loading}
          emptyTitle="You're all caught up"
          emptyDescription="No pending tasks right now. Great job!"
          emptyIcon={CheckCircle2}
        />
      </div>
    </div>
  );
}
