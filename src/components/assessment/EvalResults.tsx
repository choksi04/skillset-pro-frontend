import { useMemo, useState } from 'react';
import { AssessmentAttempt, AIEvaluation } from '@/stores/attemptStore';
import { useQuestionStore, questionTypeLabels } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { Assessment } from '@/stores/assessmentStore';
import { Badge } from '@/components/ui/badge';
import { Brain, MessageSquare, ChevronRight, CheckCircle, XCircle } from 'lucide-react';

interface EvalResultsProps {
  attempt: AssessmentAttempt;
  assessment: Assessment;
}


function parseMCQForDisplay(questionText: string) {
  try {
    const parsed = JSON.parse(questionText);
    if (parsed.questionText && Array.isArray(parsed.options)) {
      return {
        questionText: parsed.questionText as string,
        options: parsed.options as string[],
        correctIndex: typeof parsed.correctIndex === 'number' ? parsed.correctIndex : null,
      };
    }
  } catch { /* not JSON */ }
  return null;
}

/** Extract human-readable question text from potentially JSON-encoded question_text */
function getDisplayQuestionText(questionText: string, questionType?: string): string {
  try {
    const parsed = JSON.parse(questionText);
    if (questionType === 'mcq' && parsed.questionText) return parsed.questionText;
    if (questionType === 'coding' && parsed.problemStatement) return parsed.problemStatement;
    if (parsed.questionText) return parsed.questionText;
    if (parsed.question_text) return parsed.question_text;
    if (parsed.problemStatement) return parsed.problemStatement;
  } catch { /* not JSON, use as-is */ }
  return questionText;
}

export default function EvalResults({ attempt, assessment }: EvalResultsProps) {
  const { questions } = useQuestionStore();
  const { skills } = useSkillStore();
  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group evaluations by skill
  const evalsBySkill = useMemo(() => {
    const grouped: Record<string, AIEvaluation[]> = {};
    for (const ev of attempt.ai_evaluations) {
      const aq = assessment.assessment_questions.find((q) => q.question_id === ev.question_id);
      const skillId = aq?.skill_id ?? 'unknown';
      (grouped[skillId] ??= []).push(ev);
    }
    return grouped;
  }, [attempt.ai_evaluations, assessment.assessment_questions]);

  const isPendingEval = attempt.status === 'submitted' && attempt.ai_evaluations.length === 0;

  return (
    <div className="space-y-6">
      {isPendingEval && (
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-sm text-warning">Pending Evaluation</p>
        </div>
      )}

      {/* Per-Question Results */}
      <div className="space-y-4">
        {Object.entries(evalsBySkill).map(([skillId, evals]) => {
          const skill = skillMap.get(skillId);
          const correctCount = evals.filter((e) => e.score >= 50).length;

          return (
            <div key={skillId} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <Brain size={14} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">{skill?.skill_name ?? 'Unknown Skill'}</span>
                  <span className="text-xs text-muted-foreground">({evals.length} questions)</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {correctCount} / {evals.length} correct
                </span>
              </div>

              <div className="divide-y divide-border">
                {evals.map((ev) => {
                  const question = questionMap.get(ev.question_id);
                  const aq = assessment.assessment_questions.find((q) => q.question_id === ev.question_id);
                  const answer = attempt.answers.find((a) => a.question_id === ev.question_id);
                  const isExpanded = expandedId === ev.question_id;
                  const isMCQ = question?.question_type === 'mcq';
                  const mcqInfo = isMCQ && question ? parseMCQForDisplay(question.question_text) : null;

                  return (
                    <div key={ev.question_id}>
                      <button
                        className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : ev.question_id)}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          ev.score >= 50 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                        }`}>
                          {ev.score >= 50 ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground line-clamp-2">{question ? getDisplayQuestionText(question.question_text, question.question_type) : 'Question unavailable'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {question && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{questionTypeLabels[question.question_type]}</Badge>}
                          </div>
                        </div>
                        <ChevronRight size={14} className={`text-muted-foreground transition-transform mt-2 ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-4 space-y-3 bg-muted/10">
                          {/* Employee's Answer */}
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Employee's Answer</p>
                            <div className={`rounded-lg border border-border bg-card p-3 text-xs text-foreground whitespace-pre-wrap ${question?.question_type === 'coding' ? 'font-mono' : ''}`}>
                              {isMCQ && mcqInfo ? (() => {
                                const selectedLetter = (answer?.answer_text || '').trim().toUpperCase();
                                const selectedIdx = /^[A-D]$/.test(selectedLetter) ? selectedLetter.charCodeAt(0) - 65 : -1;
                                const selectedText = selectedIdx >= 0 && selectedIdx < mcqInfo.options.length ? mcqInfo.options[selectedIdx] : null;
                                const correctIdx = mcqInfo.correctIndex;
                                const correctLetter = correctIdx != null ? String.fromCharCode(65 + correctIdx) : null;
                                const correctText = correctIdx != null ? mcqInfo.options[correctIdx] : null;
                                const isCorrect = selectedIdx >= 0 && correctIdx != null && selectedIdx === correctIdx;
                                return (
                                  <div className="space-y-1">
                                    <p>
                                      Selected:{' '}
                                      {selectedText != null ? (
                                        <span className="font-semibold">{selectedLetter}) {selectedText}</span>
                                      ) : (
                                        <span className="italic text-muted-foreground">No answer provided</span>
                                      )}
                                    </p>
                                    {correctLetter != null && (
                                      <p className="flex items-start gap-1">
                                        {isCorrect ? (
                                          <>
                                            <CheckCircle size={12} className="text-success mt-0.5 shrink-0" />
                                            <span>Correct — <span className="font-semibold">{correctLetter}) {correctText}</span></span>
                                          </>
                                        ) : (
                                          <>
                                            <XCircle size={12} className="text-destructive mt-0.5 shrink-0" />
                                            <span>Incorrect — Correct answer: <span className="font-semibold">{correctLetter}) {correctText}</span></span>
                                          </>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                );
                              })() : (
                                answer?.answer_text || <span className="italic text-muted-foreground">No answer provided</span>
                              )}
                            </div>
                          </div>

                          {/* Feedback */}
                          {ev.feedback && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                                <MessageSquare size={10} /> Feedback
                              </p>
                              <p className="text-xs text-foreground bg-primary/5 border border-primary/10 rounded-lg p-3">{ev.feedback}</p>
                            </div>
                          )}




                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                            {answer && <span>Time spent: {answer.time_spent_seconds}s</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
