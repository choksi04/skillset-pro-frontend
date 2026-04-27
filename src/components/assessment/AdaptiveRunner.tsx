import { useEffect, useMemo, useRef, useState } from 'react';
import { Assessment } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useAdaptiveEngineStore, gradeMCQ } from '@/stores/adaptiveEngineStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useRegistryStore } from '@/stores/registryStore';
import { useSkillStore } from '@/stores/skillStore';
import { useCompetencyLevelStore, getLevelLabelByNumber } from '@/stores/competencyLevelStore';
import { Question } from '@/stores/questionStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChevronRight, Loader2, Sparkles, CheckCircle, Brain } from 'lucide-react';
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
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentSkillId, setCurrentSkillId] = useState<string>('');
  const [currentLevel, setCurrentLevel] = useState<number>(3);
  const [progress, setProgress] = useState({ asked: 0, total: 0 });
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const initRef = useRef(false);

  const skillNameMap = useMemo(() => new Map(skills.map((s) => [s.id, s.skill_name])), [skills]);

  useEffect(() => {
    fetchSkills();
    fetchLevels();
  }, []);

  // Initialize the engine + fetch the first question
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      const { state, reason } = await initAdaptiveAttempt(assessment.id);
      if (!state) {
        toast.error(reason ?? 'Failed to initialize adaptive assessment');
        setLoading(false);
        return;
      }
      const total = state.skills.reduce((acc, s) => acc + state.questionsPerSkill, 0);
      setProgress({ asked: 0, total });
      await loadNext();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNext() {
    const { question, skillState } = await getNextQuestion(attemptId, assessment.id);
    if (!question || !skillState) {
      await finalize();
      return;
    }
    setCurrentQuestion(question);
    setCurrentSkillId(skillState.skill_id);
    setCurrentLevel(skillState.currentLevel);
    setSelectedOption('');
    startedAtRef.current = Date.now();
  }

  async function finalize() {
    setLoading(true);
    const skillScores = await finalizeAdaptiveAttempt(attemptId, assessment.id);

    // Auto-create manager review (mirror of the legacy flow in AssessmentExecPage)
    try {
      const { submissions } = useRegistryStore.getState();
      const submission = submissions.find((s) => s.employee_id === employeeId);
      const selfRatings =
        submission?.ratings?.map((r) => ({ skill_id: r.skill_id, rating: r.rating })) ?? [];

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
    setLoading(false);
    toast.success('Adaptive assessment complete!');
    onComplete();
  }

  async function handleSubmitAnswer() {
    if (!currentQuestion || !selectedOption) return;
    setSubmitting(true);
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

    setProgress((p) => ({ ...p, asked: p.asked + 1 }));

    // Refresh local attempt cache so AnswerEntry reflects the saved state
    await useAttemptStore.getState().fetchAttempts();

    await loadNext();
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin mr-2" />
        Preparing your adaptive assessment…
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

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        No more questions — wrapping up…
      </div>
    );
  }

  const mcq = parseMCQOptions(currentQuestion.question_text);
  const skillName = skillNameMap.get(currentSkillId) ?? 'Skill';
  const levelLabel = getLevelLabelByNumber(levels, currentLevel);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <Brain size={14} className="text-primary" /> Adaptive Assessment
          </h3>
          <p className="text-xs text-muted-foreground">
            Question {progress.asked + 1} of up to {progress.total} · the next question adapts to your answers
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Sparkles size={12} className="text-primary" /> Adaptive Engine
        </Badge>
      </div>

      <div className="flex-1 rounded-xl border border-border bg-card p-6 overflow-y-auto">
        <div className="max-w-2xl space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{skillName}</Badge>
            <Badge variant="outline" className="text-xs">{levelLabel}</Badge>
          </div>

          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{mcq.body}</p>

          {mcq.optionLines.length > 0 ? (
            <RadioGroup value={selectedOption} onValueChange={setSelectedOption} className="space-y-2">
              {mcq.optionLines.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    selectedOption === opt.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  }`}
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

          <div className="flex items-center justify-end pt-4 border-t border-border">
            <Button
              size="sm"
              onClick={handleSubmitAnswer}
              disabled={!selectedOption || submitting}
              className="gap-1"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  Next <ChevronRight size={14} />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
