import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Assessment } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useQuestionStore, questionTypeLabels, Question } from '@/stores/questionStore';
import { useCompetencyLevelStore, getLevelLabelsByIdMap } from '@/stores/competencyLevelStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getLatestSelfRatings } from '@/lib/selfRatings';
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
  SkipForward, Loader2, ListChecks, ArrowLeft,
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
    <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm font-medium ${isLow ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-border bg-background text-foreground'}`}>
      <Clock size={14} />
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}

// ── Progress ring ──
function ProgressRing({ answered, total }: { answered: number; total: number }) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const r = 18, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="44" height="44" className="-rotate-90">
        <circle cx="22" cy="22" r={r} strokeWidth="4" className="fill-none stroke-muted" />
        <circle cx="22" cy="22" r={r} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} className="fill-none stroke-primary transition-all" />
      </svg>
      <span className="absolute text-[10px] font-semibold text-foreground">{pct}%</span>
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

type NavFilter = 'all' | 'answered' | 'flagged' | 'unanswered';

export default function FixedRunner({ assessment, onComplete, onCancel }: Props) {
  const { saveAnswer, submitAttempt, getAttemptForAssessment, pauseAttempt, resumeAttempt } = useAttemptStore();
  const { updateAssessmentStatus, fetchAssessments } = useAssessmentStore();
  const { questions, fetchQuestionsByIds } = useQuestionStore();
  const { levels: competencyLevels, fetchLevels } = useCompetencyLevelStore();
  const { skills, fetchSkills } = useSkillStore();
  const { user } = useAuth();

  useEffect(() => {
    const qIds = assessment.assessment_questions?.map((aq) => aq.question_id) ?? [];
    if (qIds.length) fetchQuestionsByIds(qIds);
    fetchSkills();
    fetchLevels();
  }, [assessment.id]);

  const dynamicLabels = useMemo(() => getLevelLabelsByIdMap(competencyLevels), [competencyLevels]);
  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  const [topicMap, setTopicMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = Array.from(new Set(
      (assessment.assessment_questions ?? [])
        .map((aq) => questionMap.get(aq.question_id)?.topic_id)
        .filter((v): v is string => !!v)
    ));
    const missing = ids.filter((id) => !(id in topicMap));
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase.from('skill_topics').select('id, name').in('id', missing);
      if (data?.length) {
        setTopicMap((prev) => {
          const next = { ...prev };
          for (const t of data as any[]) next[t.id] = t.name;
          return next;
        });
      }
    })();
  }, [questionMap, assessment.assessment_questions]);

  const currentQuestions = assessment.assessment_questions;

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
  // If time already ran out in a prior visit, start paused so we don't auto-submit
  // just because the component remounted.
  const startPaused = !!initialAttempt?.paused_at || initialRemaining <= 0;

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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [navFilter, setNavFilter] = useState<NavFilter>('all');
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>(initialTimeSpent);
  const [isPaused, setIsPaused] = useState(startPaused);
  const [timerSeconds, setTimerSeconds] = useState(initialRemaining);
  const timerRef = useRef(initialRemaining);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isOpeningReview, setIsOpeningReview] = useState(false);
  const busy = isNavigating || isPausing || isResuming || isExiting || isOpeningReview || isSubmitting;

  const currentAQ = currentQuestions[currentIdx];
  const currentQuestion = currentAQ ? questionMap.get(currentAQ.question_id) : null;
  const answeredCount = currentQuestions.filter((aq) => answers[aq.question_id]?.trim()).length;

  // Keep refs mirrored for unmount-time access
  const answersRef = useRef(answers); answersRef.current = answers;
  const timeSpentRef = useRef(timeSpent); timeSpentRef.current = timeSpent;
  const currentIdxRef = useRef(currentIdx); currentIdxRef.current = currentIdx;
  const isPausedRef = useRef(isPaused); isPausedRef.current = isPaused;

  // If the last known state was paused, don't auto-resume — require explicit Resume.
  // (Removed the previous auto-resume-on-mount behavior that caused surprise submits.)

  // ── Auto-pause on unmount / tab hidden / beforeunload ──
  useEffect(() => {
    const persistPause = () => {
      const attempt = getAttemptForAssessment(assessment.id);
      if (!attempt) return;
      if (isSubmittingRef.current) return;
      if (attempt.status !== 'in_progress') return;
      if (isPausedRef.current) return;

      // Save the current answer (best-effort; async but we don't await)
      const aq = currentQuestions[currentIdxRef.current];
      if (aq) {
        const answerText = answersRef.current[aq.question_id] ?? '';
        const time = timeSpentRef.current[aq.question_id] ?? 0;
        if (answerText.trim()) {
          saveAnswer(attempt.id, {
            question_id: aq.question_id,
            answer_text: answerText,
            time_spent_seconds: time,
          }).catch(() => { /* best-effort */ });
        }
      }
      pauseAttempt(attempt.id, timerRef.current).catch(() => { /* best-effort */ });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistPause();
    };
    const onBeforeUnload = () => persistPause();

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      // Component unmounting (navigated away) — auto-pause instead of auto-submit.
      persistPause();
    };
  }, [assessment.id, currentQuestions, getAttemptForAssessment, pauseAttempt, saveAnswer]);

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
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      recordTimeSpent();
      await saveCurrentAnswer();
      setCurrentIdx(idx);
      setQuestionStartTime(Date.now());
    } finally {
      setIsNavigating(false);
    }
  }, [recordTimeSpent, saveCurrentAnswer, isNavigating]);

  const handlePause = async () => {
    const attempt = getAttemptForAssessment(assessment.id);
    if (!attempt) return;
    if (isPausing) return;
    setIsPausing(true);
    try {
      recordTimeSpent();
      await saveCurrentAnswer();
      await pauseAttempt(attempt.id, timerRef.current);
      setIsPaused(true);
      toast.info('Assessment paused. Your progress has been saved.');
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    const attempt = getAttemptForAssessment(assessment.id);
    if (!attempt) return;
    if (isResuming) return;
    setIsResuming(true);
    try {
      // If the timer ran out earlier, top up to a minimal amount so the user can
      // finish reviewing / submitting — don't auto-submit on their behalf.
      if (timerRef.current <= 0) {
        timerRef.current = 60;
        setTimerSeconds(60);
      }
      await resumeAttempt(attempt.id);
      setIsPaused(false);
      setQuestionStartTime(Date.now());
    } finally {
      setIsResuming(false);
    }
  };

  const handleExit = async () => {
    if (isExiting) return;
    setIsExiting(true);
    try {
      await onCancel();
    } finally {
      setIsExiting(false);
    }
  };

  const doSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    recordTimeSpent();
    const attempt = getAttemptForAssessment(assessment.id);
    if (!attempt) { setIsSubmitting(false); isSubmittingRef.current = false; return; }

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

    const updatedAttempt = useAttemptStore.getState().getAttemptForAssessment(assessment.id);
    if (updatedAttempt && updatedAttempt.skill_scores.length > 0) {
      const selfRatings = await getLatestSelfRatings(employeeId, assessment.domain_id);

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
    setReviewOpen(false);
    setIsSubmitting(false);
    isSubmittingRef.current = false;
    await fetchAssessments({ force: true });
    if (evalFailed) {
      toast.error(`Submitted, but evaluation failed: ${evalErrorMsg}. You can retry from the assessment list.`);
    } else {
      toast.success('Assessment submitted! AI evaluation complete.');
    }
    onComplete();
  };

  const openReview = async () => {
    if (isOpeningReview) return;
    setIsOpeningReview(true);
    try {
      await saveCurrentAnswer();
      setReviewOpen(true);
    } finally {
      setIsOpeningReview(false);
    }
  };

  const handleSubmitFromReview = () => {
    if (answeredCount < currentQuestions.length) { setConfirmSubmitOpen(true); return; }
    doSubmit();
  };

  const handleTimeUp = useCallback(() => {
    // Only submit if the user is actively taking the assessment.
    if (isPausedRef.current) return;
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

  const navItems = currentQuestions.map((aq, i) => {
    const hasAnswer = !!answers[aq.question_id]?.trim();
    const isReview = markedForReview.has(aq.question_id);
    return { aq, i, hasAnswer, isReview };
  });

  const filteredNavItems = navItems.filter((it) => {
    if (navFilter === 'answered') return it.hasAnswer;
    if (navFilter === 'unanswered') return !it.hasAnswer;
    if (navFilter === 'flagged') return it.isReview;
    return true;
  });

  // ── Review Panel ──
  if (reviewOpen) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-card-foreground">Review your answers</h3>
              <p className="text-xs text-muted-foreground">
                {answeredCount} of {currentQuestions.length} answered · {markedForReview.size} flagged for review
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setReviewOpen(false)} className="gap-1.5">
              <ArrowLeft size={14} /> Back to questions
            </Button>
            <Button size="sm" onClick={handleSubmitFromReview} disabled={isSubmitting} className="gap-1.5">
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit assessment
            </Button>
          </div>
        </div>

        <div className="flex-1 rounded-xl border border-border bg-card overflow-y-auto">
          <ul className="divide-y divide-border">
            {currentQuestions.map((aq, i) => {
              const q = questionMap.get(aq.question_id);
              const answered = !!answers[aq.question_id]?.trim();
              const flagged = markedForReview.has(aq.question_id);
              const rawAns = answers[aq.question_id] ?? '';
              const skillName = skillMap.get(aq.skill_id)?.skill_name ?? 'Skill';
              const levelLabel = dynamicLabels[aq.target_level] || aq.target_level;
              let body: string = '';
              if (q?.question_type === 'mcq') {
                const opts = parseMCQOptions(q.question_text);
                body = opts.body;
              } else if (q?.question_type === 'coding') {
                const c = parseCodingQuestion(q.question_text);
                body = c?.problemStatement ?? q.question_text;
              } else if (q) {
                body = parseScenarioQuestion(q.question_text);
              }
              const topicName = q?.topic_id ? topicMap[q.topic_id] : undefined;
              return (
                <li key={aq.question_id} className="p-5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${answered ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{skillName}</Badge>
                        {topicName && <Badge variant="outline" className="text-xs">{topicName}</Badge>}
                        <Badge variant="outline" className="text-xs">{levelLabel}</Badge>
                        {q && <Badge variant="outline" className="text-xs">{questionTypeLabels[q.question_type]}</Badge>}
                        {flagged && <Badge className="text-xs bg-warning/15 text-warning border-warning/30 hover:bg-warning/15"><Flag size={10} className="mr-1" /> Flagged</Badge>}
                        {!answered && <Badge variant="outline" className="text-xs text-destructive border-destructive/40">Not answered</Badge>}
                      </div>
                      <p className="text-sm text-foreground line-clamp-2 whitespace-pre-wrap">{body}</p>
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Your answer</p>
                        {answered ? (
                          <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3">{rawAns}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No answer provided</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setCurrentIdx(i); setReviewOpen(false); setQuestionStartTime(Date.now()); }}
                      className="gap-1"
                    >
                      Jump to Q{i + 1} <ChevronRight size={14} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle size={18} className="text-warning" /> Incomplete assessment</DialogTitle>
              <DialogDescription>You have answered {answeredCount} of {currentQuestions.length} questions. Unanswered questions will receive a score of 0.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>Keep reviewing</Button>
              <Button variant="destructive" onClick={doSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null} Submit anyway
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3 mb-4">
        <div className="flex items-center gap-4">
          <ProgressRing answered={answeredCount} total={currentQuestions.length} />
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">
              {isPaused ? 'Assessment paused' : 'Assessment in progress'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Question {currentIdx + 1} of {currentQuestions.length} · {answeredCount} answered · {markedForReview.size} flagged
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Timer
            totalSeconds={timerSeconds}
            isPaused={isPaused}
            onTimeUp={handleTimeUp}
            onTick={(s) => { timerRef.current = s; }}
          />
          <Button size="sm" variant="ghost" onClick={isPaused ? handleResume : handlePause} disabled={isPausing || isResuming || isSubmitting || isExiting} className="gap-1.5">
            {isPausing || isResuming ? (
              <><Loader2 size={14} className="animate-spin" /> {isPaused ? 'Resuming…' : 'Pausing…'}</>
            ) : isPaused ? (
              <><Play size={14} /> Resume</>
            ) : (
              <><Pause size={14} /> Pause</>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExit} disabled={isExiting || isSubmitting} className="gap-1.5">
            {isExiting ? <><Loader2 size={14} className="animate-spin" /> Exiting…</> : 'Exit'}
          </Button>
          {(() => {
            const atEnd = currentIdx === currentQuestions.length - 1 || answeredCount >= currentQuestions.length;
            return (
              <Button
                size="sm"
                variant={atEnd ? 'default' : 'outline'}
                onClick={openReview}
                disabled={isPaused || isSubmitting || isOpeningReview || isNavigating}
                className="gap-1.5"
              >
                {isOpeningReview ? <Loader2 size={14} className="animate-spin" /> : <ListChecks size={14} />}
                {atEnd ? 'Review & submit' : 'Review answers'}
              </Button>
            );
          })()}

        </div>
      </div>

      {isPaused && (
        <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-border bg-card/50">
          <div className="text-center space-y-4 max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Pause size={28} className="text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Assessment paused</h2>
              <p className="text-sm text-muted-foreground mt-1">Your progress is saved. Click Resume to continue where you left off.</p>
            </div>
            <Button onClick={handleResume} disabled={isResuming} className="gap-1.5">
              {isResuming ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} {isResuming ? 'Resuming…' : 'Resume assessment'}
            </Button>
          </div>
        </div>
      )}

      {!isPaused && (
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Left sidebar — question navigator */}
          <div className="w-56 shrink-0 rounded-xl border border-border bg-card p-3 overflow-y-auto flex flex-col">
            <div className="flex items-center gap-1 mb-3 rounded-lg bg-muted p-0.5">
              {([
                { k: 'all', label: 'All' },
                { k: 'unanswered', label: 'To do' },
                { k: 'flagged', label: 'Flagged' },
              ] as { k: NavFilter; label: string }[]).map((f) => (
                <button
                  key={f.k}
                  onClick={() => setNavFilter(f.k)}
                  className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${navFilter === f.k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {filteredNavItems.map(({ aq, i, hasAnswer, isReview }) => {
                const isCurrent = i === currentIdx;
                let btnClass = 'bg-muted text-muted-foreground hover:bg-accent/20';
                if (isCurrent) btnClass = 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30';
                else if (isReview) btnClass = 'bg-warning/15 text-warning border border-warning/30';
                else if (hasAnswer) btnClass = 'bg-success/15 text-success border border-success/30';

                return (
                  <button
                    key={aq.question_id}
                    onClick={() => goTo(i)}
                    disabled={isNavigating}
                    className={`flex h-8 items-center justify-center rounded-md text-xs font-semibold transition-all ${btnClass} ${isNavigating ? 'opacity-60 cursor-wait' : ''}`}
                    title={`Q${i + 1}${hasAnswer ? ' • answered' : ''}${isReview ? ' • flagged' : ''}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
              {filteredNavItems.length === 0 && (
                <p className="col-span-5 text-center text-xs text-muted-foreground py-4">No questions match this filter.</p>
              )}
            </div>

            <div className="mt-auto pt-3 border-t border-border space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-success/40 border border-success/40" /> Answered
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-warning/40 border border-warning/40" /> Flagged
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-muted border border-border" /> Not answered
              </div>
            </div>
          </div>

          {/* Main panel */}
          <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            {currentQuestion ? (
              <>
                <div className="border-b border-border px-6 py-4 bg-muted/30">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground">Question {currentIdx + 1} / {currentQuestions.length}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <Badge variant="secondary" className="text-xs">{skillMap.get(currentAQ.skill_id)?.skill_name ?? 'Skill'}</Badge>
                    {currentQuestion.topic_id && topicMap[currentQuestion.topic_id] && (
                      <Badge variant="outline" className="text-xs">{topicMap[currentQuestion.topic_id]}</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{dynamicLabels[currentAQ.target_level] || currentAQ.target_level}</Badge>
                    <Badge variant="outline" className="text-xs">{questionTypeLabels[currentQuestion.question_type]}</Badge>
                    <div className="ml-auto flex items-center gap-1.5">
                      {answers[currentAQ.question_id]?.trim() ? (
                        <span className="text-xs text-success flex items-center gap-1"><CheckCircle size={12} /> Answered</span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Circle size={12} /> Not answered</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="max-w-3xl mx-auto space-y-6">
                    {currentQuestion.question_type === 'mcq' && mcqData ? (
                      <>
                        <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">{mcqData.body}</p>
                        <RadioGroup
                          value={answers[currentAQ.question_id] ?? ''}
                          onValueChange={(val) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: val }))}
                          className="space-y-2.5"
                        >
                          {mcqData.optionLines.map((opt) => {
                            const selected = answers[currentAQ.question_id] === opt.key;
                            return (
                              <label
                                key={opt.key}
                                className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-all ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-muted/40'}`}
                              >
                                <RadioGroupItem value={opt.key} id={`opt-${opt.key}`} className="mt-0.5" />
                                <Label htmlFor={`opt-${opt.key}`} className="text-sm text-foreground cursor-pointer flex-1 leading-relaxed">
                                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md mr-2 text-[11px] font-bold ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{opt.key}</span>
                                  {opt.text}
                                </Label>
                              </label>
                            );
                          })}
                        </RadioGroup>
                      </>
                    ) : currentQuestion.question_type === 'coding' ? (() => {
                      const codingData = parseCodingQuestion(currentQuestion.question_text);
                      return (
                        <>
                          <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">{codingData ? codingData.problemStatement : currentQuestion.question_text}</p>
                          {codingData?.exampleInput && (
                            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-1">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Example input</p>
                              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">{codingData.exampleInput}</pre>
                            </div>
                          )}
                          <div>
                            <Label className="text-xs text-muted-foreground mb-2 block">Your code</Label>
                            <Textarea
                              value={answers[currentAQ.question_id] ?? ''}
                              onChange={(e) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: e.target.value }))}
                              placeholder="Write your code here..."
                              rows={14}
                              maxLength={5000}
                              className="font-mono text-sm bg-muted/30"
                            />
                            <p className="text-xs text-muted-foreground mt-1 text-right">{(answers[currentAQ.question_id] ?? '').length}/5000</p>
                          </div>
                        </>
                      );
                    })() : (
                      <>
                        <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">{parseScenarioQuestion(currentQuestion.question_text)}</p>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-2 block">Your answer</Label>
                          <Textarea
                            value={answers[currentAQ.question_id] ?? ''}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: e.target.value }))}
                            placeholder="Write your answer here..."
                            rows={10}
                            maxLength={5000}
                            className="text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1 text-right">{(answers[currentAQ.question_id] ?? '').length}/5000</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t border-border px-6 py-3 flex items-center justify-between bg-card">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0 || isNavigating} className="gap-1">
                      {isNavigating ? <Loader2 size={14} className="animate-spin" /> : <ChevronLeft size={14} />} Previous
                    </Button>
                    {currentIdx < currentQuestions.length - 1 && (
                      <Button variant="ghost" size="sm" onClick={() => goTo(currentIdx + 1)} disabled={isNavigating} className="gap-1 text-muted-foreground">
                        Skip {isNavigating ? <Loader2 size={14} className="animate-spin" /> : <SkipForward size={14} />}
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetAnswer}
                      disabled={!answers[currentAQ.question_id]?.trim() || isNavigating}
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
                      {markedForReview.has(currentAQ.question_id) ? 'Flagged' : 'Flag for review'}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentIdx < currentQuestions.length - 1 ? (
                      <Button size="sm" onClick={() => goTo(currentIdx + 1)} disabled={isNavigating} className="gap-1">
                        {isNavigating ? <><Loader2 size={14} className="animate-spin" /> Next</> : <>Next <ChevronRight size={14} /></>}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={openReview} disabled={isSubmitting || isOpeningReview || isNavigating} className="gap-1">
                        {isOpeningReview ? <Loader2 size={14} className="animate-spin" /> : <ListChecks size={14} />} Review & submit
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No question data available.</p>
            )}
          </div>
        </div>
      )}

      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle size={18} className="text-warning" /> Incomplete assessment</DialogTitle>
            <DialogDescription>You have answered {answeredCount} of {currentQuestions.length} questions. Unanswered questions will receive a score of 0.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>Keep reviewing</Button>
            <Button variant="destructive" onClick={doSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null} Submit anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
