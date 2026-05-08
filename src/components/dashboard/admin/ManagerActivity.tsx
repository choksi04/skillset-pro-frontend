import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Inbox } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';

import type { ManagerReview } from '@/stores/reviewStore';
import type { SkillRegistry } from '@/stores/skillRegistryStore';

interface Props {
  loading: boolean;
  /** Manager directory: id → name + domain. */
  users: { id: string; full_name: string; domain_id: string | null; role?: string }[];
  /** Manager-side assessment reviews. */
  reviews: ManagerReview[];
  /** Registry-side reviews — used to count pending approvals per reviewer. */
  registries: SkillRegistry[];
  reviewStatuses: Record<string, string | undefined>;
  /** Domain reviewer mapping: managers responsible for a registry's domain. */
  domainLeadByDomain: Map<string, string | null>;
  domainFilter?: string;
}

interface ManagerStat {
  id: string;
  name: string;
  pending: number;
  approved: number;
  avgTurnaroundDays: number | null;
}

export function ManagerActivity({
  loading,
  users,
  reviews,
  registries,
  reviewStatuses,
  domainLeadByDomain,
  domainFilter,
}: Props) {
  const navigate = useNavigate();

  const rows = useMemo<ManagerStat[]>(() => {
    const managers = users.filter(
      (u) => u.role === 'manager' || u.role === 'admin',
    );
    if (managers.length === 0) return [];

    return managers
      .map<ManagerStat>((mgr) => {
        // Assessment-side reviews assigned to this reviewer
        const myAssessmentReviews = reviews.filter((r) => r.reviewer_id === mgr.id);
        const pendingAssessment = myAssessmentReviews.filter(
          (r) => r.status === 'pending' || r.status === 'in_progress',
        ).length;
        const completed = myAssessmentReviews.filter(
          (r) => r.status === 'completed' && r.completed_at,
        );

        // Registry-side reviews assigned via domain leadership
        const myRegistryReviews = registries.filter((r) => {
          if (r.status !== 'submitted') return false;
          const lead = domainLeadByDomain.get(r.domain_id);
          return lead === mgr.id;
        });
        const pendingRegistry = myRegistryReviews.filter(
          (r) => reviewStatuses[r.id] !== 'approved',
        ).length;
        const approvedRegistry = myRegistryReviews.filter(
          (r) => reviewStatuses[r.id] === 'approved',
        ).length;

        // Avg turnaround in days (assessment side)
        let avgTurn: number | null = null;
        if (completed.length > 0) {
          const sum = completed.reduce((acc, r) => {
            const start = new Date(r.created_at).getTime();
            const end = new Date(r.completed_at!).getTime();
            return acc + Math.max(0, end - start);
          }, 0);
          avgTurn = sum / completed.length / 86400000;
        }

        return {
          id: mgr.id,
          name: mgr.full_name,
          pending: pendingAssessment + pendingRegistry,
          approved: completed.length + approvedRegistry,
          avgTurnaroundDays: avgTurn,
        };
      })
      .filter((m) => {
        if (!domainFilter) return true;
        const usr = users.find((u) => u.id === m.id);
        return usr?.domain_id === domainFilter || domainLeadByDomain.get(domainFilter) === m.id;
      })
      .sort((a, b) => b.pending - a.pending || b.approved - a.approved);
  }, [users, reviews, registries, reviewStatuses, domainLeadByDomain, domainFilter]);

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Manager Activity"
        description="Pending workload, approvals to date, and average turnaround."
      />
      <Card>
        <CardContent className="p-2">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState
              compact
              icon={Users}
              title="No managers found"
              description="Assign managers to surface activity here."
            />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-1.5 font-medium">Manager</th>
                  <th className="px-2 py-1.5 text-right font-medium">Pending</th>
                  <th className="px-2 py-1.5 text-right font-medium">Approved</th>
                  <th className="px-2 py-1.5 text-right font-medium">Avg Turnaround</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-t border-border transition hover:bg-muted/40"
                    onClick={() => navigate(`/users/${r.id}`)}
                  >
                    <td className="px-2 py-2 font-medium text-foreground">{r.name}</td>
                    <td className="px-2 py-2 text-right">
                      <span
                        className={
                          r.pending > 5
                            ? 'inline-flex items-center gap-1 text-destructive'
                            : ''
                        }
                      >
                        {r.pending > 5 ? <Inbox size={11} /> : null}
                        {r.pending}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{r.approved}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">
                      {r.avgTurnaroundDays === null
                        ? '—'
                        : `${r.avgTurnaroundDays.toFixed(1)}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
