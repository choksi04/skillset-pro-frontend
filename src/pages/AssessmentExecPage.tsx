import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssessmentStore, Assessment } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useQuestionStore, competencyLabels, questionTypeLabels } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useAuth } from '@/contexts/AuthContext';
import EvalResults from '@/components/assessment/EvalResults';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useReviewStore } from '@/stores/reviewStore';
import { useRegistryStore } from '@/stores/registryStore';
import { toast } from 'sonner';
import {
  Clock, ChevronLeft, ChevronRight, Send, Play, BarChart3,
  CheckCircle, Circle, AlertTriangle, ClipboardCheck,
} from 'lucide-react';

// Timer component
function Timer({ totalSeconds, onTimeUp }: { totalSeconds: number; onTimeUp: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (remaining <= 0) { onTimeUp(); return; }
    const interval = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(interval);
  }, [remaining, onTimeUp]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining < 300; // < 5 min

  return (
    <div className={`flex items-center gap-1.5 font-mono text-sm font-medium ${isLow ? 'text-destructive' : 'text-foreground'}`}>
      <Clock size={14} />
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}

// MCQ parser — expects lines like "A) option text"
function parseMCQOptions(text: string): { prefix: string; body: string; optionLines: { key: string; text: string }[] } {
  const lines = text.split('\n');
  const optionPattern = /^([A-D])\)\s*(.+)/;
  const optionLines: { key: string; text: string }[] = [];
  const bodyLines: string[] = [];

  for (const line of lines) {
    const match = line.match(optionPattern);
    if (match) {
      optionLines.push({ key: match[1], text: match[2] });
    } else {
      bodyLines.push(line);
    }
  }

  return { prefix: '', body: bodyLines.join('\n').trim(), optionLines };
}

export default function AssessmentExecPage() {
  const { assessments, updateAssessmentStatus, fetchAssessments } = useAssessmentStore();
  const { startAttempt, saveAnswer, submitAttempt, getAttemptForAssessment, fetchAttempts } = useAttemptStore();

  useEffect(() => { fetchAssessments(); fetchAttempts(); }, [fetchAssessments, fetchAttempts]);
  const { questions } = useQuestionStore();
  const { skills } = useSkillStore();
  const { domains } = useDomainStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  // Get employee's pending assessments
  const myAssessments = useMemo(
    () => assessments.filter((a) => a.employee_id === employeeId),
    [assessments, employeeId]
  );

  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [viewResultsId, setViewResultsId] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});

  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  const currentQuestions = activeAssessment?.assessment_questions ?? [];
  const currentAQ = currentQuestions[currentIdx];
  const currentQuestion = currentAQ ? questionMap.get(currentAQ.question_id) : null;

  const answeredCount = currentQuestions.filter((aq) => answers[aq.question_id]?.trim()).length;

  // Track time on each question
  const recordTimeSpent = useCallback(() => {
    if (!currentAQ) return;
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setTimeSpent((prev) => ({
      ...prev,
      [currentAQ.question_id]: (prev[currentAQ.question_id] ?? 0) + elapsed,
    }));
  }, [currentAQ, questionStartTime]);

  const goTo = useCallback((idx: number) => {
    recordTimeSpent();
    setCurrentIdx(idx);
    setQuestionStartTime(Date.now());
  }, [recordTimeSpent]);

  const handleStartAssessment = async (assessment: Assessment) => {
    const attempt = getAttemptForAssessment(assessment.id);
    if (attempt && (attempt.status === 'evaluated' || attempt.status === 'submitted' || attempt.status === 'reviewed')) {
      toast.info('This assessment has already been submitted.');
      return;
    }

    await startAttempt(assessment.id, tenantId, employeeId);
    await updateAssessmentStatus(assessment.id, 'in_progress');
    setActiveAssessment(assessment);
    setCurrentIdx(0);
    setAnswers({});
    setTimeSpent({});
    setQuestionStartTime(Date.now());
  };

  const handleSubmit = () => {
    if (answeredCount < currentQuestions.length) {
      setConfirmSubmitOpen(true);
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {
    if (!activeAssessment) return;
    recordTimeSpent();

    const attempt = getAttemptForAssessment(activeAssessment.id);
    if (!attempt) return;

    // Save all answers
    for (const aq of currentQuestions) {
      await saveAnswer(attempt.id, {
        question_id: aq.question_id,
        answer_text: answers[aq.question_id] ?? '',
        time_spent_seconds: timeSpent[aq.question_id] ?? 0,
      });
    }

    // Submit and trigger AI eval
    const qMap = new Map(currentQuestions.map((aq) => {
      const q = questionMap.get(aq.question_id);
      return [aq.question_id, q!] as const;
    }).filter(([, q]) => q != null));
    await submitAttempt(attempt.id, qMap as Map<string, any>, activeAssessment.assessment_questions);
    await updateAssessmentStatus(activeAssessment.id, 'completed');

    // Auto-create manager review
    const updatedAttempt = useAttemptStore.getState().getAttemptForAssessment(activeAssessment.id);
    if (updatedAttempt && updatedAttempt.skill_scores.length > 0) {
      const { submissions } = useRegistryStore.getState();
      const submission = submissions.find((s) => s.employee_id === employeeId);
      const selfRatings = submission?.ratings?.map((r) => ({ skill_id: r.skill_id, rating: r.rating })) ?? [];

      useReviewStore.getState().createReview({
        tenant_id: tenantId,
        assessment_id: activeAssessment.id,
        attempt_id: updatedAttempt.id,
        employee_id: employeeId,
        employee_name: user?.full_name ?? 'Employee',
        domain_id: activeAssessment.domain_id,
        reviewer_id: 'user-001',
        skill_scores: updatedAttempt.skill_scores,
        self_ratings: selfRatings,
      });
    }

    setConfirmSubmitOpen(false);
    setActiveAssessment(null);
    toast.success('Assessment submitted! AI evaluation complete. Manager review created.');
  };

  const handleTimeUp = useCallback(() => {
    toast.warning('Time is up! Auto-submitting your assessment.');
    doSubmit();
  }, [activeAssessment, answers, currentQuestions, timeSpent]);

  // Assessment list (no active assessment)
  if (!activeAssessment) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Complete your assigned skill assessments. Each assessment is timed.
        </p>

        {myAssessments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ClipboardCheck size={32} className="text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-1">No Assessments Assigned</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Submit your skill self-assessment in the Skill Registry to generate an assessment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myAssessments.map((assessment) => {
              const domain = domains.find((d) => d.id === assessment.domain_id);
              const attempt = getAttemptForAssessment(assessment.id);
              const isCompleted = attempt?.status === 'evaluated' || attempt?.status === 'reviewed' || assessment.status === 'completed';

              return (
                <div key={assessment.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-card-foreground">
                        {domain?.name ?? 'Assessment'} — Skill Validation
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {assessment.assessment_questions.length} questions · {assessment.duration_minutes} min ·{' '}
                        {assessment.skill_ids.map((id) => skillMap.get(id)?.skill_name).filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setViewResultsId(viewResultsId === assessment.id ? null : assessment.id)} className="gap-1.5">
                            <BarChart3 size={14} /> {viewResultsId === assessment.id ? 'Hide Results' : 'View Results'}
                          </Button>
                          <Badge className="bg-success/15 text-success border-success/20 gap-1 text-xs">
                            <CheckCircle size={12} /> Completed
                          </Badge>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => handleStartAssessment(assessment)} className="gap-1.5">
                          <Play size={14} /> Start Assessment
                        </Button>
                      )}
                    </div>
                  </div>
                  {attempt?.total_ai_score != null && viewResultsId !== assessment.id && (
                    <div className="mt-3 rounded-lg bg-muted/30 px-3 py-2 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">AI Score:</span>
                      <span className={`text-lg font-semibold ${
                        attempt.total_ai_score >= 75 ? 'text-success' :
                        attempt.total_ai_score >= 50 ? 'text-warning' : 'text-destructive'
                      }`}>
                        {attempt.total_ai_score}%
                      </span>
                      <Badge variant="outline" className="text-xs ml-auto">Pending Manager Review</Badge>
                    </div>
                  )}
                  {viewResultsId === assessment.id && attempt && (
                    <div className="mt-4 border-t border-border pt-4">
                      <EvalResults attempt={attempt} assessment={assessment} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Active assessment UI
  const mcqData = currentQuestion?.question_type === 'mcq'
    ? parseMCQOptions(currentQuestion.question_text)
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">
            Assessment In Progress
          </h3>
          <p className="text-xs text-muted-foreground">
            Question {currentIdx + 1} of {currentQuestions.length} · {answeredCount} answered
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Timer
            totalSeconds={activeAssessment.duration_minutes * 60}
            onTimeUp={handleTimeUp}
          />
          <Button size="sm" variant="outline" onClick={handleSubmit} className="gap-1.5">
            <Send size={14} /> Submit
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Question navigator sidebar */}
        <div className="w-16 shrink-0 rounded-xl border border-border bg-card p-2 overflow-y-auto">
          <div className="grid grid-cols-2 gap-1">
            {currentQuestions.map((aq, i) => {
              const hasAnswer = !!answers[aq.question_id]?.trim();
              const isCurrent = i === currentIdx;
              return (
                <button
                  key={aq.question_id}
                  onClick={() => goTo(i)}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-all ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : hasAnswer
                      ? 'bg-success/15 text-success border border-success/20'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main question area */}
        <div className="flex-1 rounded-xl border border-border bg-card p-6 overflow-y-auto">
          {currentQuestion ? (
            <div className="space-y-5 max-w-2xl">
              {/* Question meta */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {skillMap.get(currentAQ.skill_id)?.skill_name ?? 'Unknown'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {competencyLabels[currentAQ.target_level]}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {questionTypeLabels[currentQuestion.question_type]}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  Q{currentIdx + 1}/{currentQuestions.length}
                </span>
              </div>

              {/* Question text */}
              {currentQuestion.question_type === 'mcq' && mcqData ? (
                <div className="space-y-4">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {mcqData.body}
                  </p>
                  <RadioGroup
                    value={answers[currentAQ.question_id] ?? ''}
                    onValueChange={(val) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: val }))}
                    className="space-y-2"
                  >
                    {mcqData.optionLines.map((opt) => (
                      <label
                        key={opt.key}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                          answers[currentAQ.question_id] === opt.key
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <RadioGroupItem value={opt.key} id={`opt-${opt.key}`} />
                        <Label htmlFor={`opt-${opt.key}`} className="text-sm text-foreground cursor-pointer flex-1">
                          <span className="font-semibold mr-1.5">{opt.key})</span> {opt.text}
                        </Label>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {currentQuestion.question_text}
                  </p>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                      {currentQuestion.question_type === 'coding' ? 'Your Code' : 'Your Answer'}
                    </Label>
                    <Textarea
                      value={answers[currentAQ.question_id] ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: e.target.value }))}
                      placeholder={
                        currentQuestion.question_type === 'coding'
                          ? 'Write your code here...'
                          : 'Write your answer here...'
                      }
                      rows={currentQuestion.question_type === 'coding' ? 12 : 8}
                      maxLength={5000}
                      className={currentQuestion.question_type === 'coding' ? 'font-mono text-sm' : 'text-sm'}
                    />
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      {(answers[currentAQ.question_id] ?? '').length}/5000
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goTo(currentIdx - 1)}
                  disabled={currentIdx === 0}
                  className="gap-1"
                >
                  <ChevronLeft size={14} /> Previous
                </Button>
                <div className="flex items-center gap-1.5">
                  {answers[currentAQ.question_id]?.trim() ? (
                    <CheckCircle size={14} className="text-success" />
                  ) : (
                    <Circle size={14} className="text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {answers[currentAQ.question_id]?.trim() ? 'Answered' : 'Not answered'}
                  </span>
                </div>
                {currentIdx < currentQuestions.length - 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goTo(currentIdx + 1)}
                    className="gap-1"
                  >
                    Next <ChevronRight size={14} />
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleSubmit} className="gap-1">
                    <Send size={14} /> Submit Assessment
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No question data available.</p>
          )}
        </div>
      </div>

      {/* Confirm submit dialog */}
      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning" /> Incomplete Assessment
            </DialogTitle>
            <DialogDescription>
              You have answered {answeredCount} of {currentQuestions.length} questions.
              Unanswered questions will receive a score of 0. Are you sure you want to submit?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>Continue Assessment</Button>
            <Button variant="destructive" onClick={doSubmit}>Submit Anyway</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
