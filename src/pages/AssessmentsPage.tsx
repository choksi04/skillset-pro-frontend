import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useQuestionStore, competencyLabels, questionTypeLabels } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Brain, Target, Play, CheckCircle, BarChart3 } from 'lucide-react';

const statusStyles: Record<string, string> = {
  pending: 'bg-warning/15 text-warning border-warning/20',
  in_progress: 'bg-info/15 text-info border-info/20',
  completed: 'bg-success/15 text-success border-success/20',
  reviewed: 'bg-primary/15 text-primary border-primary/20',
};

export default function AssessmentsPage() {
  const { assessments, fetchAssessments } = useAssessmentStore();
  const { questions, fetchQuestions } = useQuestionStore();
  const { skills, fetchSkills } = useSkillStore();
  const { domains, fetchDomains } = useDomainStore();
  const { currentRole, user } = useAuth();
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAssessments(); fetchQuestions(); fetchSkills(); fetchDomains();
  }, [fetchAssessments, fetchQuestions, fetchSkills, fetchDomains]);

  // Filter by domain for managers
  const filteredAssessments = useMemo(() => {
    if (currentRole === 'admin') return assessments;
    if (currentRole === 'manager') {
      const managerDomainId = user?.domain_id;
      if (!managerDomainId) return [];
      return assessments.filter((a) => a.domain_id === managerDomainId);
    }
    return assessments.filter((a) => a.employee_id === user?.id);
  }, [assessments, currentRole, user]);

  // Fetch employee names
  useEffect(() => {
    const employeeIds = [...new Set(filteredAssessments.map((a) => a.employee_id))];
    if (employeeIds.length === 0) return;
    supabase.from('users').select('id, full_name').in('id', employeeIds).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((u: any) => { map[u.id] = u.full_name; });
        setUserNames(map);
      }
    });
  }, [filteredAssessments]);

  const questionMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  if (filteredAssessments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ClipboardCheck size={32} className="text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold text-foreground mb-1">No Assessments Yet</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Assessments are automatically generated when employees submit their skill registry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Assessments are auto-generated from employee skill submissions. Questions are selected based on claimed proficiency levels.
      </p>
      <div className="space-y-4">
        {filteredAssessments.map((assessment) => {
          const domain = domains.find((d) => d.id === assessment.domain_id);
          const groupedBySkill = assessment.assessment_questions.reduce<Record<string, typeof assessment.assessment_questions>>((acc, aq) => {
            (acc[aq.skill_id] ??= []).push(aq);
            return acc;
          }, {});

          return (
            <div key={assessment.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardCheck size={16} className="text-primary" />
                    <h3 className="text-sm font-semibold text-card-foreground">Assessment — {domain?.name ?? 'Unknown Domain'}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Employee: {userNames[assessment.employee_id] || assessment.employee_id} · {assessment.assessment_questions.length} questions · {assessment.duration_minutes} min
                  </p>
                </div>
                <Badge className={`text-xs border ${statusStyles[assessment.status]}`}>{assessment.status}</Badge>
              </div>

              <div className="px-5 py-4 space-y-4">
                {Object.entries(groupedBySkill).map(([skillId, aqs]) => {
                  const skill = skillMap.get(skillId);
                  return (
                    <div key={skillId}>
                      <div className="flex items-center gap-2 mb-2">
                        <Brain size={14} className="text-primary" />
                        <span className="text-sm font-medium text-foreground">{skill?.skill_name ?? 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">({aqs.length} questions)</span>
                      </div>
                      <div className="space-y-1.5 ml-5">
                        {aqs.map((aq) => {
                          const q = questionMap.get(aq.question_id);
                          return (
                            <div key={aq.question_id} className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                              <Target size={12} className="text-muted-foreground mt-1 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-foreground line-clamp-2">{q?.question_text ?? 'Question not found'}</p>
                                <div className="flex gap-1.5 mt-1">
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{competencyLabels[aq.target_level]}</Badge>
                                  {q && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{questionTypeLabels[q.question_type]}</Badge>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {assessment.assessment_questions.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No published questions matched the employee's claimed skill levels.</p>
                )}
              </div>

              <div className="border-t border-border px-5 py-3 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">Created: {new Date(assessment.created_at).toLocaleString()}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
