import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Assessment } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useQuestionStore, questionTypeLabels, Question } from '@/stores/questionStore';
import { useCompetencyLevelStore, getLevelLabelsByIdMap } from '@/stores/competencyLevelStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useRegistryStore } from '@/stores/registryStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Clock, ChevronLeft, ChevronRight, Send, Play, Pause,
  CheckCircle, Circle, AlertTriangle, Flag, RotateCcw,
  SkipForward, Loader2,
} from 'lucide-react';

// ── Timer with pause/resume ──
function Timer({ totalSeconds, isPaused, onTimeUp, onTick }: { totalSeconds: number; isPaused: boolean; onTimeUp: () => void; onTick: (s: number) => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  useEffect(() => { setRemaining(totalSeconds); }, [totalSeconds]);
  useEffect(() => {
    if (isPaused || remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { onTimeUp(); return 0; }
        const next = r - 1;
        onTick(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, remaining, onTimeUp, onTick]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining < 300;

  return (
    <div className={`flex items-center gap-1.5 font-mono text-sm font-medium ${isLow ? 'text-destructive' : 'text-foreground'}`}>
      <Clock size={14} />
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}

function parseMCQOptions(text: string) {
  try {
    const parsed = JSON.parse(text);
    if (parsed.questionText && Array.isArray(parsed.options)) {
      return {
        body: parsed.questionText,
        optionLines: parsed.options.map((opt: string, i: number) => ({
          key: String.fromCharCode(65 + i),
          text: opt,
        })),
      };
    }
  } catch { /* not JSON */ }
  const lines = text.split('\n');
  const optionPattern = /^([A-D])\)\s*(.+)/;
  const optionLines: { key: string; text: string }[] = [];
  const bodyLines: string[] = [];
  for (const line of lines) {
    const match = line.match(optionPattern);
    if (match) optionLines.push({ key: match[1], text: match[2] });
    else bodyLines.push(line);
  }
  return { body: bodyLines.join('\n').trim(), optionLines };
}

function parseCodingQuestion(text: string) {
  try {
    const parsed = JSON.parse(text);
    if (parsed.problemStatement) return parsed;
  } catch { /* not JSON */ }
  return null;
}

function parseScenarioQuestion(text: string) {
  try {
    const parsed = JSON.parse(text);
    return parsed.question_text || parsed.questionText || text;
  } catch { /* not JSON */ }
  return text;
}

interface Props {
  assessment: Assessment;
  onComplete: () => void;
  onCancel: () => void;
}

export default function FixedRunner({ assessment, onComplete, onCancel }: Props) {
  const { saveAnswer, submitAttempt, getAttemptForAssessment, pauseAttempt, resumeAttempt } = useAttemptStore();
  const { updateAssessmentStatus, fetchAssessments } = useAssessmentStore();
  const { questions, fetchQuestions } = useQuestionStore();
  const { levels: competencyLevels, fetchLevels } = useCompetencyLevelStore();
  const { skills, fetchSkills } = useSkillStore();
  const { user } = useAuth();

  useEffect(() => {
    fetchQuestions(); fetchSkills(); fetchLevels();
  }, []);

  const dynamicLabels = useMemo(() => getLevelLabelsByIdMap(competencyLevels), [competencyLevels]);
  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  const currentQuestions = assessment.assessment_questions;

  // Initialize answers/timeSpent from existing attempt
  const initialAttempt = getAttemptForAssessment(assessment.id);
  const initialAnswers: Record<string, string> = {};
  const initialTimeSpent: Record<string, number> = {};
  if (initialAttempt?.answers?.length) {
    for (const ans of initialAttempt.answers) {
      initialAnswers[ans.question_id] = ans.answer_text;
      initialTimeSpent[ans.question_id] = ans.time_spent_seconds;
    }
  }
  const totalSeconds = assessment.duration_minutes * 60;
  const initialRemaining = initialAttempt?.remaining_seconds ?? totalSeconds;

  // Resume at the first unanswered question. If everything is answered (e.g.
  // user paused on the last one after answering all), stay on the last one.
  const initialIdx = (() => {
    if (!initialAttempt?.answers?.length) return 0;
    const firstUnanswered = currentQuestions.findIndex(
      (aq) => !initialAnswers[aq.question_id]?.trim(),
    );
    if (firstUnanswered === -1) return Math.max(0, currentQuestions.length - 1);
    return firstUnanswered;
  })();

  const [currentIdx, setCurrentIdx] = useState(initialIdx);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>(initialTimeSpent);
  const [isPaused, setIsPaused] = useState(!!initialAttempt?.paused_at);
  const [timerSeconds, setTimerSeconds] = useState(initialRemaining);
  const timerRef = useRef(initialRemaining);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentAQ = currentQuestions[currentIdx];
  const currentQuestion = currentAQ ? questionMap.get(currentAQ.question_id) : null;
  const answeredCount = currentQuestions.filter((aq) => answers[aq.question_id]?.trim()).length;

  // Auto-resume if paused
  useEffect(() => {
    if (initialAttempt?.paused_at) {
      resumeAttempt(initialAttempt.id).then(() => setIsPaused(false));
    }
  }, []);

  const recordTimeSpent = useCallback(() => {
    if (!currentAQ) return;
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setTimeSpent((prev) => ({ ...prev, [currentAQ.question_id]: (prev[currentAQ.question_id] ?? 0) + elapsed }));
  }, [currentAQ, questionStartTime]);

  const saveCurrentAnswer = useCallback(async () => {
    if (!currentAQ) return;
    const attempt = getAttemptForAssessment(assessment.id);
    if (!attempt) return;
    const answerText = answers[currentAQ.question_id] ?? '';
    const time = timeSpent[currentAQ.question_id] ?? 0;
    if (answerText.trim()) {
      await saveAnswer(attempt.id, { question_id: currentAQ.question_id, answer_text: answerText, time_spent_seconds: time });
    }
  }, [assessment, currentAQ, answers, timeSpent, getAttemptForAssessment, saveAnswer]);

  const goTo = useCallback(async (idx: number) => {
    recordTimeSpent();
    await saveCurrentAnswer();
    setCurrentIdx(idx);
    setQuestionStartTime(Date.now());
  }, [recordTimeSpent, saveCurrentAnswer]);

  const handlePause = async () => {
    const attempt = getAttemptForAssessment(assessment.id);
    if (!attempt) return;
    recordTimeSpent();
    await saveCurrentAnswer();
    await pauseAttempt(attempt.id, timerRef.current);
    setIsPaused(true);
    toast.info('Assessment paused. Your progress has been saved.');
  };

  const handleResume = async () => {
    const attempt = getAttemptForAssessment(assessment.id);
    if (!attempt) return;
    await resumeAttempt(attempt.id);
    setIsPaused(false);
    setQuestionStartTime(Date.now());
  };

  const doSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    recordTimeSpent();
    const attempt = getAttemptForAssessment(assessment.id);
    if (!attempt) { setIsSubmitting(false); return; }

    for (const aq of currentQuestions) {
      await saveAnswer(attempt.id, {
        question_id: aq.question_id,
        answer_text: answers[aq.question_id] ?? '',
        time_spent_seconds: timeSpent[aq.question_id] ?? 0,
      });
    }

    const qMap = new Map<string, any>();
    for (const aq of currentQuestions) {
      const q = questionMap.get(aq.question_id);
      if (q) qMap.set(aq.question_id, q);
    }

    let evalFailed = false;
    let evalErrorMsg = '';
    try {
      await submitAttempt(attempt.id, qMap as Map<string, Question>, assessment.assessment_questions);
    } catch (err) {
      evalFailed = true;
      evalErrorMsg = err instanceof Error ? err.message : 'AI evaluation failed.';
    }
    await updateAssessmentStatus(assessment.id, 'completed');

    // Auto-create manager review (when evaluation produced skill scores)
    const updatedAttempt = useAttemptStore.getState().getAttemptForAssessment(assessment.id);
    if (updatedAttempt && updatedAttempt.skill_scores.length > 0) {
      const { submissions } = useRegistryStore.getState();
      const submission = submissions.find((s) => s.employee_id === employeeId);
      const selfRatings = submission?.ratings?.map((r) => ({ skill_id: r.skill_id, rating: r.rating })) ?? [];

      let reviewerId = '';
      const { data: domainRow } = await supabase.from('domains').select('domain_lead_id').eq('id', assessment.domain_id).single();
      if (domainRow?.domain_lead_id) {
        reviewerId = domainRow.domain_lead_id;
      } else {
        const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin').eq('status', 'active').limit(1);
        reviewerId = admins?.[0]?.id ?? '';
      }

      if (reviewerId) {
        await useReviewStore.getState().createReview({
          tenant_id: tenantId,
          assessment_id: assessment.id,
          attempt_id: updatedAttempt.id,
          employee_id: employeeId,
          employee_name: user?.full_name ?? 'Employee',
          domain_id: assessment.domain_id,
          reviewer_id: reviewerId,
          skill_scores: updatedAttempt.skill_scores,
          self_ratings: selfRatings,
        });
      }
    }

    setConfirmSubmitOpen(false);
    setIsSubmitting(false);
    await fetchAssessments();
    if (evalFailed) {
      toast.error(`Submitted, but evaluation failed: ${evalErrorMsg}. You can retry from the assessment list.`);
    } else {
      toast.success('Assessment submitted! AI evaluation complete.');
    }
    onComplete();
  };

  const handleSubmit = () => {
    if (answeredCount < currentQuestions.length) { setConfirmSubmitOpen(true); return; }
    doSubmit();
  };

  const handleTimeUp = useCallback(() => {
    toast.warning('Time is up! Auto-submitting your assessment.');
    doSubmit();
  }, [answers, currentQuestions, timeSpent]);

  const toggleReview = (qId: string) => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const resetAnswer = () => {
    if (!currentAQ) return;
    setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: '' }));
  };

  const mcqData = currentQuestion?.question_type === 'mcq' ? parseMCQOptions(currentQuestion.question_text) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">
            {isPaused ? '⏸ Assessment Paused' : 'Assessment In Progress'}
          </h3>
          <p className="text-xs text-muted-foreground">
            Q{currentIdx + 1}/{currentQuestions.length} · {answeredCount} answered · {markedForReview.size} flagged
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Timer
            totalSeconds={timerSeconds}
            isPaused={isPaused}
            onTimeUp={handleTimeUp}
            onTick={(s) => { timerRef.current = s; }}
          />
          <Button size="sm" variant="ghost" onClick={isPaused ? handleResume : handlePause} className="gap-1.5">
            {isPaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="gap-1.5">
            Exit
          </Button>
          <Button size="sm" variant="default" onClick={handleSubmit} disabled={isPaused || isSubmitting} className="gap-1.5">
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit
          </Button>
        </div>
      </div>

      {isPaused && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Pause size={48} className="text-muted-foreground mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Assessment Paused</h2>
            <p className="text-sm text-muted-foreground">Your progress has been saved. Click Resume to continue.</p>
            <Button onClick={handleResume} className="gap-1.5"><Play size={14} /> Resume Assessment</Button>
          </div>
        </div>
      )}

      {!isPaused && (
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Left sidebar — question navigator */}
          <div className="w-16 shrink-0 rounded-xl border border-border bg-card p-2 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              {currentQuestions.map((aq, i) => {
                const hasAnswer = !!answers[aq.question_id]?.trim();
                const isCurrent = i === currentIdx;
                const isReview = markedForReview.has(aq.question_id);
                let btnClass = 'bg-muted text-muted-foreground hover:bg-accent/10';
                if (isCurrent) btnClass = 'bg-primary text-primary-foreground shadow-sm';
                else if (isReview) btnClass = 'bg-warning/15 text-warning border border-warning/30';
                else if (hasAnswer) btnClass = 'bg-success/15 text-success border border-success/20';

                return (
                  <button
                    key={aq.question_id}
                    onClick={() => goTo(i)}
                    className={`flex h-9 w-full items-center justify-center rounded-lg text-xs font-semibold transition-all ${btnClass}`}
                    title={`Q${i + 1}${hasAnswer ? ' ✓' : ''}${isReview ? ' ⚑' : ''}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main panel */}
          <div className="flex-1 rounded-xl border border-border bg-card p-6 overflow-y-auto">
            {currentQuestion ? (
              <div className="space-y-5 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{skillMap.get(currentAQ.skill_id)?.skill_name ?? 'Unknown'}</Badge>
                  <Badge variant="outline" className="text-xs">{dynamicLabels[currentAQ.target_level] || currentAQ.target_level}</Badge>
                  <Badge variant="outline" className="text-xs">{questionTypeLabels[currentQuestion.question_type]}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">Q{currentIdx + 1}/{currentQuestions.length}</span>
                </div>

                {currentQuestion.question_type === 'mcq' && mcqData ? (
                  <div className="space-y-4">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{mcqData.body}</p>
                    <RadioGroup
                      value={answers[currentAQ.question_id] ?? ''}
                      onValueChange={(val) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: val }))}
                      className="space-y-2"
                    >
                      {mcqData.optionLines.map((opt) => (
                        <label key={opt.key} className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${answers[currentAQ.question_id] === opt.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                          <RadioGroupItem value={opt.key} id={`opt-${opt.key}`} />
                          <Label htmlFor={`opt-${opt.key}`} className="text-sm text-foreground cursor-pointer flex-1">
                            <span className="font-semibold mr-1.5">{opt.key})</span> {opt.text}
                          </Label>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                ) : currentQuestion.question_type === 'coding' ? (() => {
                  const codingData = parseCodingQuestion(currentQuestion.question_text);
                  return (
                    <div className="space-y-4">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{codingData ? codingData.problemStatement : currentQuestion.question_text}</p>
                      {codingData?.exampleInput && (
                        <div className="rounded-lg bg-muted p-3 space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">Example Input</p>
                          <pre className="text-xs font-mono text-foreground">{codingData.exampleInput}</pre>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Your Code</Label>
                        <Textarea
                          value={answers[currentAQ.question_id] ?? ''}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: e.target.value }))}
                          placeholder="Write your code here..."
                          rows={12}
                          maxLength={5000}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1 text-right">{(answers[currentAQ.question_id] ?? '').length}/5000</p>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="space-y-4">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{parseScenarioQuestion(currentQuestion.question_text)}</p>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Your Answer</Label>
                      <Textarea
                        value={answers[currentAQ.question_id] ?? ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: e.target.value }))}
                        placeholder="Write your answer here..."
                        rows={8}
                        maxLength={5000}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1 text-right">{(answers[currentAQ.question_id] ?? '').length}/5000</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0} className="gap-1">
                      <ChevronLeft size={14} /> Prev
                    </Button>
                    {currentIdx < currentQuestions.length - 1 && (
                      <Button variant="outline" size="sm" onClick={() => goTo(currentIdx + 1)} className="gap-1">
                        Skip <SkipForward size={14} />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetAnswer}
                      disabled={!answers[currentAQ.question_id]?.trim()}
                      className="gap-1 text-muted-foreground"
                    >
                      <RotateCcw size={12} /> Reset
                    </Button>
                    <Button
                      variant={markedForReview.has(currentAQ.question_id) ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleReview(currentAQ.question_id)}
                      className="gap-1"
                    >
                      <Flag size={12} className={markedForReview.has(currentAQ.question_id) ? 'text-warning' : ''} />
                      {markedForReview.has(currentAQ.question_id) ? 'Flagged' : 'Flag'}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {answers[currentAQ.question_id]?.trim() ? (
                      <span className="text-xs text-success flex items-center gap-1"><CheckCircle size={12} /> Answered</span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Circle size={12} /> Not answered</span>
                    )}
                    {currentIdx < currentQuestions.length - 1 ? (
                      <Button variant="outline" size="sm" onClick={() => goTo(currentIdx + 1)} className="gap-1">
                        Next <ChevronRight size={14} />
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleSubmit} disabled={isSubmitting} className="gap-1">
                        {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No question data available.</p>
            )}
          </div>
        </div>
      )}

      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle size={18} className="text-warning" /> Incomplete Assessment</DialogTitle>
            <DialogDescription>You have answered {answeredCount} of {currentQuestions.length} questions. Unanswered questions will receive a score of 0.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>Continue Assessment</Button>
            <Button variant="destructive" onClick={doSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null} Submit Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
