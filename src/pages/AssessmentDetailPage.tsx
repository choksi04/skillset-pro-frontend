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
import ManagerReviewPanel from "@/components/assessment/ManagerReviewPanel";
import AddQuestionDialog from "@/components/assessment/AddQuestionDialog";
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
} from "lucide-react";
import { getQuestionPreviewText } from "@/lib/questionContent";

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
  const { getAttemptForAssessment, fetchAttempts, retryEvaluation } = useAttemptStore();
  const { questions, fetchQuestions } = useQuestionStore();
  const { skills, fetchSkills } = useSkillStore();
  const { domains, fetchDomains } = useDomainStore();
  const { reviews, fetchReviews } = useReviewStore();
  const { submissions, fetchRegistry, markAssessmentGenerated } = useRegistryStore();
  const { user } = useAuth();

  const [employeeName, setEmployeeName] = useState("");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [confirmRemoveQuestion, setConfirmRemoveQuestion] = useState<string | null>(null);

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
            `${assessment.assessment_questions.length} questions`,
            `${assessment.duration_minutes} min`,
            new Date(assessment.created_at).toLocaleDateString(),
          ]
            .filter(Boolean)
            .join(" · ")}
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
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">AI Score</p>
            {attempt?.total_ai_score != null ? (
              <p
                className={`text-2xl font-bold ${attempt.total_ai_score >= 75 ? "text-success" : attempt.total_ai_score >= 50 ? "text-warning" : "text-destructive"}`}
              >
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
          <span className="font-medium text-foreground">Skills: </span>
          {skillNames}
        </div>
      )}

      {/* CTA Buttons */}
      <div className="flex items-center gap-3">
        {isOwner && status === "pending" && (
          <Button onClick={() => navigate(`/assessment-exec?startId=${assessment.id}`)} className="gap-1.5">
            <Play size={14} /> Start Assessment
          </Button>
        )}
        {isOwner && status === "in_progress" && (
          <Button onClick={() => navigate(`/assessment-exec?startId=${assessment.id}`)} className="gap-1.5">
            <Play size={14} /> Resume Assessment
          </Button>
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

      {/* Admin: Question Management for pending assessments */}
      {canManage && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Assessment Questions</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddQuestionOpen(true)}
              className="gap-1.5 h-7 text-xs"
            >
              <Plus size={12} /> Add Question
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-16 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessment.assessment_questions.map((aq, idx) => {
                  const q = questionMap.get(aq.question_id);
                  return (
                    <TableRow key={aq.question_id}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell
                        className="text-sm text-foreground max-w-xs truncate"
                        title={q ? getQuestionPreviewText(q.question_text, q.question_type) : aq.question_id}
                      >
                        {q ? getQuestionPreviewText(q.question_text, q.question_type) : aq.question_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {skillMap.get(aq.skill_id)?.skill_name || aq.skill_id}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(() => {
                          const lvl = levelNumberMap.get(aq.target_level);
                          const label = levelLabelMap.get(aq.target_level) || aq.target_level;
                          return lvl != null ? `L${lvl} - ${label}` : label;
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{q?.question_type || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => setConfirmRemoveQuestion(aq.question_id)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Evaluation Results */}
      {isEvaluated && attempt && <EvalResults attempt={attempt} assessment={assessment} />}

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
