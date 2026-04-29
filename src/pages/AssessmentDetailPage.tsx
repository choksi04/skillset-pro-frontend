import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAssessmentStore, Assessment, assessmentStatusConfig, AssessmentQuestion } from "@/stores/assessmentStore";
import { useAttemptStore } from "@/stores/attemptStore";
import { useQuestionStore, Question } from "@/stores/questionStore";
import { useSkillStore } from "@/stores/skillStore";
import { useCompetencyLevelStore } from "@/stores/competencyLevelStore";
import { useDomainStore } from "@/stores/domainStore";
import { useReviewStore } from "@/stores/reviewStore";

import { useRegistryStore } from "@/stores/registryStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import EvalResults from "@/components/assessment/EvalResults";
import ResultSummaryCard from "@/components/assessment/ResultSummaryCard";
import ManagerReviewPanel from "@/components/assessment/ManagerReviewPanel";
import AddQuestionDialog from "@/components/assessment/AddQuestionDialog";
import AdaptiveRunner from "@/components/assessment/AdaptiveRunner";
import { useAdaptiveEngineStore } from "@/stores/adaptiveEngineStore";
import FixedRunner from "@/components/assessment/FixedRunner";
import { useTemplateStore } from "@/stores/templateStore";
import { canStartNewAttempt } from "@/stores/assignmentStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  BarChart3,
  ClipboardCheck,
  Clock,
  CheckCircle,
  Loader2,
  RotateCcw,
  RefreshCw,
  Trash2,
  Plus,
  ChevronDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssignmentStore } from "@/stores/assignmentStore";
import { getQuestionPreviewText, getQuestionDisplayText } from "@/lib/questionContent";

function getEffectiveStatus(assessment: Assessment, attempt: any, review: any): string {
  if (review?.status === "completed") return "approved";
  if (review) return "review_pending";
  if (attempt?.status === "evaluated") return "evaluated";
  if (attempt?.status === "submitted") return "completed";
  if (attempt?.status === "in_progress" || assessment.status === "in_progress") return "in_progress";
  return assessment.status;
}

export default function AssessmentDetailPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const {
    assessments,
    fetchAssessments,
    softDeleteAssessment,
    addAssessment,
    removeAssessmentQuestion,
    addAssessmentQuestion,
  } = useAssessmentStore();
  const { getAttemptForAssessment, fetchAttempts, retryEvaluation, startAttempt } = useAttemptStore();
  const { questions, fetchQuestions } = useQuestionStore();
  const { skills, fetchSkills } = useSkillStore();
  const { domains, fetchDomains } = useDomainStore();
  const { reviews, fetchReviews } = useReviewStore();
  const { submissions, fetchRegistry, markAssessmentGenerated } = useRegistryStore();
  const { templates, fetchTemplates } = useTemplateStore();
  const { assignments, fetchAssignments, getAssignmentByAssessmentId } = useAssignmentStore();
  const { user } = useAuth();

  const [employeeName, setEmployeeName] = useState("");
  const [assignerName, setAssignerName] = useState("");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [confirmRemoveQuestion, setConfirmRemoveQuestion] = useState<string | null>(null);
  const [runnerActive, setRunnerActive] = useState(false);
  const [startingRunner, setStartingRunner] = useState(false);
  const [confirmReattempt, setConfirmReattempt] = useState(false);

  const { levels: competencyLevels, fetchLevels } = useCompetencyLevelStore();

  useEffect(() => {
    fetchAssessments();
    fetchAttempts();
    fetchQuestions();
    fetchSkills();
    fetchDomains();
    fetchReviews();
    fetchRegistry();
    fetchLevels();
    fetchTemplates();
    fetchAssignments();
  }, []);

  // Build a map from competency level UUID to level number
  const levelNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cl of competencyLevels) {
      map.set(cl.id, cl.level);
      map.set(cl.label.toLowerCase(), cl.level);
      map.set(cl.name.toLowerCase(), cl.level);
    }
    return map;
  }, [competencyLevels]);

  // Build a map from competency level UUID to label
  const levelLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cl of competencyLevels) {
      map.set(cl.id, cl.label);
    }
    return map;
  }, [competencyLevels]);

  const assessment = useMemo(() => assessments.find((a) => a.id === assessmentId), [assessments, assessmentId]);

  const attempt = assessment ? getAttemptForAssessment(assessment.id) : null;
  const review = reviews.find((r) => r.assessment_id === assessment?.id);
  const status = assessment ? getEffectiveStatus(assessment, attempt, review) : "pending";
  const config = assessmentStatusConfig[status] ?? assessmentStatusConfig.pending;
  const domain = domains.find((d) => d.id === assessment?.domain_id);
  const isOwner = assessment?.employee_id === user?.id;
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const canManage = !isOwner && isAdmin && ["pending", "in_progress"].includes(assessment?.status ?? "");
  const isPendingEval =
    attempt?.status === "submitted" && (!attempt.ai_evaluations || attempt.ai_evaluations.length === 0);
  const isEvaluated = attempt?.status === "evaluated" || attempt?.status === "reviewed";

  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  // Map question_id -> ai evaluation row for the result badge column
  const evalByQuestionId = useMemo(() => {
    const m = new Map<string, { score: number }>();
    for (const ev of attempt?.ai_evaluations ?? []) m.set(ev.question_id, { score: ev.score });
    return m;
  }, [attempt?.ai_evaluations]);

  // Backfill ai_evaluations for adaptive attempts that were finalized before
  // per-question rows were being written. Idempotent. Runs once when the gap
  // is detected for this attempt.
  const [backfilled, setBackfilled] = useState<string | null>(null);
  useEffect(() => {
    if (!attempt || !assessment) return;
    const isTerminal =
      attempt.status === "submitted" || attempt.status === "evaluated" || attempt.status === "reviewed";
    if (!isTerminal) return;
    if ((attempt.ai_evaluations?.length ?? 0) > 0) return;
    if (!assessment.is_adaptive) return;
    if (backfilled === attempt.id) return;
    setBackfilled(attempt.id);
    useAdaptiveEngineStore
      .getState()
      .reconstructEvaluationsFromHistory(attempt.id)
      .then((didWork) => {
        if (didWork) {
          fetchAttempts();
          toast.success("Per-question results restored");
        }
      })
      .catch(() => {
        /* silent */
      });
  }, [
    attempt?.id,
    attempt?.status,
    attempt?.ai_evaluations?.length,
    assessment?.is_adaptive,
    backfilled,
    fetchAttempts,
    assessment,
  ]);

  // Fetch employee name for team view
  useEffect(() => {
    if (!assessment || isOwner) return;
    supabase
      .from("users")
      .select("full_name")
      .eq("id", assessment.employee_id)
      .single()
      .then(({ data }) => {
        if (data) setEmployeeName(data.full_name);
      });
  }, [assessment, isOwner]);

  // Fetch assigner name (who assigned this assessment)
  useEffect(() => {
    if (!assessment) return;
    const asg = getAssignmentByAssessmentId(assessment.id);
    if (!asg?.assigned_by) { setAssignerName(""); return; }
    supabase
      .from("users")
      .select("full_name")
      .eq("id", asg.assigned_by)
      .single()
      .then(({ data }) => {
        if (data) setAssignerName(data.full_name);
      });
  }, [assessment, assignments]);

  // Determine back path
  const backPath = window.location.pathname.startsWith("/team-assessments") ? "/team-assessments" : "/assessments";
  const backLabel = backPath === "/team-assessments" ? "Back to Team Assessments" : "Back to My Assessments";

  // Regenerate assessment handler
  const handleRegenerate = async () => {
    if (!assessment) return;
    setRegenerating(true);
    try {
      const oldQuestionIds = assessment.assessment_questions.map((q) => q.question_id);
      const sub = submissions.find((s) => s.id === assessment.submission_id);
      if (!sub) {
        toast.error("Submission not found");
        setRegenerating(false);
        return;
      }

      await softDeleteAssessment(assessment.id);

      const publishedQuestions = questions.filter((q) => q.status === "published");
      const newId = await addAssessment({
        tenant_id: assessment.tenant_id,
        employee_id: assessment.employee_id,
        submission_id: assessment.submission_id,
        domain_id: assessment.domain_id,
        template_id: assessment.template_id ?? undefined,
        ratings: sub.ratings,
        publishedQuestions,
        excludeQuestionIds: oldQuestionIds,
      });
      if (!newId) {
        toast.error("Failed to generate new assessment");
        setRegenerating(false);
        return;
      }

      await markAssessmentGenerated(sub.id);
      toast.success("Assessment regenerated with fresh questions");
      navigate(backPath.includes("team") ? `/team-assessments/${newId}` : `/assessments/${newId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate");
    }
    setRegenerating(false);
    setConfirmRegenerate(false);
  };

  // Remove question handler
  const handleRemoveQuestion = async (questionId: string) => {
    if (!assessment) return;
    if (assessment.assessment_questions.length <= 1) {
      toast.error("Cannot remove the last question");
      return;
    }
    try {
      await removeAssessmentQuestion(assessment.id, questionId);
      toast.success("Question removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove question");
    }
    setConfirmRemoveQuestion(null);
  };

  // Add questions handler
  const handleAddQuestions = async (newQuestions: AssessmentQuestion[]) => {
    if (!assessment) return;
    try {
      for (const q of newQuestions) {
        await addAssessmentQuestion(assessment.id, q);
      }
      toast.success(`${newQuestions.length} question(s) added`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add questions");
    }
  };

  // Start (or resume) the inline runner — replaces the legacy /assessment-exec page.
  // For a re-attempt (after a terminal attempt), pass forceNewAttempt=true to skip
  // the "already submitted" guard and start a fresh attempt row.
  const handleStartRunner = async (forceNewAttempt = false) => {
    if (!assessment) return;
    const gate = canStartNewAttempt(assessment.id);
    if (!gate.allowed) {
      toast.error(gate.reason ?? "You cannot start a new attempt for this assessment.");
      return;
    }
    setStartingRunner(true);
    try {
      const existing = getAttemptForAssessment(assessment.id);
      const isTerminal =
        existing &&
        (existing.status === "evaluated" || existing.status === "submitted" || existing.status === "reviewed");

      if (isTerminal && !forceNewAttempt) {
        toast.info("This assessment has already been submitted.");
        setStartingRunner(false);
        return;
      }

      // Once a manager has approved the result, no further attempts are allowed.
      if (forceNewAttempt && review?.status === "completed") {
        toast.error("This assessment has been approved by your manager and cannot be re-attempted.");
        setStartingRunner(false);
        return;
      }

      await startAttempt(assessment.id, assessment.tenant_id, assessment.employee_id, forceNewAttempt);
      await useAssessmentStore.getState().updateAssessmentStatus(assessment.id, "in_progress");
      await fetchAttempts();
      setRunnerActive(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to start assessment");
    } finally {
      setStartingRunner(false);
    }
  };

  const handleReattempt = () => handleStartRunner(true);

  if (!assessment) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backPath)}
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> {backLabel}
        </Button>
        <div className="text-center py-16 text-sm text-muted-foreground">Assessment not found.</div>
      </div>
    );
  }

  // Skill names for this assessment
  const skillNames = assessment.skill_ids
    .map((id) => skillMap.get(id)?.skill_name)
    .filter(Boolean)
    .join(", ");

  // Adaptive question-count display: cards show an upper bound from the template.
  const linkedTemplate = templates.find((t) => t.id === assessment.template_id);
  const adaptiveCap =
    assessment.is_adaptive && linkedTemplate
      ? Math.max(1, (linkedTemplate.skills_per_assessment ?? 0) * (linkedTemplate.questions_per_skill ?? 0))
      : null;
  const actualQuestionCount = assessment.assessment_questions.length;
  const questionsNotYetGenerated = !assessment.is_adaptive && actualQuestionCount === 0;
  const questionCountLabel = assessment.is_adaptive
    ? adaptiveCap
      ? `Up to ${adaptiveCap} questions (adaptive)`
      : `Adaptive`
    : questionsNotYetGenerated
      ? `Questions pending generation`
      : `${actualQuestionCount} questions`;

  // Re-attempt eligibility (after a terminal attempt, when assignment still has attempts left)
  const assignment = getAssignmentByAssessmentId(assessment.id);
  const isAttemptTerminal =
    attempt && (attempt.status === "submitted" || attempt.status === "evaluated" || attempt.status === "reviewed");
  const reattemptGate = isOwner && isAttemptTerminal ? canStartNewAttempt(assessment.id) : { allowed: false };
  const canReattempt = isOwner && isAttemptTerminal && reattemptGate.allowed;

  // Inline runner mode — replaces the legacy /assessment-exec page
  if (runnerActive && isOwner) {
    const exitRunner = async () => {
      await fetchAssessments();
      await fetchAttempts();
      setRunnerActive(false);
    };
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={exitRunner}
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to Assessment
        </Button>
        {assessment.is_adaptive ? (
          <AdaptiveRunner
            assessment={assessment}
            attemptId={attempt?.id ?? ""}
            employeeId={assessment.employee_id}
            tenantId={assessment.tenant_id}
            employeeName={user?.full_name ?? "Employee"}
            onComplete={exitRunner}
          />
        ) : (
          <FixedRunner assessment={assessment} onComplete={exitRunner} onCancel={exitRunner} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backPath)}
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft size={14} /> {backLabel}
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-foreground">
            {!isOwner && employeeName ? `${employeeName} — ` : ""}
            {domain?.name ?? "Assessment"}
          </h2>
          <Badge className={`text-xs ${config.color}`}>{config.label}</Badge>
          {assessment.is_reassessment && (
            <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
              Reassessment
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {[
            questionCountLabel,
            `${assessment.duration_minutes} min`,
            new Date(assessment.created_at).toLocaleDateString(),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {assignment?.assigned_at && (
          <p className="text-xs text-muted-foreground">
            {assignerName
              ? `Assigned by ${assignerName} on ${new Date(assignment.assigned_at).toLocaleDateString()}`
              : `Assigned on ${new Date(assignment.assigned_at).toLocaleDateString()}`}
          </p>
        )}
      </div>

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Questions</p>
            {assessment.is_adaptive ? (
              <>
                <p className="text-2xl font-bold text-foreground">{adaptiveCap ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">max (adaptive)</p>
              </>
            ) : questionsNotYetGenerated ? (
              <>
                <p className="text-2xl font-bold text-muted-foreground">—</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">pending</p>
              </>
            ) : (
              <p className="text-2xl font-bold text-foreground">{actualQuestionCount}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Duration</p>
            <p className="text-2xl font-bold text-foreground">
              {assessment.duration_minutes}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">min</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Skills</p>
            <p className="text-2xl font-bold text-foreground">{assessment.skill_ids.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Skills list */}
      {skillNames && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Skills: </span>
          {skillNames}
        </div>
      )}

      {/* CTA Buttons */}
      <div className="flex items-center gap-3">
        {isOwner && status === "pending" && (
          <Button onClick={() => handleStartRunner(false)} disabled={startingRunner} className="gap-1.5">
            {startingRunner ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Start Assessment
          </Button>
        )}
        {isOwner && status === "in_progress" && (
          <Button onClick={() => handleStartRunner(false)} disabled={startingRunner} className="gap-1.5">
            {startingRunner ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Resume Assessment
          </Button>
        )}
        {canReattempt && (
          <div className="flex items-center gap-2">
            <Button onClick={handleReattempt} disabled={startingRunner} variant="outline" className="gap-1.5">
              {startingRunner ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Re-attempt
            </Button>
            {assignment && (
              <span className="text-xs text-muted-foreground">
                Attempt {assignment.attempt_count}/{assignment.max_attempts}
              </span>
            )}
          </div>
        )}
        {isOwner && isAttemptTerminal && !reattemptGate.allowed && assignment && (
          <span className="text-xs text-muted-foreground">
            Attempt {assignment.attempt_count}/{assignment.max_attempts} · Max attempts reached
          </span>
        )}
        {isPendingEval && isOwner && (
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs text-warning border-warning/20 gap-1 cursor-help">
                    <Loader2 size={12} className="animate-spin" /> Pending Evaluation
                  </Badge>
                </TooltipTrigger>
                {attempt?.evaluation_error && (
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs font-medium mb-1">Last error:</p>
                    <p className="text-xs">{attempt.evaluation_error}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!attempt) return;
                const qMap = new Map<string, Question>(
                  assessment.assessment_questions
                    .map((aq) => [aq.question_id, questionMap.get(aq.question_id)!] as [string, Question])
                    .filter(([, q]) => q != null),
                );
                try {
                  toast.info("Retrying AI evaluation...");
                  await retryEvaluation(attempt.id, qMap as Map<string, any>, assessment.assessment_questions);
                  toast.success("AI evaluation completed.");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Retry failed.");
                }
              }}
              className="gap-1.5"
            >
              <RotateCcw size={14} /> Retry Evaluation
            </Button>
          </div>
        )}

        {/* Admin override: Regenerate */}
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmRegenerate(true)}
            className="gap-1.5 text-warning"
            disabled={regenerating}
          >
            <RefreshCw size={14} className={regenerating ? "animate-spin" : ""} /> Regenerate Assessment
          </Button>
        )}
      </div>

      {/* Result Summary — terminal attempts only */}
      {isAttemptTerminal && attempt && (
        <ResultSummaryCard attempt={attempt} review={review} />
      )}

      {/* Assessment Questions list — collapsible.
          - Admins/managers always see it (editable when canManage).
          - Owners see it once the attempt is terminal (read-only) with a Result column. */}
      {assessment.assessment_questions.length > 0 && ((!isOwner && isAdmin) || (isOwner && isAttemptTerminal)) && (
        <Collapsible defaultOpen={isOwner ? true : !isAttemptTerminal && !isPendingEval}>
          <div className="rounded-xl border border-border bg-card">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors group">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {isOwner ? "Attempted Questions" : "Assessment Questions"}
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  {assessment.assessment_questions.length}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddQuestionOpen(true);
                    }}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <Plus size={12} /> Add Question
                  </Button>
                )}
                <ChevronDown
                  size={14}
                  className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Question</TableHead>
                      {isOwner && isAttemptTerminal && <TableHead className="w-28">Result</TableHead>}
                      {canManage && <TableHead className="w-16 text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assessment.assessment_questions.map((aq, idx) => {
                      const q = questionMap.get(aq.question_id);
                      const ev = evalByQuestionId.get(aq.question_id);
                      const isMCQ = q?.question_type === "mcq";
                      let resultBadge: JSX.Element = (
                        <Badge variant="outline" className="text-[10px]">
                          —
                        </Badge>
                      );
                      if (ev) {
                        const correct = isMCQ ? ev.score === 100 : ev.score >= 50;
                        resultBadge = correct ? (
                          <Badge className="text-[10px] bg-success/15 text-success border-success/20 gap-1">
                            <CheckCircle size={10} /> Correct
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-destructive/15 text-destructive border-destructive/20 gap-1">
                            <span className="inline-flex items-center gap-1">✗ Incorrect</span>
                          </Badge>
                        );
                      }
                      const previewText = q ? getQuestionPreviewText(q.question_text, q.question_type) : aq.question_id;
                      const fullText = q ? getQuestionDisplayText(q.question_text, q.question_type) : aq.question_id;
                      const lvlNum = levelNumberMap.get(aq.target_level);
                      const lvlLabel = levelLabelMap.get(aq.target_level) || aq.target_level;
                      const skillName = skillMap.get(aq.skill_id)?.skill_name || aq.skill_id;
                      return (
                        <TableRow key={aq.question_id} className="align-top">
                          <TableCell className="text-xs text-muted-foreground pt-3">{idx + 1}</TableCell>
                          <TableCell className="py-3">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-sm text-foreground line-clamp-2 cursor-help">{previewText}</p>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md whitespace-pre-wrap">{fullText}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <div className="mt-2 flex gap-1 items-start">
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                {skillName}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                {lvlNum != null ? `${lvlLabel}` : lvlLabel}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                                {q?.question_type || "—"}
                              </Badge>
                            </div>
                          </TableCell>
                          {isOwner && isAttemptTerminal && <TableCell className="pt-3">{resultBadge}</TableCell>}
                          {canManage && (
                            <TableCell className="text-right pt-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => setConfirmRemoveQuestion(aq.question_id)}
                              >
                                <Trash2 size={12} />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Per-Question Details — collapsible, default open */}
      {isEvaluated && attempt && (
        <Collapsible defaultOpen>
          <div className="rounded-xl border border-border bg-card">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors group">
              <h3 className="text-sm font-semibold text-foreground">Per-Question Details</h3>
              <ChevronDown
                size={14}
                className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border p-5">
                <EvalResults attempt={attempt} assessment={assessment} />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Manager Review Panel (inline for team assessments) */}
      {!isOwner && review && attempt && (
        <ManagerReviewPanel review={review} attempt={attempt} assessment={assessment} />
      )}

      {/* Confirm Regenerate Dialog */}
      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the current assessment and create a new one with different questions. Previously used
              questions will be excluded. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? "Regenerating…" : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Remove Question Dialog */}
      <AlertDialog open={!!confirmRemoveQuestion} onOpenChange={() => setConfirmRemoveQuestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Question?</AlertDialogTitle>
            <AlertDialogDescription>
              This question will be removed from the assessment. The employee will not see it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemoveQuestion && handleRemoveQuestion(confirmRemoveQuestion)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Question Dialog */}
      <AddQuestionDialog
        open={addQuestionOpen}
        onOpenChange={setAddQuestionOpen}
        skillIds={assessment.skill_ids}
        existingQuestionIds={assessment.assessment_questions.map((q) => q.question_id)}
        onAdd={handleAddQuestions}
      />
    </div>
  );
}
