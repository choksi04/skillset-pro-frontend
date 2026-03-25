import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssessmentStore, Assessment } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useQuestionStore, competencyLabels, questionTypeLabels } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import EvalResults from '@/components/assessment/EvalResults';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useReviewStore } from '@/stores/reviewStore';
import { useRegistryStore } from '@/stores/registryStore';
import { toast } from 'sonner';
import {
  Clock, ChevronLeft, ChevronRight, Send, Play, BarChart3,
  CheckCircle, Circle, AlertTriangle, ClipboardCheck, User, Users,
} from 'lucide-react';

function Timer({ totalSeconds, onTimeUp }: { totalSeconds: number; onTimeUp: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  useEffect(() => {
    if (remaining <= 0) { onTimeUp(); return; }
    const interval = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(interval);
  }, [remaining, onTimeUp]);
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
  // Try JSON format first (AI-generated MCQs)
  try {
    const parsed = JSON.parse(text);
    if (parsed.questionText && Array.isArray(parsed.options)) {
      return {
        prefix: '',
        body: parsed.questionText,
        optionLines: parsed.options.map((opt: string, i: number) => ({
          key: String.fromCharCode(65 + i), // A, B, C, D
          text: opt,
        })),
        correctIndex: typeof parsed.correctIndex === 'number' ? parsed.correctIndex : null,
      };
    }
  } catch { /* not JSON, fall through */ }

  // Legacy plain-text format
  const lines = text.split('\n');
  const optionPattern = /^([A-D])\)\s*(.+)/;
  const optionLines: { key: string; text: string }[] = [];
  const bodyLines: string[] = [];
  for (const line of lines) {
    const match = line.match(optionPattern);
    if (match) optionLines.push({ key: match[1], text: match[2] });
    else bodyLines.push(line);
  }
  return { prefix: '', body: bodyLines.join('\n').trim(), optionLines, correctIndex: null };
}

function parseCodingQuestion(text: string) {
  try {
    const parsed = JSON.parse(text);
    if (parsed.problemStatement) {
      return { problemStatement: parsed.problemStatement, exampleInput: parsed.exampleInput || '', exampleOutput: parsed.exampleOutput || '' };
    }
  } catch { /* not JSON */ }
  return null;
}

function parseScenarioQuestion(text: string) {
  try {
    const parsed = JSON.parse(text);
    if (parsed.question_text) return parsed.question_text;
    if (parsed.questionText) return parsed.questionText;
  } catch { /* not JSON */ }
  return text;
}

// My Assessments (take assessment view)
function MyAssessmentsView() {
  const { assessments, updateAssessmentStatus, fetchAssessments } = useAssessmentStore();
  const { startAttempt, saveAnswer, submitAttempt, getAttemptForAssessment, fetchAttempts } = useAttemptStore();
  const { questions } = useQuestionStore();
  const { skills } = useSkillStore();
  const { domains } = useDomainStore();
  const { user } = useAuth();

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

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

  const recordTimeSpent = useCallback(() => {
    if (!currentAQ) return;
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setTimeSpent((prev) => ({ ...prev, [currentAQ.question_id]: (prev[currentAQ.question_id] ?? 0) + elapsed }));
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
    
    // Restore previously saved answers if resuming
    const existingAttempt = getAttemptForAssessment(assessment.id);
    const restoredAnswers: Record<string, string> = {};
    const restoredTime: Record<string, number> = {};
    if (existingAttempt?.answers?.length) {
      for (const ans of existingAttempt.answers) {
        restoredAnswers[ans.question_id] = ans.answer_text;
        restoredTime[ans.question_id] = ans.time_spent_seconds;
      }
    }
    
    setActiveAssessment(assessment);
    setCurrentIdx(0);
    setAnswers(restoredAnswers);
    setTimeSpent(restoredTime);
    setQuestionStartTime(Date.now());
  };

  const handleSubmit = () => {
    if (answeredCount < currentQuestions.length) { setConfirmSubmitOpen(true); return; }
    doSubmit();
  };

  const doSubmit = async () => {
    if (!activeAssessment) return;
    recordTimeSpent();
    const attempt = getAttemptForAssessment(activeAssessment.id);
    if (!attempt) return;

    for (const aq of currentQuestions) {
      await saveAnswer(attempt.id, { question_id: aq.question_id, answer_text: answers[aq.question_id] ?? '', time_spent_seconds: timeSpent[aq.question_id] ?? 0 });
    }

    const qMap = new Map(currentQuestions.map((aq) => {
      const q = questionMap.get(aq.question_id);
      return [aq.question_id, q!] as const;
    }).filter(([, q]) => q != null));
    await submitAttempt(attempt.id, qMap as Map<string, any>, activeAssessment.assessment_questions);
    await updateAssessmentStatus(activeAssessment.id, 'completed');

    // Auto-create manager review — find domain lead as reviewer
    const updatedAttempt = useAttemptStore.getState().getAttemptForAssessment(activeAssessment.id);
    if (updatedAttempt && updatedAttempt.skill_scores.length > 0) {
      const { submissions } = useRegistryStore.getState();
      const submission = submissions.find((s) => s.employee_id === employeeId);
      const selfRatings = submission?.ratings?.map((r) => ({ skill_id: r.skill_id, rating: r.rating })) ?? [];

      // Find the domain lead for this assessment's domain
      let reviewerId = '';
      const { data: domainRow } = await supabase.from('domains').select('domain_lead_id').eq('id', activeAssessment.domain_id).single();
      if (domainRow?.domain_lead_id) {
        reviewerId = domainRow.domain_lead_id;
      } else {
        // Fallback: find any admin
        const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin').eq('status', 'active').limit(1);
        reviewerId = admins?.[0]?.id ?? '';
      }

      if (reviewerId) {
        await useReviewStore.getState().createReview({
          tenant_id: tenantId,
          assessment_id: activeAssessment.id,
          attempt_id: updatedAttempt.id,
          employee_id: employeeId,
          employee_name: user?.full_name ?? 'Employee',
          domain_id: activeAssessment.domain_id,
          reviewer_id: reviewerId,
          skill_scores: updatedAttempt.skill_scores,
          self_ratings: selfRatings,
        });
      }
    }

    setConfirmSubmitOpen(false);
    setActiveAssessment(null);
    toast.success('Assessment submitted! AI evaluation complete. Manager review created.');
  };

  const handleTimeUp = useCallback(() => {
    toast.warning('Time is up! Auto-submitting your assessment.');
    doSubmit();
  }, [activeAssessment, answers, currentQuestions, timeSpent]);

  if (!activeAssessment) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Complete your assigned skill assessments. Each assessment is timed.</p>
        {myAssessments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ClipboardCheck size={32} className="text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-1">No Assessments Assigned</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md">Submit your skill self-assessment in the Skill Registry to generate an assessment.</p>
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
                      <h3 className="text-sm font-semibold text-card-foreground">{domain?.name ?? 'Assessment'} — Skill Validation</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {assessment.assessment_questions.length} questions · {assessment.duration_minutes} min · {assessment.skill_ids.map((id) => skillMap.get(id)?.skill_name).filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setViewResultsId(viewResultsId === assessment.id ? null : assessment.id)} className="gap-1.5">
                            <BarChart3 size={14} /> {viewResultsId === assessment.id ? 'Hide Results' : 'View Results'}
                          </Button>
                          <Badge className="bg-success/15 text-success border-success/20 gap-1 text-xs"><CheckCircle size={12} /> Completed</Badge>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => handleStartAssessment(assessment)} className="gap-1.5"><Play size={14} /> Start Assessment</Button>
                      )}
                    </div>
                  </div>
                  {attempt?.total_ai_score != null && viewResultsId !== assessment.id && (
                    <div className="mt-3 rounded-lg bg-muted/30 px-3 py-2 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">AI Score:</span>
                      <span className={`text-lg font-semibold ${attempt.total_ai_score >= 75 ? 'text-success' : attempt.total_ai_score >= 50 ? 'text-warning' : 'text-destructive'}`}>{attempt.total_ai_score}%</span>
                      <Badge variant="outline" className="text-xs ml-auto">Pending Manager Review</Badge>
                    </div>
                  )}
                  {viewResultsId === assessment.id && attempt && (
                    <div className="mt-4 border-t border-border pt-4"><EvalResults attempt={attempt} assessment={assessment} /></div>
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
  const mcqData = currentQuestion?.question_type === 'mcq' ? parseMCQOptions(currentQuestion.question_text) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Assessment In Progress</h3>
          <p className="text-xs text-muted-foreground">Question {currentIdx + 1} of {currentQuestions.length} · {answeredCount} answered</p>
        </div>
        <div className="flex items-center gap-4">
          <Timer totalSeconds={activeAssessment.duration_minutes * 60} onTimeUp={handleTimeUp} />
          <Button size="sm" variant="outline" onClick={handleSubmit} className="gap-1.5"><Send size={14} /> Submit</Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        <div className="w-14 shrink-0 rounded-xl border border-border bg-card p-2 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            {currentQuestions.map((aq, i) => {
              const hasAnswer = !!answers[aq.question_id]?.trim();
              const isCurrent = i === currentIdx;
              return (
                <button key={aq.question_id} onClick={() => goTo(i)} className={`flex h-8 w-full items-center justify-center rounded-lg text-xs font-semibold transition-all ${isCurrent ? 'bg-primary text-primary-foreground shadow-sm' : hasAnswer ? 'bg-success/15 text-success border border-success/20' : 'bg-muted text-muted-foreground hover:bg-accent/10'}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 rounded-xl border border-border bg-card p-6 overflow-y-auto">
          {currentQuestion ? (
            <div className="space-y-5 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">{skillMap.get(currentAQ.skill_id)?.skill_name ?? 'Unknown'}</Badge>
                <Badge variant="outline" className="text-xs">{competencyLabels[currentAQ.target_level]}</Badge>
                <Badge variant="outline" className="text-xs">{questionTypeLabels[currentQuestion.question_type]}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">Q{currentIdx + 1}/{currentQuestions.length}</span>
              </div>

              {currentQuestion.question_type === 'mcq' && mcqData ? (
                <div className="space-y-4">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{mcqData.body}</p>
                  <RadioGroup value={answers[currentAQ.question_id] ?? ''} onValueChange={(val) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: val }))} className="space-y-2">
                    {mcqData.optionLines.map((opt) => (
                      <label key={opt.key} className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${answers[currentAQ.question_id] === opt.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                        <RadioGroupItem value={opt.key} id={`opt-${opt.key}`} />
                        <Label htmlFor={`opt-${opt.key}`} className="text-sm text-foreground cursor-pointer flex-1"><span className="font-semibold mr-1.5">{opt.key})</span> {opt.text}</Label>
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
                        {codingData.exampleOutput && <>
                          <p className="text-xs font-semibold text-muted-foreground mt-2">Expected Output</p>
                          <pre className="text-xs font-mono text-foreground">{codingData.exampleOutput}</pre>
                        </>}
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Your Code</Label>
                      <Textarea value={answers[currentAQ.question_id] ?? ''} onChange={(e) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: e.target.value }))} placeholder="Write your code here..." rows={12} maxLength={5000} className="font-mono text-sm" />
                      <p className="text-xs text-muted-foreground mt-1 text-right">{(answers[currentAQ.question_id] ?? '').length}/5000</p>
                    </div>
                  </div>
                );
              })() : (
                <div className="space-y-4">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{parseScenarioQuestion(currentQuestion.question_text)}</p>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Your Answer</Label>
                    <Textarea value={answers[currentAQ.question_id] ?? ''} onChange={(e) => setAnswers((prev) => ({ ...prev, [currentAQ.question_id]: e.target.value }))} placeholder="Write your answer here..." rows={8} maxLength={5000} className="text-sm" />
                    <p className="text-xs text-muted-foreground mt-1 text-right">{(answers[currentAQ.question_id] ?? '').length}/5000</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0} className="gap-1"><ChevronLeft size={14} /> Previous</Button>
                <div className="flex items-center gap-1.5">
                  {answers[currentAQ.question_id]?.trim() ? <CheckCircle size={14} className="text-success" /> : <Circle size={14} className="text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{answers[currentAQ.question_id]?.trim() ? 'Answered' : 'Not answered'}</span>
                </div>
                {currentIdx < currentQuestions.length - 1 ? (
                  <Button variant="outline" size="sm" onClick={() => goTo(currentIdx + 1)} className="gap-1">Next <ChevronRight size={14} /></Button>
                ) : (
                  <Button size="sm" onClick={handleSubmit} className="gap-1"><Send size={14} /> Submit Assessment</Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No question data available.</p>
          )}
        </div>
      </div>

      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle size={18} className="text-warning" /> Incomplete Assessment</DialogTitle>
            <DialogDescription>You have answered {answeredCount} of {currentQuestions.length} questions. Unanswered questions will receive a score of 0. Are you sure you want to submit?</DialogDescription>
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

// Team's Assessments view for managers/admins
function TeamAssessmentsView() {
  const { assessments } = useAssessmentStore();
  const { getAttemptForAssessment } = useAttemptStore();
  const { questions } = useQuestionStore();
  const { skills } = useSkillStore();
  const { domains } = useDomainStore();
  const { user, currentRole } = useAuth();
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const teamAssessments = useMemo(() => {
    if (currentRole === 'admin') return assessments;
    const managerDomainId = user?.domain_id;
    if (!managerDomainId) return [];
    return assessments.filter((a) => a.domain_id === managerDomainId);
  }, [assessments, currentRole, user]);

  useEffect(() => {
    const employeeIds = [...new Set(teamAssessments.map((a) => a.employee_id))];
    if (employeeIds.length === 0) return;
    supabase.from('users').select('id, full_name').in('id', employeeIds).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((u: any) => { map[u.id] = u.full_name; });
        setUserNames(map);
      }
    });
  }, [teamAssessments]);

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  const statusStyles: Record<string, string> = {
    pending: 'bg-warning/15 text-warning border-warning/20',
    in_progress: 'bg-info/15 text-info border-info/20',
    completed: 'bg-success/15 text-success border-success/20',
    reviewed: 'bg-primary/15 text-primary border-primary/20',
  };

  if (teamAssessments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ClipboardCheck size={32} className="text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold text-foreground mb-1">No Team Assessments</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">Team assessments will appear here once employees submit their skill registry.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {teamAssessments.map((assessment) => {
        const domain = domains.find((d) => d.id === assessment.domain_id);
        const attempt = getAttemptForAssessment(assessment.id);
        const isCompleted = attempt?.status === 'evaluated' || attempt?.status === 'reviewed' || assessment.status === 'completed';
        return (
          <div key={assessment.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">{userNames[assessment.employee_id] || assessment.employee_id}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {domain?.name ?? 'Unknown'} · {assessment.assessment_questions.length} questions · {assessment.duration_minutes} min
                </p>
                <p className="text-xs text-muted-foreground">
                  Skills: {assessment.skill_ids.map((id) => skillMap.get(id)?.skill_name).filter(Boolean).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs border ${statusStyles[assessment.status]}`}>{assessment.status}</Badge>
                {attempt?.total_ai_score != null && (
                  <span className={`text-sm font-semibold ${attempt.total_ai_score >= 75 ? 'text-success' : attempt.total_ai_score >= 50 ? 'text-warning' : 'text-destructive'}`}>
                    {attempt.total_ai_score}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AssessmentExecPage() {
  const { fetchAssessments } = useAssessmentStore();
  const { fetchAttempts } = useAttemptStore();
  const { fetchQuestions } = useQuestionStore();
  const { fetchSkills } = useSkillStore();
  const { fetchDomains } = useDomainStore();
  const { currentRole } = useAuth();

  useEffect(() => {
    fetchAssessments(); fetchAttempts(); fetchQuestions(); fetchSkills(); fetchDomains();
  }, [fetchAssessments, fetchAttempts, fetchQuestions, fetchSkills, fetchDomains]);

  const isEmployee = currentRole === 'employee';

  if (isEmployee) return <MyAssessmentsView />;

  return (
    <Tabs defaultValue="my" className="space-y-6">
      <TabsList>
        <TabsTrigger value="my" className="gap-1.5"><User size={14} /> My Assessments</TabsTrigger>
        <TabsTrigger value="team" className="gap-1.5"><Users size={14} /> Team's Assessments</TabsTrigger>
      </TabsList>
      <TabsContent value="my"><MyAssessmentsView /></TabsContent>
      <TabsContent value="team"><TeamAssessmentsView /></TabsContent>
    </Tabs>
  );
}
