import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRegistryStore, RatingLevel } from '@/stores/registryStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ScoreCard } from '@/components/registry/ScoreCard';
import { ManagerAvatar } from '@/components/registry/ManagerAvatar';
import { RegistrySkillTable } from '@/components/registry/RegistrySkillTable';
import { deriveStatus, statusLabel, statusColor, avgRound, EnrichedSubmission } from '@/components/registry/registryHelpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, BarChart3, ClipboardCheck, Award, UserCheck,
} from 'lucide-react';

export default function TeamRegistryDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();

  const { submissions, fetchRegistry } = useRegistryStore();
  const { assessments, fetchAssessments } = useAssessmentStore();
  const { attempts, fetchAttempts } = useAttemptStore();
  const { reviews, officialEntries, fetchReviews } = useReviewStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();

  useEffect(() => {
    fetchRegistry(); fetchDomains(); fetchSkills(); fetchAssessments(); fetchAttempts(); fetchReviews();
  }, []);

  const submission = useMemo(() => submissions.find((s) => s.id === submissionId), [submissions, submissionId]);

  // Fetch employee + reviewer info
  const [employeeName, setEmployeeName] = useState('');
  const [reviewerMap, setReviewerMap] = useState<Record<string, { name: string; email: string; avatar_url: string }>>({});

  useEffect(() => {
    if (!submission) return;
    supabase.from('users').select('id, full_name').eq('id', submission.employee_id).single().then(({ data }) => {
      if (data) setEmployeeName((data as any).full_name);
    });
  }, [submission?.employee_id]);

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

  const domain = useMemo(() => submission ? domains.find((d) => d.id === submission.domain_id) : null, [submission, domains]);
  const isCycleClosed = !activeCycle || (submission ? submission.cycle !== activeCycle.name : false);
  const employeeStatus = deriveStatus(submission, assessments, attempts, reviews, submission?.status === 'draft' ? isCycleClosed : false);

  // Enriched
  const enriched = useMemo<EnrichedSubmission | null>(() => {
    if (!submission) return null;
    const selfAvg = avgRound(submission.ratings.map((r) => r.rating));
    let assessmentAvg: number | null = null;
    const assessment = assessments.find((a) => a.submission_id === submission.id);
    if (assessment) {
      const attempt = attempts.find((a) => a.assessment_id === assessment.id);
      if (attempt && attempt.skill_scores.length > 0) {
        assessmentAvg = avgRound(attempt.skill_scores.map((ss) => ss.calculated_level));
      }
    }
    let finalAvg: number | null = null;
    const officialForCycle = (officialEntries || []).filter(
      (oe) => oe.employee_id === submission.employee_id && oe.cycle === submission.cycle
    );
    if (officialForCycle.length > 0) {
      finalAvg = avgRound(officialForCycle.map((oe) => oe.final_level));
    }
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
    return { submission, selfAvg, assessmentAvg, finalAvg, status: employeeStatus, reviewer, isActive: false };
  }, [submission, assessments, attempts, reviews, officialEntries, reviewerMap, employeeStatus]);

  const assessment = useMemo(() => assessments.find((a) => a.submission_id === submission?.id), [assessments, submission]);
  const attempt = useMemo(() => assessment ? attempts.find((a) => a.assessment_id === assessment.id) : null, [assessment, attempts]);
  const review = useMemo(() => attempt ? reviews.find((r) => r.attempt_id === attempt.id) : null, [attempt, reviews]);

  const assessmentScoreMap = useMemo<Record<string, number>>(() => {
    if (!attempt) return {};
    const map: Record<string, number> = {};
    attempt.skill_scores.forEach((ss) => { map[ss.skill_id] = ss.calculated_level; });
    return map;
  }, [attempt]);

  const finalScoreMap = useMemo<Record<string, number>>(() => {
    if (!submission) return {};
    const entries = (officialEntries || []).filter(
      (oe) => oe.employee_id === submission.employee_id && oe.cycle === submission.cycle
    );
    const map: Record<string, number> = {};
    entries.forEach((oe) => { map[oe.skill_id] = oe.final_level; });
    return map;
  }, [officialEntries, submission]);

  const ratingMap: Record<string, RatingLevel> = {};
  submission?.ratings.forEach((r) => { ratingMap[r.skill_id] = r.rating; });

  // Trend calculations (vs self score)
  const assessmentTrend = enriched?.selfAvg && enriched?.assessmentAvg
    ? Math.round((enriched.assessmentAvg - enriched.selfAvg) * 10) / 10
    : null;
  const finalTrend = enriched?.selfAvg && enriched?.finalAvg
    ? Math.round((enriched.finalAvg - enriched.selfAvg) * 10) / 10
    : null;

  if (!submission) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/team-registry')} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Back to Team Registry
        </Button>
        <div className="text-center py-16 text-sm text-muted-foreground">Submission not found.</div>
      </div>
    );
  }

  const pageDescription = [
    domain?.name ?? 'Unknown domain',
    submission.cycle,
    submission.submitted_at ? `Submitted ${new Date(submission.submitted_at).toLocaleDateString()}` : `Created ${new Date(submission.created_at).toLocaleDateString()}`,
  ].join(' · ');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" onClick={() => navigate('/team-registry')} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft size={14} /> Back to Team Registry
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-foreground">{employeeName || submission.employee_id}</h2>
          <Badge className={`text-xs ${statusColor(employeeStatus)}`}>{statusLabel(employeeStatus)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{pageDescription}</p>
      </div>

      {/* Score tiles with icons + trends */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ScoreCard
          label="Self Score (avg)"
          value={enriched?.selfAvg ?? null}
          icon={<BarChart3 size={20} className="text-primary" />}
        />
        <ScoreCard
          label="Assessment Score (avg)"
          value={enriched?.assessmentAvg ?? null}
          icon={<ClipboardCheck size={20} className="text-primary" />}
          trend={assessmentTrend}
        />
        <ScoreCard
          label="Final Score (avg)"
          value={enriched?.finalAvg ?? null}
          icon={<Award size={20} className="text-primary" />}
          trend={finalTrend}
        />
        <ScoreCard
          label="Manager"
          value={null}
          icon={<UserCheck size={20} className="text-primary" />}
        >
          {enriched?.reviewer ? (
            <div className="flex flex-col items-center gap-1.5">
              <ManagerAvatar reviewer={enriched.reviewer} />
              <span className="text-xs font-medium text-foreground">{enriched.reviewer.name}</span>
              {review?.overall_comment && (
                <p className="text-[10px] text-muted-foreground italic text-center line-clamp-2">"{review.overall_comment}"</p>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </ScoreCard>
      </div>

      {/* Skill table */}
      <RegistrySkillTable
        skills={skills}
        ratedSkillIds={submission.ratings.map((r) => r.skill_id)}
        ratingMap={ratingMap}
        assessmentScoreMap={assessmentScoreMap}
        finalScoreMap={finalScoreMap}
      />
    </div>
  );
}
