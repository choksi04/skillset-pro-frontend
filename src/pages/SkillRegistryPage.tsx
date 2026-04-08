import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRegistryStore, RatingLevel, SkillSelfRating } from '@/stores/registryStore';
import { useCompetencyLevelStore, getRatingLabels } from '@/stores/competencyLevelStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useCycleStore } from '@/stores/cycleStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ScoreChip } from '@/components/registry/ScoreChip';
import { ManagerAvatar } from '@/components/registry/ManagerAvatar';
import { deriveStatus, statusConfig, statusLabel, statusColor, avgRound, EnrichedSubmission } from '@/components/registry/registryHelpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle, ClipboardCheck, Clock, Eye, Award,
  Calendar, ArrowRight, Play, FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SkillRegistryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { submissions, assignments, currentCycle, getSubmission, createOrUpdateDraft, fetchRegistry, setCurrentCycle } = useRegistryStore();
  const { assessments, fetchAssessments } = useAssessmentStore();
  const { attempts, fetchAttempts } = useAttemptStore();
  const { reviews, officialEntries, fetchReviews } = useReviewStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { fetchQuestions } = useQuestionStore();
  const { activeCycle, isSubmissionAllowed, getDaysRemaining, fetchCycles } = useCycleStore();

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  useEffect(() => {
    fetchAssessments(); fetchDomains(); fetchSkills(); fetchQuestions(); fetchRegistry(); fetchCycles(); fetchAttempts(); fetchReviews();
  }, []);

  useEffect(() => {
    if (activeCycle) setCurrentCycle(activeCycle.name);
  }, [activeCycle, setCurrentCycle]);

  const [reviewerMap, setReviewerMap] = useState<Record<string, { name: string; email: string; avatar_url: string }>>({});

  useEffect(() => {
    // Collect all reviewer IDs from reviews related to this employee's submissions
    const mySubmissionIds = new Set(submissions.filter((s) => s.employee_id === employeeId).map((s) => s.id));
    const relatedAssessments = assessments.filter((a) => mySubmissionIds.has(a.submission_id));
    const relatedAttemptIds = new Set(
      relatedAssessments.map((a) => attempts.find((att) => att.assessment_id === a.id)?.id).filter(Boolean) as string[]
    );
    const relatedReviews = reviews.filter((r) => relatedAttemptIds.has(r.attempt_id));
    const reviewerIds = [...new Set(relatedReviews.map((r) => r.reviewer_id))];
    if (reviewerIds.length === 0) return;
    supabase.from('users').select('id, full_name, email, avatar_url').in('id', reviewerIds).then(({ data }) => {
      if (!data) return;
      const map: Record<string, { name: string; email: string; avatar_url: string }> = {};
      data.forEach((u: any) => { map[u.id] = { name: u.full_name, email: u.email, avatar_url: u.avatar_url || '' }; });
      setReviewerMap(map);
    });
  }, [reviews, employeeId, submissions, assessments, attempts]);

  const assignedDomain = useMemo(() => {
    if (user?.domain_id) return domains.find((d) => d.id === user.domain_id) ?? null;
    const assignment = assignments.find((a) => a.employee_id === employeeId);
    return assignment ? domains.find((d) => d.id === assignment.domain_id) ?? null : null;
  }, [user, domains, assignments, employeeId]);

  const domainSkillIds = useMemo(() => {
    if (!assignedDomain) return [];
    return mappings.filter((m) => m.domain_id === assignedDomain.id).map((m) => m.skill_id);
  }, [assignedDomain, mappings]);

  const domainSkills = useMemo(
    () => skills.filter((s) => domainSkillIds.includes(s.id) && s.status === 'active'),
    [skills, domainSkillIds]
  );

  const submission = getSubmission(employeeId, currentCycle);
  const isCycleClosedForActive = !activeCycle || (submission ? submission.cycle !== activeCycle.name : false);
  const employeeStatus = deriveStatus(submission, assessments, attempts, reviews, submission?.status === 'draft' ? isCycleClosedForActive : false);
  const isLocked = submission?.status === 'submitted' || submission?.status === 'assessment_generated';

  const enrichedSubmissions = useMemo<EnrichedSubmission[]>(() => {
    const mySubmissions = submissions.filter((s) => s.employee_id === employeeId);
    return mySubmissions.map((sub) => {
      const isActive = activeCycle ? sub.cycle === activeCycle.name : false;
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

      const subCycleClosed = !activeCycle || sub.cycle !== activeCycle.name;
      const status = deriveStatus(sub, assessments, attempts, reviews, sub.status === 'draft' ? subCycleClosed : false);

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

      return { submission: sub, selfAvg, assessmentAvg, finalAvg, status, reviewer, isActive };
    }).sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return new Date(b.submission.created_at).getTime() - new Date(a.submission.created_at).getTime();
    });
  }, [submissions, employeeId, activeCycle, assessments, attempts, reviews, officialEntries, reviewerMap]);

  const ratedCount = domainSkills.filter((s) => {
    const r = submission?.ratings.find((r) => r.skill_id === s.id);
    return r != null;
  }).length;

  const submissionAllowed = isSubmissionAllowed();
  const daysRemaining = getDaysRemaining();

  // CTA handler — status-dependent navigation
  const handleCTA = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (employeeStatus === 'not_started') {
      if (assignedDomain) {
        await createOrUpdateDraft(employeeId, tenantId, assignedDomain.id, []);
        await fetchRegistry();
        const sub = getSubmission(employeeId, currentCycle);
        if (sub) navigate(`/skill-registry/${sub.id}`);
      }
      return;
    }
    if (employeeStatus === 'in_progress') {
      if (submission) navigate(`/skill-registry/${submission.id}`);
      return;
    }
    if (employeeStatus === 'submitted' || employeeStatus === 'assessment_pending') {
      navigate('/assessments');
      return;
    }
    if (employeeStatus === 'assessment_completed' || employeeStatus === 'approved' || employeeStatus === 'review_pending') {
      if (submission) navigate(`/skill-registry/${submission.id}`);
      return;
    }
  };

  // Card click — always goes to detail (if submission exists)
  const handleCardClick = () => {
    if (submission) navigate(`/skill-registry/${submission.id}`);
  };

  const config = employeeStatus ? statusConfig[employeeStatus] : null;
  const activeEnriched = enrichedSubmissions.find((e) => e.isActive);
  const pastEnriched = enrichedSubmissions.filter((e) => !e.isActive);

  // No domain warning
  if (activeCycle && !assignedDomain) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">My Skill Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">Submit your self-assessed skill ratings and track your progress.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle size={32} className="text-warning mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Domain Assigned</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You have not been assigned to a domain yet. Please contact your manager or admin.
          </p>
        </div>
        {pastEnriched.length > 0 && <PastRegistryList items={pastEnriched} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">My Skill Registry</h2>
        <p className="text-sm text-muted-foreground mt-1">Submit your self-assessed skill ratings and track your progress.</p>
      </div>

      {/* Active Registry Section */}
      {activeCycle && assignedDomain && config && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar size={14} className="text-primary" /> Active Registry
          </h3>

          {/* Cycle info bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground px-1">
            <span>Domain: <span className="font-medium text-foreground">{assignedDomain.name}</span></span>
            <span>•</span>
            <span>{new Date(activeCycle.start_date).toLocaleDateString()} – {new Date(activeCycle.end_date).toLocaleDateString()}</span>
            {daysRemaining !== null && submissionAllowed && !isLocked && (
              <>
                <span>•</span>
                <span className={`font-medium ${daysRemaining <= 3 ? 'text-destructive' : daysRemaining <= 7 ? 'text-warning' : 'text-muted-foreground'}`}>
                  {daysRemaining > 0 ? `${daysRemaining} days remaining` : daysRemaining === 0 ? 'Ends today' : 'Grace period active'}
                </span>
              </>
            )}
            {ratedCount > 0 && employeeStatus !== 'not_started' && (
              <>
                <span>•</span>
                <span>{ratedCount}/{domainSkills.length} skills rated</span>
              </>
            )}
          </div>

          {/* Active registry card — same format as past registry cards */}
          <Card
            className="border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
            onClick={handleCardClick}
          >
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{activeCycle.name}</p>
                      <Badge className={`text-[10px] ${config.color}`}>{config.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {submission ? new Date(submission.created_at).toLocaleDateString() : 'Not started'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <ScoreChip label="Self" value={activeEnriched?.selfAvg || null} />
                  <ScoreChip label="Assessment" value={activeEnriched?.assessmentAvg ?? null} />
                  <ScoreChip label="Final" value={activeEnriched?.finalAvg ?? null} />
                  {activeEnriched?.reviewer && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Manager:</span>
                      <ManagerAvatar reviewer={activeEnriched.reviewer} />
                    </div>
                  )}
                   <Button
                     variant="ghost"
                     size="sm"
                     className="gap-1 text-xs shrink-0"
                     disabled={config.ctaDisabled}
                     onClick={(e) => handleCTA(e)}
                   >
                    {employeeStatus === 'not_started' && <Play size={13} />}
                    {employeeStatus === 'in_progress' && <ArrowRight size={13} />}
                    {(employeeStatus === 'submitted' || employeeStatus === 'assessment_pending') && <ClipboardCheck size={13} />}
                    {employeeStatus === 'assessment_completed' && <Eye size={13} />}
                    {employeeStatus === 'review_pending' && <Clock size={13} />}
                    {employeeStatus === 'approved' && <Award size={13} />}
                    {config.cta}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No active cycle */}
      {!activeCycle && (
        <Card className="border-border">
          <CardContent className="p-5 flex items-center gap-3">
            <Clock size={20} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">No Active Review Cycle</p>
              <p className="text-xs text-muted-foreground">There is no active review cycle at the moment. Your past registries are shown below.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Registries */}
      {pastEnriched.length > 0 && <PastRegistryList items={pastEnriched} />}

      {/* Empty state */}
      {enrichedSubmissions.length === 0 && !activeCycle && (
        <div className="flex flex-col items-center justify-center py-16">
          <FileText size={32} className="text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Skill Registry Records</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You don't have any skill registry submissions yet.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Past registry card list ──
function PastRegistryList({ items }: { items: EnrichedSubmission[] }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <FileText size={14} className="text-muted-foreground" /> Past Registries
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <Card
            key={item.submission.id}
            className="border-border hover:border-primary/30 transition-colors cursor-pointer"
            onClick={() => navigate(`/skill-registry/${item.submission.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{item.submission.cycle}</p>
                      <Badge className={`text-[10px] ${statusColor(item.status)}`}>{statusLabel(item.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(item.submission.created_at).toLocaleDateString()}
                    </p>
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
                  <Button variant="ghost" size="sm" className="gap-1 text-xs shrink-0" onClick={(e) => { e.stopPropagation(); navigate(`/skill-registry/${item.submission.id}`); }}>
                    <Eye size={13} /> View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
