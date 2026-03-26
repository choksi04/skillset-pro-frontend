import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAssessmentStore, Assessment, assessmentStatusConfig } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useQuestionStore, Question } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useCycleStore } from '@/stores/cycleStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import EvalResults from '@/components/assessment/EvalResults';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  ArrowLeft, Play, BarChart3, ClipboardCheck, Clock,
  CheckCircle, Loader2, RotateCcw, ArrowRight,
} from 'lucide-react';

function getEffectiveStatus(assessment: Assessment, attempt: any, review: any): string {
  if (review?.status === 'completed') return 'approved';
  if (review) return 'review_pending';
  if (attempt?.status === 'evaluated') return 'evaluated';
  if (attempt?.status === 'submitted') return 'completed';
  if (attempt?.status === 'in_progress' || assessment.status === 'in_progress') return 'in_progress';
  return assessment.status;
}

export default function AssessmentDetailPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const { assessments, fetchAssessments } = useAssessmentStore();
  const { getAttemptForAssessment, fetchAttempts, retryEvaluation } = useAttemptStore();
  const { questions, fetchQuestions } = useQuestionStore();
  const { skills, fetchSkills } = useSkillStore();
  const { domains, fetchDomains } = useDomainStore();
  const { reviews, fetchReviews } = useReviewStore();
  const { cycles, fetchCycles } = useCycleStore();
  const { user } = useAuth();

  const [employeeName, setEmployeeName] = useState('');

  useEffect(() => {
    fetchAssessments(); fetchAttempts(); fetchQuestions(); fetchSkills(); fetchDomains(); fetchReviews(); fetchCycles();
  }, []);

  const assessment = useMemo(
    () => assessments.find((a) => a.id === assessmentId),
    [assessments, assessmentId]
  );

  const attempt = assessment ? getAttemptForAssessment(assessment.id) : null;
  const review = reviews.find((r) => r.assessment_id === assessment?.id);
  const status = assessment ? getEffectiveStatus(assessment, attempt, review) : 'pending';
  const config = assessmentStatusConfig[status] ?? assessmentStatusConfig.pending;
  const domain = domains.find((d) => d.id === assessment?.domain_id);
  const cycleName = assessment?.cycle_id ? cycles.find((c) => c.id === assessment.cycle_id)?.name : '';
  const isOwner = assessment?.employee_id === user?.id;
  const isPendingEval = attempt?.status === 'submitted' && (!attempt.ai_evaluations || attempt.ai_evaluations.length === 0);
  const isEvaluated = attempt?.status === 'evaluated' || attempt?.status === 'reviewed';

  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  // Fetch employee name for team view
  useEffect(() => {
    if (!assessment || isOwner) return;
    supabase.from('users').select('full_name').eq('id', assessment.employee_id).single().then(({ data }) => {
      if (data) setEmployeeName(data.full_name);
    });
  }, [assessment, isOwner]);

  // Determine back path
  const backPath = window.location.pathname.startsWith('/team-assessments') ? '/team-assessments' : '/assessments';
  const backLabel = backPath === '/team-assessments' ? 'Back to Team Assessments' : 'Back to My Assessments';

  if (!assessment) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> {backLabel}
        </Button>
        <div className="text-center py-16 text-sm text-muted-foreground">Assessment not found.</div>
      </div>
    );
  }

  // Skill names for this assessment
  const skillNames = assessment.skill_ids.map((id) => skillMap.get(id)?.skill_name).filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft size={14} /> {backLabel}
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-foreground">
            {!isOwner && employeeName ? `${employeeName} — ` : ''}{domain?.name ?? 'Assessment'}
          </h2>
          <Badge className={`text-xs ${config.color}`}>{config.label}</Badge>
          {assessment.is_reassessment && <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">Reassessment</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {[cycleName, `${assessment.assessment_questions.length} questions`, `${assessment.duration_minutes} min`, new Date(assessment.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Metadata Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Questions</p>
            <p className="text-2xl font-bold text-foreground">{assessment.assessment_questions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Duration</p>
            <p className="text-2xl font-bold text-foreground">{assessment.duration_minutes}<span className="text-sm font-normal text-muted-foreground ml-0.5">min</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Skills</p>
            <p className="text-2xl font-bold text-foreground">{assessment.skill_ids.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">AI Score</p>
            {attempt?.total_ai_score != null ? (
              <p className={`text-2xl font-bold ${attempt.total_ai_score >= 75 ? 'text-success' : attempt.total_ai_score >= 50 ? 'text-warning' : 'text-destructive'}`}>
                {attempt.total_ai_score}%
              </p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Skills list */}
      {skillNames && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Skills: </span>{skillNames}
        </div>
      )}

      {/* CTA Buttons */}
      <div className="flex items-center gap-3">
        {isOwner && status === 'pending' && (
          <Button onClick={() => navigate('/assessment-exec')} className="gap-1.5">
            <Play size={14} /> Start Assessment
          </Button>
        )}
        {isOwner && status === 'in_progress' && (
          <Button onClick={() => navigate('/assessment-exec')} className="gap-1.5">
            <Play size={14} /> Resume Assessment
          </Button>
        )}
        {isPendingEval && isOwner && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs text-warning border-warning/20 gap-1">
              <Loader2 size={12} className="animate-spin" /> Pending Evaluation
            </Badge>
            <Button size="sm" variant="outline" onClick={async () => {
              if (!attempt) return;
              const qMap = new Map<string, Question>(
                assessment.assessment_questions
                  .map((aq) => [aq.question_id, questionMap.get(aq.question_id)!] as [string, Question])
                  .filter(([, q]) => q != null)
              );
              await retryEvaluation(attempt.id, qMap as Map<string, any>, assessment.assessment_questions);
              toast.info('Retrying AI evaluation...');
            }} className="gap-1.5">
              <RotateCcw size={14} /> Retry Evaluation
            </Button>
          </div>
        )}
        {!isOwner && (status === 'evaluated' || status === 'review_pending') && (
          <Button variant="outline" onClick={() => navigate('/manager-reviews')} className="gap-1.5">
            <ArrowRight size={14} /> Go to Review
          </Button>
        )}
      </div>

      {/* Evaluation Results */}
      {isEvaluated && attempt && (
        <EvalResults attempt={attempt} assessment={assessment} />
      )}
    </div>
  );
}
