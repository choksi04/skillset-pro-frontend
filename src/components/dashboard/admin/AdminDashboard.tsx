import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Activity,
  Gauge,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Network,
  ListTodo,
  ArrowRight,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSkillRegistryStore } from '@/stores/skillRegistryStore';
import { useRegistryReviewStore } from '@/stores/registryReviewStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useCompetencyLevelStore, getLevelColorClass } from '@/stores/competencyLevelStore';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { StatCard } from '../shared/StatCard';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { ActionList, type ActionListItem } from '../shared/ActionList';

interface UserLite {
  id: string;
  full_name: string;
  domain_id: string | null;
}

const ATTENTION_DRAFT_DAYS = 14;
const STALE_REVIEW_HOURS = 24;

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { registries, items, fetchRegistries, fetchItemsForRegistries, initialized: regInit } =
    useSkillRegistryStore();
  const { reviewStatuses, fetchReviewStatusesForRegistries } = useRegistryReviewStore();
  const { domains, mappings, fetchDomains, initialized: domInit } = useDomainStore();
  const { skills, categories, fetchSkills, initialized: skillInit } = useSkillStore();
  const { reviews, fetchReviews, initialized: reviewInit } = useReviewStore();
  const { attempts, fetchAttempts, initialized: attemptInit } = useAttemptStore();
  const { fetchLevels, initialized: levelInit } = useCompetencyLevelStore();

  const [users, setUsers] = useState<UserLite[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    if (!regInit) fetchRegistries();
    if (!domInit) fetchDomains();
    if (!skillInit) fetchSkills();
    if (!reviewInit) fetchReviews();
    if (!attemptInit) fetchAttempts();
    if (!levelInit) fetchLevels();
  }, [
    regInit, domInit, skillInit, reviewInit, attemptInit, levelInit,
    fetchRegistries, fetchDomains, fetchSkills, fetchReviews, fetchAttempts, fetchLevels,
  ]);

  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    supabase
      .from('users')
      .select('id, full_name, domain_id, status')
      .eq('status', 'active')
      .is('deleted_on', null)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Failed to load users:', error);
          setUsers([]);
        } else {
          setUsers(
            (data ?? []).map((u: any) => ({
              id: u.id,
              full_name: u.full_name,
              domain_id: u.domain_id ?? null,
            })),
          );
        }
        setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-fetch items + review statuses for ALL registries (needed for org-wide aggregates)
  useEffect(() => {
    if (registries.length === 0) return;
    fetchItemsForRegistries(registries.map((r) => r.id));
    fetchReviewStatusesForRegistries(registries.map((r) => r.id));
  }, [registries, fetchItemsForRegistries, fetchReviewStatusesForRegistries]);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const totalEmployees = users.length;

  // Latest registry per employee (registries already sorted desc by version_number per fetch)
  const latestPerEmployee = useMemo(() => {
    const out = new Map<string, (typeof registries)[number]>();
    registries.forEach((r) => {
      if (!out.has(r.employee_id)) out.set(r.employee_id, r);
    });
    return out;
  }, [registries]);

  // Latest APPROVED registry per employee
  const latestApprovedPerEmployee = useMemo(() => {
    const out = new Map<string, (typeof registries)[number]>();
    registries.forEach((r) => {
      if (
        r.status === 'submitted' &&
        reviewStatuses[r.id] === 'approved' &&
        !out.has(r.employee_id)
      ) {
        out.set(r.employee_id, r);
      }
    });
    return out;
  }, [registries, reviewStatuses]);

  // ─── Pulse: Workforce Coverage ───
  const coverage = useMemo(() => {
    if (totalEmployees === 0) return null;
    return latestApprovedPerEmployee.size / totalEmployees;
  }, [totalEmployees, latestApprovedPerEmployee]);

  // ─── Pulse: Assessment Throughput (last 30 days) ───
  const throughput = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    let submitted = 0;
    let evaluated = 0;
    attempts.forEach((a) => {
      if (a.submitted_at && new Date(a.submitted_at).getTime() >= cutoff) submitted += 1;
      if (a.evaluated_at && new Date(a.evaluated_at).getTime() >= cutoff) evaluated += 1;
    });
    let reviewed = 0;
    reviews.forEach((r) => {
      if (r.completed_at && new Date(r.completed_at).getTime() >= cutoff) reviewed += 1;
    });
    return { submitted, evaluated, reviewed };
  }, [attempts, reviews]);

  // ─── Pulse: Avg Validated Level (org-wide, latest approved registries) ───
  const avgValidated = useMemo(() => {
    let sum = 0;
    let n = 0;
    latestApprovedPerEmployee.forEach((reg) => {
      const its = items.get(reg.id) ?? [];
      its.forEach((i) => {
        if (i.self_score !== null && i.self_score !== undefined) {
          sum += i.self_score;
          n += 1;
        }
      });
    });
    if (n === 0) return null;
    return sum / n;
  }, [latestApprovedPerEmployee, items]);

  // ─── Pulse: Self vs Validated Gap ───
  // Phase 1 stand-in: until manager scores per registry are bulk-loaded, we approximate
  // by comparing self_score in latest approved registry vs avg of attempt skill_scores
  // for the same employee + skill.
  const selfVsGap = useMemo(() => {
    // Build employee→skill→level map from approved registries (self)
    const selfMap = new Map<string, number>(); // key: employeeId|skillId
    latestApprovedPerEmployee.forEach((reg) => {
      const its = items.get(reg.id) ?? [];
      its.forEach((i) => {
        if (i.self_score !== null && i.self_score !== undefined) {
          selfMap.set(`${reg.employee_id}|${i.skill_id}`, i.self_score);
        }
      });
    });
    // Validated proxy: avg calculated_level from attempts
    const valAcc = new Map<string, { sum: number; n: number }>();
    attempts.forEach((a) => {
      a.skill_scores.forEach((s) => {
        const k = `${a.employee_id}|${s.skill_id}`;
        if (!selfMap.has(k)) return;
        const cur = valAcc.get(k) ?? { sum: 0, n: 0 };
        cur.sum += s.calculated_level;
        cur.n += 1;
        valAcc.set(k, cur);
      });
    });
    if (valAcc.size === 0) return null;
    let gapSum = 0;
    valAcc.forEach((v, k) => {
      const self = selfMap.get(k) ?? 0;
      const val = v.sum / v.n;
      gapSum += Math.abs(self - val);
    });
    return gapSum / valAcc.size;
  }, [latestApprovedPerEmployee, items, attempts]);

  // ─── Insight: Skill Heatmap (Domain × Category) ───
  const heatmap = useMemo(() => {
    // For each employee with an approved registry, gather (domain, category, level)
    const acc = new Map<string, { sum: number; n: number }>(); // key: domainId|categoryId
    latestApprovedPerEmployee.forEach((reg) => {
      const empDomain = reg.domain_id;
      const its = items.get(reg.id) ?? [];
      its.forEach((i) => {
        const skill = skills.find((s) => s.id === i.skill_id);
        if (!skill) return;
        const catId = skill.skill_category;
        if (!catId) return;
        if (i.self_score === null || i.self_score === undefined) return;
        const k = `${empDomain}|${catId}`;
        const cur = acc.get(k) ?? { sum: 0, n: 0 };
        cur.sum += i.self_score;
        cur.n += 1;
        acc.set(k, cur);
      });
    });

    const domainList = domains.filter((d) => d.status === 'active');
    const catList = categories.filter((c) => c.status === 'active');

    const cells: Record<string, Record<string, number | null>> = {};
    domainList.forEach((d) => {
      cells[d.id] = {};
      catList.forEach((c) => {
        const v = acc.get(`${d.id}|${c.id}`);
        cells[d.id][c.id] = v && v.n > 0 ? v.sum / v.n : null;
      });
    });

    return { domains: domainList, categories: catList, cells };
  }, [latestApprovedPerEmployee, items, skills, domains, categories]);

  // ─── Action lane: My Attention queue ───
  const attentionItems: ActionListItem[] = useMemo(() => {
    const out: ActionListItem[] = [];

    // Stuck drafts (>14 days)
    const cutoff = Date.now() - ATTENTION_DRAFT_DAYS * 86400000;
    const stuckDrafts = registries.filter(
      (r) =>
        r.status === 'draft' &&
        new Date(r.modified_at ?? r.created_at).getTime() <= cutoff,
    );
    if (stuckDrafts.length > 0) {
      out.push({
        id: 'stuck-drafts',
        title: `${stuckDrafts.length} registr${stuckDrafts.length === 1 ? 'y' : 'ies'} stuck in Draft`,
        description: `Untouched for over ${ATTENTION_DRAFT_DAYS} days`,
        icon: AlertTriangle,
        onClick: () => navigate('/all-registries'),
      });
    }

    // Submitted assessments awaiting evaluation > 24h
    const evalCutoff = Date.now() - STALE_REVIEW_HOURS * 3600000;
    const stalePending = attempts.filter(
      (a) =>
        a.status === 'submitted' &&
        a.submitted_at &&
        new Date(a.submitted_at).getTime() <= evalCutoff,
    );
    if (stalePending.length > 0) {
      out.push({
        id: 'stale-pending',
        title: `${stalePending.length} assessment${stalePending.length === 1 ? '' : 's'} awaiting evaluation`,
        description: `Submitted more than ${STALE_REVIEW_HOURS}h ago`,
        icon: Activity,
        onClick: () => navigate('/team-assessments'),
      });
    }

    // Managers with > 5 pending reviews
    const reviewerLoad = new Map<string, number>();
    reviews.forEach((r) => {
      if (r.status === 'pending' || r.status === 'in_progress') {
        reviewerLoad.set(r.reviewer_id, (reviewerLoad.get(r.reviewer_id) ?? 0) + 1);
      }
    });
    const overloaded = Array.from(reviewerLoad.entries()).filter(([, n]) => n > 5);
    overloaded.forEach(([reviewerId, n]) => {
      const u = usersById.get(reviewerId);
      out.push({
        id: `overload-${reviewerId}`,
        title: `${u?.full_name ?? 'Manager'} has ${n} pending reviews`,
        description: 'Consider rebalancing or following up',
        icon: ListTodo,
        onClick: () => navigate('/users'),
      });
    });

    return out.slice(0, 6);
  }, [registries, attempts, reviews, usersById, navigate]);

  const loading =
    !regInit || !domInit || !skillInit || !reviewInit || !attemptInit || !levelInit || usersLoading;
  const firstName = user?.full_name?.split(' ')[0];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organization-wide skill intelligence at a glance.
        </p>
      </div>

      {/* Pulse strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Workforce Coverage"
          value={
            coverage !== null
              ? `${Math.round(coverage * 100)}%`
              : '—'
          }
          hint={
            coverage !== null
              ? `${latestApprovedPerEmployee.size} of ${totalEmployees} employees approved`
              : 'No active employees'
          }
          icon={Users}
          tone="primary"
          loading={loading}
        />
        <StatCard
          label="Throughput (30d)"
          value={
            <span className="flex items-baseline gap-2 text-2xl font-semibold">
              <span>{throughput.submitted}</span>
              <span className="text-base text-muted-foreground">/</span>
              <span>{throughput.evaluated}</span>
              <span className="text-base text-muted-foreground">/</span>
              <span>{throughput.reviewed}</span>
            </span>
          }
          hint="submitted · evaluated · reviewed"
          icon={Activity}
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Avg Validated Level"
          value={avgValidated !== null ? avgValidated.toFixed(2) : '—'}
          hint={
            avgValidated !== null
              ? 'across approved registries'
              : 'No approved registries yet'
          }
          icon={Gauge}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Self vs Validated Gap"
          value={selfVsGap !== null ? selfVsGap.toFixed(2) : '—'}
          hint={
            selfVsGap !== null
              ? 'avg |self − validated| · lower is better'
              : 'Need approved registries + assessments'
          }
          icon={Scale}
          tone="warning"
          loading={loading}
        />
      </div>

      {/* Insight: Skill Heatmap (Domain × Category) */}
      <div className="space-y-3">
        <SectionHeader
          title="Skill Heatmap"
          description="Average validated level by domain × skill category."
          action={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => navigate('/all-registries')}
            >
              See all registries <ArrowRight size={14} />
            </Button>
          }
        />
        <Card>
          <CardContent className="p-4">
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : heatmap.domains.length === 0 || heatmap.categories.length === 0 ? (
              <EmptyState
                icon={Network}
                title="No domains or categories yet"
                description="Configure domains and skill categories to populate the heatmap."
                action={
                  <Button size="sm" variant="outline" onClick={() => navigate('/domains')}>
                    Manage domains
                  </Button>
                }
              />
            ) : latestApprovedPerEmployee.size === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No approved registries yet"
                description="The heatmap fills in once managers start approving team registries."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                        Domain
                      </th>
                      {heatmap.categories.map((c) => (
                        <th
                          key={c.id}
                          className="px-2 py-2 text-center font-medium text-muted-foreground"
                          title={c.name}
                        >
                          <span className="line-clamp-2 inline-block max-w-[110px]">{c.name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.domains.map((d) => (
                      <tr key={d.id} className="border-t border-border">
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                          <div className="truncate" title={d.name}>{d.name}</div>
                        </td>
                        {heatmap.categories.map((c) => {
                          const v = heatmap.cells[d.id]?.[c.id] ?? null;
                          return (
                            <td key={c.id} className="px-2 py-2 text-center">
                              {v === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span
                                  className={
                                    'inline-flex h-6 min-w-[36px] items-center justify-center rounded-md px-2 text-[11px] font-medium ' +
                                    getLevelColorClass(Math.round(v))
                                  }
                                  title={`Avg L${v.toFixed(2)}`}
                                >
                                  {v.toFixed(1)}
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

      {/* Action lane */}
      <div className="space-y-3">
        <SectionHeader
          title="My Attention"
          description="Things across the organization that may need a nudge."
        />
        <ActionList
          items={attentionItems}
          loading={loading}
          emptyTitle="Nothing needs your attention"
          emptyDescription="No stuck registries, stale evaluations, or overloaded managers right now."
          emptyIcon={CheckCircle2}
        />
      </div>
    </div>
  );
}
