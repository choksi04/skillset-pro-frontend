import { useMemo } from 'react';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle } from 'lucide-react';

const setupSteps = [
  { label: 'Create Skills', key: 'skills' },
  { label: 'Create Domains', key: 'domains' },
  { label: 'Map Skills to Domains', key: 'mappings' },
  { label: 'Add Questions', key: 'questions' },
  { label: 'Start Cycle', key: 'cycle' },
] as const;

export default function SetupProgress() {
  const { skills } = useSkillStore();
  const { domains, mappings } = useDomainStore();
  const { questions } = useQuestionStore();
  const { assessments } = useAssessmentStore();

  const completion = useMemo(() => ({
    skills: skills.length > 0,
    domains: domains.length > 0,
    mappings: mappings.length > 0,
    questions: questions.length > 0,
    cycle: assessments.length > 0,
  }), [skills, domains, mappings, questions, assessments]);

  const done = Object.values(completion).filter(Boolean).length;
  const total = setupSteps.length;

  if (done === total) return null;

  return (
    <div className="px-3 py-2">
      <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Setup Progress
          </span>
          <span className="text-[10px] font-semibold text-primary">
            {done}/{total}
          </span>
        </div>
        <Progress value={(done / total) * 100} className="h-1.5" />
        <div className="space-y-1 pt-1">
          {setupSteps.map((step) => {
            const isDone = completion[step.key];
            return (
              <div
                key={step.key}
                className={`flex items-center gap-2 text-[11px] ${
                  isDone ? 'text-muted-foreground line-through' : 'text-foreground'
                }`}
              >
                {isDone ? (
                  <CheckCircle size={12} className="text-primary shrink-0" />
                ) : (
                  <Circle size={12} className="text-muted-foreground shrink-0" />
                )}
                {step.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
