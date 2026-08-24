import { useEffect, useMemo, useRef, useState } from 'react';
import { Assessment } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useAdaptiveEngineStore, gradeMCQ, getTargetTotal } from '@/stores/adaptiveEngineStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useSkillStore } from '@/stores/skillStore';
import { useCompetencyLevelStore, getLevelLabelByNumber } from '@/stores/competencyLevelStore';
import { Question, useQuestionStore } from '@/stores/questionStore';
import { getLatestSelfRatings } from '@/lib/selfRatings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import AssessmentTimer from '@/components/assessment/AssessmentTimer';
import {
  ChevronRight, Loader2, Sparkles, CheckCircle, Brain, ListChecks,
  ArrowLeft, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  assessment: Assessment;
  attemptId: string;
  employeeId: string;
  tenantId: string;
  employeeName: string;
  onComplete: () => void;
}

interface AnsweredEntry {
  questionId: string;
  question: Question;
  skillId: string;
  level: number;
  answer: string;
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
  } catch {
    /* not JSON */
  }
  return { body: text, optionLines: [] as { key: string; text: string }[] };
}

// ── Progress ring (matches FixedRunner) ──
function ProgressRing({ answered, total }: { answered: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;
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

export default function AdaptiveRunner({
  assessment,
  attemptId,
  employeeId,
  tenantId,
  employeeName,
  onComplete,
}: Props) {
  const { initAdaptiveAttempt, getNextQuestion, recordAnswer, finalizeAdaptiveAttempt } =
    useAdaptiveEngineStore();
  const { skills, fetchSkills } = useSkillStore();
  const { levels, fetchLevels } = useCompetencyLevelStore();

  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentSkillId, setCurrentSkillId] = useState<string>('');
  const [currentLevel, setCurrentLevel] = useState<number>(3);
  const [progress, setProgress] = useState({ asked: 0, total: 0 });
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [answered, setAnswered] = useState<AnsweredEntry[]>([]);
  const [exhaustedEarly, setExhaustedEarly] = useState(false);
  const [shortfall, setShortfall] = useState<string | null>(null);
  const plannedTotalRef = useRef(0);
  const startedAtRef = useRef<number>(Date.now());
  const initRef = useRef(false);

  // ── Timer state ──
  const totalSeconds = Math.max(0, Math.round((assessment.duration_minutes ?? 0) * 60));
  const timerEnabled = totalSeconds > 0;
  const initialAttempt = useAttemptStore.getState().getAttemptForAssessment(assessment.id);
  const initialRemainingRef = useRef<number>(
    typeof initialAttempt?.remaining_seconds === 'number'
      ? Math.max(0, initialAttempt.remaining_seconds)
      : totalSeconds,
  );
  const remainingRef = useRef<number>(initialRemainingRef.current);
  const [timeUp, setTimeUp] = useState(timerEnabled && initialRemainingRef.current <= 0);
  const timeUpHandledRef = useRef(false);
  const finalizingRef = useRef(false);



  const skillNameMap = useMemo(() => new Map(skills.map((s) => [s.id, s.skill_name])), [skills]);
  const [topicMap, setTopicMap] = useState<Record<string, string>>({});

  async function ensureTopic(topicId: string | null | undefined) {
    if (!topicId || topicMap[topicId]) return;
    const { data } = await supabase.from('skill_topics').select('id, name').eq('id', topicId).maybeSingle();
    if (data) setTopicMap((prev) => ({ ...prev, [data.id]: data.name }));
  }

  useEffect(() => {
    fetchSkills();
    fetchLevels();
  }, []);

  // Persist the remaining time when the employee leaves / hides the tab / unmounts.
  useEffect(() => {
    if (!timerEnabled) return;
    const persist = () => {
      if (finalizingRef.current) return;
      const attempt = useAttemptStore.getState().getAttemptForAssessment(assessment.id);
      if (!attempt || attempt.status !== 'in_progress') return;
      useAttemptStore.getState().pauseAttempt(attempt.id, remainingRef.current).catch(() => {});
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') persist(); };
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', persist);
      document.removeEventListener('visibilitychange', onVisibility);
      persist();
    };
  }, [assessment.id, timerEnabled]);


  // Initialize the engine + rehydrate previously saved answers + fetch the first question
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      try {
        const { state, reason } = await initAdaptiveAttempt(assessment.id);
        if (!state) {
          const msg = reason ?? 'Failed to initialize adaptive assessment';
          setInitError(msg);
          toast.error(msg);
          setLoading(false);
          return;
        }
        const total = getTargetTotal(state);
        if (state.shortfallReason) setShortfall(state.shortfallReason);


        // ── Resume support: rebuild the answered list from persisted state ──
        // The adaptive state records every asked question; the answers themselves
        // live in attempt_answers. Without this, reopening a completed-but-unsubmitted
        // attempt lands on an empty review screen with Submit disabled.
        const priorHistory = state.skills.flatMap((s) =>
          (s.history ?? []).map((h) => ({ skillId: s.skill_id, questionId: h.question_id, level: h.level })),
        );

        let restored: AnsweredEntry[] = [];
        if (priorHistory.length > 0) {
          const attempts = await useAttemptStore.getState().fetchAttemptsForAssessment(assessment.id);
          const attemptRow = attempts.find((a) => a.id === attemptId) ?? attempts[0];
          const answerMap = new Map(
            (attemptRow?.answers ?? []).map((a) => [a.question_id, a.answer_text]),
          );
          const questionRows = await useQuestionStore
            .getState()
            .fetchQuestionsByIds(priorHistory.map((h) => h.questionId));
          const qMap = new Map(questionRows.map((q) => [q.id, q]));

          restored = priorHistory
            .map((h) => {
              const question = qMap.get(h.questionId);
              if (!question) return null;
              return {
                questionId: h.questionId,
                question,
                skillId: h.skillId,
                level: h.level,
                answer: answerMap.get(h.questionId) ?? '',
              } as AnsweredEntry;
            })
            .filter((e): e is AnsweredEntry => e !== null);

          for (const e of restored) ensureTopic(e.question.topic_id);
          setAnswered(restored);
        }

        plannedTotalRef.current = total;
        setProgress({ asked: restored.length, total });

        await loadNext();
      } catch (err: any) {
        const msg = err?.message || 'Unexpected error while starting the assessment';
        setInitError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function loadNext() {
    try {
      const { question, skillState } = await getNextQuestion(attemptId, assessment.id);
      if (!question || !skillState) {
        // No more questions — open review instead of auto-finalizing.
        setCurrentQuestion(null);
        // The engine can stop early when the bank runs out of eligible MCQs.
        // Cap the advertised total so the UI never promises more than delivered.
        setProgress((p) => {
          if (plannedTotalRef.current > 0 && p.asked < plannedTotalRef.current) setExhaustedEarly(true);
          return { asked: p.asked, total: p.asked };
        });

        setReviewOpen(true);
        return;
      }

      setCurrentQuestion(question);
      ensureTopic(question.topic_id);
      setCurrentSkillId(skillState.skill_id);
      setCurrentLevel(skillState.currentLevel);
      setSelectedOption('');
      startedAtRef.current = Date.now();
    } catch (err: any) {
      const msg = err?.message || 'Failed to load the next question';
      setInitError(msg);
      toast.error(msg);
    }
  }

  async function finalize() {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setFinalizing(true);
    try {
      const skillScores = await finalizeAdaptiveAttempt(attemptId, assessment.id);

      // Auto-create manager review (mirror of the legacy flow in AssessmentExecPage)
      try {
        const selfRatings = await getLatestSelfRatings(employeeId, assessment.domain_id);

        let reviewerId = '';
        const { data: domainRow } = await supabase
          .from('domains')
          .select('domain_lead_id')
          .eq('id', assessment.domain_id)
          .single();
        if (domainRow?.domain_lead_id) {
          reviewerId = domainRow.domain_lead_id;
        } else {
          const { data: admins } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'admin')
            .eq('status', 'active')
            .limit(1);
          reviewerId = admins?.[0]?.id ?? '';
        }

        if (reviewerId && skillScores.length > 0) {
          await useReviewStore.getState().createReview({
            tenant_id: tenantId,
            assessment_id: assessment.id,
            attempt_id: attemptId,
            employee_id: employeeId,
            employee_name: employeeName,
            domain_id: assessment.domain_id,
            reviewer_id: reviewerId,
            skill_scores: skillScores,
            self_ratings: selfRatings,
          });
        }
      } catch (err) {
        console.error('Failed to auto-create review:', err);
      }

      setFinished(true);
      toast.success('Adaptive assessment complete!');
      onComplete();
    } finally {
      setFinalizing(false);
    }
  }

  async function handleSubmitAnswer() {
    if (!currentQuestion || !selectedOption || submitting) return;
    setSubmitting(true);
    try {
      const isCorrect = gradeMCQ(currentQuestion, selectedOption);
      const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);

      await recordAnswer(
        attemptId,
        assessment.id,
        currentQuestion.id,
        currentSkillId,
        isCorrect,
        selectedOption,
        elapsed,
      );

      setAnswered((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          question: currentQuestion,
          skillId: currentSkillId,
          level: currentLevel,
          answer: selectedOption,
        },
      ]);
      setProgress((p) => ({ ...p, asked: p.asked + 1 }));

      // Refresh local attempt cache so AnswerEntry reflects the saved state
      await useAttemptStore.getState().fetchAttemptsForAssessment(assessment.id);

      await loadNext();
    } finally {
      setSubmitting(false);
    }
  }

  // ── Time up: lock the runner and auto-submit exactly once ──
  async function handleTimeUp() {
    if (timeUpHandledRef.current) return;
    timeUpHandledRef.current = true;
    remainingRef.current = 0;
    setTimeUp(true);
    setReviewOpen(true);
    toast.warning('Time is up. Your assessment will be submitted automatically.');

    // Best-effort: persist the answer in progress before finalizing.
    if (currentQuestion && selectedOption) {
      try {
        await recordAnswer(
          attemptId,
          assessment.id,
          currentQuestion.id,
          currentSkillId,
          gradeMCQ(currentQuestion, selectedOption),
          selectedOption,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
      } catch { /* best-effort */ }
    }
    await finalize();
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin mr-2" />
        Preparing your adaptive assessment…
      </div>
    );
  }

  if (initError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 max-w-2xl">
        <h3 className="text-sm font-semibold text-destructive mb-1">Cannot start this adaptive assessment</h3>
        <p className="text-sm text-foreground/80 mb-3">{initError}</p>
        <ul className="text-xs text-muted-foreground list-disc ml-5 space-y-1">
          <li>Confirm the template has skills selected (Pick Skills mode) or the employee's domain has mapped skills.</li>
          <li>Ensure at least one <strong>published MCQ</strong> exists for each selected skill.</li>
          <li>Verify competency levels (L1–L5) are active in Settings.</li>
        </ul>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <CheckCircle size={42} className="text-success" />
        <h2 className="text-lg font-semibold text-foreground">Assessment Complete</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          We've recorded your answers and computed your skill levels. Your manager will review the results.
        </p>
      </div>
    );
  }

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
                {answered.length} question{answered.length === 1 ? '' : 's'} answered · adaptive engine complete
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentQuestion && !timeUp && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewOpen(false)}
                disabled={finalizing}
                className="gap-1.5"
              >
                <ArrowLeft size={14} /> Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={finalize}
              disabled={finalizing || answered.length === 0}
              className="gap-1.5"
            >
              {finalizing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {finalizing ? 'Submitting…' : 'Submit assessment'}
            </Button>
          </div>
        </div>

        {timeUp && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-3">
            <p className="text-sm text-foreground">
              Time is up. Your assessment will be submitted automatically.
            </p>
          </div>
        )}

        {!timeUp && (exhaustedEarly || shortfall) && (
          <div className="mb-4 rounded-xl border border-warning/30 bg-warning/5 px-5 py-3">
            <p className="text-sm text-foreground">
              This is the end of your assessment. It finished after {answered.length} question
              {answered.length === 1 ? '' : 's'}.
              {shortfall ? ` ${shortfall}` : ' The adaptive engine ran out of eligible questions for the selected skills.'}
            </p>
          </div>
        )}





        <div className="flex-1 rounded-xl border border-border bg-card overflow-y-auto">
          {answered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-12">
              No answers recorded yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {answered.map((entry, i) => {
                const mcq = parseMCQOptions(entry.question.question_text);
                const skillName = skillNameMap.get(entry.skillId) ?? 'Skill';
                const levelLabel = getLevelLabelByNumber(levels, entry.level);
                const chosen = mcq.optionLines.find((o) => o.key === entry.answer);
                return (
                  <li key={`${entry.questionId}-${i}`} className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success text-xs font-semibold">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{skillName}</Badge>
                          {entry.question.topic_id && topicMap[entry.question.topic_id] && (
                            <Badge variant="outline" className="text-xs">{topicMap[entry.question.topic_id]}</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{levelLabel}</Badge>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-2">{mcq.body}</p>
                        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Your answer</p>
                          {chosen ? (
                            <p className="text-sm text-foreground">
                              <span className="font-semibold mr-1.5">{chosen.key})</span>
                              {chosen.text}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No answer recorded</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin mr-2" />
        Wrapping up…
      </div>
    );
  }

  const mcq = parseMCQOptions(currentQuestion.question_text);
  const skillName = skillNameMap.get(currentSkillId) ?? 'Skill';
  const levelLabel = getLevelLabelByNumber(levels, currentLevel);
  const totalForRing = Math.max(progress.total, progress.asked + 1);
  const currentNumber = progress.total > 0
    ? Math.min(progress.asked + 1, progress.total)
    : progress.asked + 1;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3 mb-4">
        <div className="flex items-center gap-4">
          <ProgressRing answered={progress.asked} total={totalForRing} />
          <div>
            <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <Brain size={14} className="text-primary" /> Adaptive Assessment
            </h3>
            <p className="text-xs text-muted-foreground">
              Question {currentNumber}
              {progress.total > 0 ? ` of ${progress.total}` : ''} · the next question adapts to your answers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {timerEnabled && (
            <AssessmentTimer
              initialRemaining={initialRemainingRef.current}
              totalSeconds={totalSeconds}
              isPaused={timeUp || finalizing}
              onTick={(r) => { remainingRef.current = r; }}
              onTimeUp={handleTimeUp}
            />
          )}
          <Badge variant="outline" className="gap-1.5">
            <Sparkles size={12} className="text-primary" /> Adaptive Engine
          </Badge>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-border bg-card p-6 overflow-y-auto">
        <div className="max-w-2xl space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{skillName}</Badge>
            {currentQuestion.topic_id && topicMap[currentQuestion.topic_id] && (
              <Badge variant="outline" className="text-xs">{topicMap[currentQuestion.topic_id]}</Badge>
            )}
            <Badge variant="outline" className="text-xs">{levelLabel}</Badge>
          </div>

          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{mcq.body}</p>

          {mcq.optionLines.length > 0 ? (
            <RadioGroup
              value={selectedOption}
              onValueChange={setSelectedOption}
              className="space-y-2"
              disabled={submitting}
            >
              {mcq.optionLines.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    selectedOption === opt.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  } ${submitting ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <RadioGroupItem value={opt.key} id={`adp-opt-${opt.key}`} />
                  <Label htmlFor={`adp-opt-${opt.key}`} className="text-sm text-foreground cursor-pointer flex-1">
                    <span className="font-semibold mr-1.5">{opt.key})</span>
                    {opt.text}
                  </Label>
                </label>
              ))}
            </RadioGroup>
          ) : (
            <p className="text-xs text-destructive">This question is missing answer options.</p>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {answered.length} answered so far
            </p>
            <Button
              size="sm"
              onClick={handleSubmitAnswer}
              disabled={!selectedOption || submitting}
              className="gap-1.5"
            >
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Saving…</>
              ) : (
                <>Next <ChevronRight size={14} /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
