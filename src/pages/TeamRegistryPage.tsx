import { useState, useMemo, useEffect } from 'react';
import { useRegistryStore } from '@/stores/registryStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useCycleStore } from '@/stores/cycleStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ScoreChip } from '@/components/registry/ScoreChip';
import { ManagerAvatar, ReviewerInfo } from '@/components/registry/ManagerAvatar';
import { deriveStatus, statusLabel, statusColor, avgRound, EnrichedSubmission } from '@/components/registry/registryHelpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Users, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';

export default function TeamRegistryPage() {
  const { user, currentRole } = useAuth();
  const navigate = useNavigate();
  const { submissions, fetchRegistry } = useRegistryStore();
  const { assessments, fetchAssessments } = useAssessmentStore();
  const { attempts, fetchAttempts } = useAttemptStore();
  const { reviews, officialEntries, fetchReviews } = useReviewStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { fetchCycles } = useCycleStore();
  const [userNames, setUserNames] = useState<Record<string, { name: string; email: string; avatar_url: string }>>({});
  const [reviewerMap, setReviewerMap] = useState<Record<string, { name: string; email: string; avatar_url: string }>>({});

  useEffect(() => {
    fetchRegistry(); fetchDomains(); fetchSkills(); fetchCycles(); fetchAssessments(); fetchAttempts(); fetchReviews();
  }, []);

  const teamSubmissions = useMemo(() => {
    if (currentRole === 'admin') return submissions;
    const managerDomainId = user?.domain_id;
    if (!managerDomainId) return [];
    return submissions.filter((s) => s.domain_id === managerDomainId);
  }, [submissions, currentRole, user]);

  // Fetch employee names
  useEffect(() => {
    const employeeIds = [...new Set(teamSubmissions.map((s) => s.employee_id))];
    if (employeeIds.length === 0) return;
    supabase.from('users').select('id, full_name, email, avatar_url').in('id', employeeIds).then(({ data }) => {
      if (data) {
        const map: Record<string, { name: string; email: string; avatar_url: string }> = {};
        data.forEach((u: any) => { map[u.id] = { name: u.full_name, email: u.email, avatar_url: u.avatar_url || '' }; });
        setUserNames(map);
      }
    });
  }, [teamSubmissions]);

  // Fetch reviewer names
  useEffect(() => {
    const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
    if (reviewerIds.length === 0) return;
    supabase.from('users').select('id, full_name, email, avatar_url').in('id', reviewerIds).then(({ data }) => {
      if (data) {
        const map: Record<string, { name: string; email: string; avatar_url: string }> = {};
        data.forEach((u: any) => { map[u.id] = { name: u.full_name, email: u.email, avatar_url: u.avatar_url || '' }; });
        setReviewerMap(map);
      }
    });
  }, [reviews]);

  // Enrich submissions
  const enrichedSubmissions = useMemo<EnrichedSubmission[]>(() => {
    return teamSubmissions.map((sub) => {
      const selfAvg = avgRound(sub.ratings.map((r) => r.rating));

      let assessmentAvg: number | null = null;
      const assessment = assessments.find((a) => a.submission_id === sub.id);
      if (assessment) {
        const attempt = attempts.find((a) => a.assessment_id === assessment.id);
        if (attempt && attempt.skill_scores.length > 0) {
          assessmentAvg = avgRound(attempt.skill_scores.map((ss) => ss.calculated_level));
        }
      }

      let finalAvg: number | null = null;
      const officialForCycle = (officialEntries || []).filter(
        (oe) => oe.employee_id === sub.employee_id && oe.cycle === sub.cycle
      );
      if (officialForCycle.length > 0) {
        finalAvg = avgRound(officialForCycle.map((oe) => oe.final_level));
      }

      const status = deriveStatus(sub, assessments, attempts, reviews);

      let reviewer: EnrichedSubmission['reviewer'] = null;
      if (assessment) {
        const attempt = attempts.find((a) => a.assessment_id === assessment.id);
        if (attempt) {
          const review = reviews.find((r) => r.attempt_id === attempt.id);
          if (review && reviewerMap[review.reviewer_id]) {
            reviewer = { id: review.reviewer_id, ...reviewerMap[review.reviewer_id] };
          }
        }
      }

      return { submission: sub, selfAvg, assessmentAvg, finalAvg, status, reviewer, isActive: false };
    }).sort((a, b) => new Date(b.submission.created_at).getTime() - new Date(a.submission.created_at).getTime());
  }, [teamSubmissions, assessments, attempts, reviews, officialEntries, reviewerMap]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Team Registry</h2>
        <p className="text-sm text-muted-foreground mt-1">Monitor your team's skill self-assessments.</p>
      </div>

      {enrichedSubmissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Users size={32} className="text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Submissions Yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            No team members have submitted their skill registries yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {enrichedSubmissions.map((item) => {
            const domain = domains.find((d) => d.id === item.submission.domain_id);
            const empInfo = userNames[item.submission.employee_id];

            return (
              <Card
                key={item.submission.id}
                className="border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/team-registry/${item.submission.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="rounded-full bg-muted p-2 shrink-0">
                        <User size={16} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {empInfo?.name || item.submission.employee_id}
                        </p>
                        <p className="text-xs text-muted-foreground">{domain?.name ?? 'Unknown domain'} · {item.submission.cycle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5">
                      <ScoreChip label="Self" value={item.selfAvg || null} />
                      <ScoreChip label="Assessment" value={item.assessmentAvg} />
                      <ScoreChip label="Final" value={item.finalAvg} />
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Manager:</span>
                        <ManagerAvatar reviewer={item.reviewer} />
                      </div>
                      <Badge className={`text-[10px] ${statusColor(item.status)}`}>{statusLabel(item.status)}</Badge>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
