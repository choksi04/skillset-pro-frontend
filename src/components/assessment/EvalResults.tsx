import { useMemo, useState, useEffect } from 'react';
import { AssessmentAttempt, AIEvaluation, scoreToLevel } from '@/stores/attemptStore';
import { useQuestionStore, questionTypeLabels, getCompetencyLabelsMap } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { Assessment } from '@/stores/assessmentStore';
import { Badge } from '@/components/ui/badge';
import { Brain, MessageSquare, ChevronRight, CheckCircle, XCircle } from 'lucide-react';

interface EvalResultsProps {
  attempt: AssessmentAttempt;
  assessment: Assessment;
}

const scoreColor = (score: number) =>
  score >= 75 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive';

const scoreBarColor = (score: number) =>
  score >= 75 ? 'bg-success' : score >= 50 ? 'bg-warning' : 'bg-destructive';

function parseMCQForDisplay(questionText: string) {
  try {
    const parsed = JSON.parse(questionText);
    if (parsed.questionText && Array.isArray(parsed.options)) {
      return {
        options: parsed.options as string[],
        correctIndex: typeof parsed.correctIndex === 'number' ? parsed.correctIndex : null,
      };
    }
  } catch { /* not JSON */ }
  return null;
}

export default function EvalResults({ attempt, assessment }: EvalResultsProps) {
  const { questions, settings, fetchSettings } = useQuestionStore();
  const { skills } = useSkillStore();
  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const dynamicLabels = useMemo(() => getCompetencyLabelsMap(settings), [settings]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Aggregate dimension averages
  const dimensionAverages = useMemo(() => {
    const dims: Record<string, { total: number; count: number }> = {};
    for (const ev of attempt.ai_evaluations) {
      for (const d of ev.dimensions) {
        if (!dims[d.dimension]) dims[d.dimension] = { total: 0, count: 0 };
        dims[d.dimension].total += d.score;
        dims[d.dimension].count += 1;
      }
    }
    return Object.entries(dims).map(([name, { total, count }]) => ({
      name,
      avg: Math.round(total / count),
    }));
  }, [attempt.ai_evaluations]);

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
      {/* Overall Score */}
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Overall AI Score</p>
        {isPendingEval ? (
          <p className="text-sm text-warning">Pending AI Evaluation</p>
        ) : (
          <>
            <p className={`text-5xl font-bold ${scoreColor(attempt.total_ai_score ?? 0)}`}>
              {attempt.total_ai_score ?? 0}
              <span className="text-lg text-muted-foreground font-normal">/100</span>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {attempt.ai_evaluations.length} questions evaluated · Confidence avg:{' '}
              {Math.round((attempt.ai_evaluations.reduce((s, e) => s + e.confidence, 0) / (attempt.ai_evaluations.length || 1)) * 100)}%
            </p>
          </>
        )}
      </div>

      {/* Skill Scores */}
      {attempt.skill_scores.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Skill Scores & Calculated Levels</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {attempt.skill_scores.map((ss) => {
              const skill = skillMap.get(ss.skill_id);
              return (
                <div key={ss.skill_id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground">{skill?.skill_name ?? 'Unknown Skill'}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${scoreColor(ss.avg_score)}`}>{ss.avg_score}%</span>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">Level {ss.calculated_level}</Badge>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${scoreBarColor(ss.avg_score)}`} style={{ width: `${ss.avg_score}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{ss.question_count} questions evaluated</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dimension Breakdown */}
      {dimensionAverages.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Evaluation Dimensions</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {dimensionAverages.map((dim) => (
              <div key={dim.name} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground">{dim.name}</span>
                  <span className={`text-sm font-semibold ${scoreColor(dim.avg)}`}>{dim.avg}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${scoreBarColor(dim.avg)}`} style={{ width: `${dim.avg}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Question Results */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Per-Question Results</h3>

        {Object.entries(evalsBySkill).map(([skillId, evals]) => {
          const skill = skillMap.get(skillId);
          const skillAvg = Math.round(evals.reduce((s, e) => s + e.score, 0) / evals.length);

          return (
            <div key={skillId} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <Brain size={14} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">{skill?.skill_name ?? 'Unknown Skill'}</span>
                  <span className="text-xs text-muted-foreground">({evals.length} questions)</span>
                </div>
                <span className={`text-sm font-semibold ${scoreColor(skillAvg)}`}>{skillAvg}/100</span>
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
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          ev.score >= 75 ? 'bg-success/15 text-success' :
                          ev.score >= 50 ? 'bg-warning/15 text-warning' :
                          'bg-destructive/15 text-destructive'
                        }`}>
                          {ev.score}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground line-clamp-2">{question?.question_text ?? 'Question unavailable'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {aq && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{competencyLabels[aq.target_level]}</Badge>}
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
                              {isMCQ && mcqInfo && answer?.answer_text ? (
                                <div className="space-y-1">
                                  <p>Selected: <span className="font-semibold">{answer.answer_text}</span></p>
                                  {mcqInfo.correctIndex != null && (
                                    <p className="flex items-center gap-1">
                                      {answer.answer_text === String.fromCharCode(65 + mcqInfo.correctIndex)
                                        ? <><CheckCircle size={12} className="text-success" /> Correct</>
                                        : <><XCircle size={12} className="text-destructive" /> Incorrect — Correct answer: <span className="font-semibold">{String.fromCharCode(65 + mcqInfo.correctIndex)}) {mcqInfo.options[mcqInfo.correctIndex]}</span></>
                                      }
                                    </p>
                                  )}
                                </div>
                              ) : (
                                answer?.answer_text || <span className="italic text-muted-foreground">No answer provided</span>
                              )}
                            </div>
                          </div>

                          {/* AI Feedback */}
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                              <MessageSquare size={10} /> AI Feedback
                            </p>
                            <p className="text-xs text-foreground bg-primary/5 border border-primary/10 rounded-lg p-3">{ev.feedback}</p>
                          </div>

                          {/* Dimension scores */}
                          {ev.dimensions.length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Dimension Scores</p>
                              <div className="grid grid-cols-2 gap-2">
                                {ev.dimensions.map((dim) => (
                                  <div key={dim.dimension} className="rounded-md border border-border p-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-medium text-foreground">{dim.dimension}</span>
                                      <span className={`text-xs font-semibold ${scoreColor(dim.score)}`}>{dim.score}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1">
                                      <div className={`h-full rounded-full ${scoreBarColor(dim.score)}`} style={{ width: `${dim.score}%` }} />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">{dim.comment}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                            <span>Confidence: {Math.round(ev.confidence * 100)}%</span>
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
