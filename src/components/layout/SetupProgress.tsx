import { useMemo } from 'react';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useTemplateStore } from '@/stores/templateStore';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle } from 'lucide-react';

const setupSteps = [
  { label: 'Create Skills', key: 'skills' },
  { label: 'Create Domains', key: 'domains' },
  { label: 'Map Skills to Domains', key: 'mappings' },
  { label: 'Add Questions', key: 'questions' },
  { label: 'Create Template', key: 'template' },
] as const;

export default function SetupProgress() {
  // Read-only: do NOT trigger any fetches from the sidebar. This widget only
  // reflects data that other pages have already loaded, so visiting the
  // Dashboard makes zero API calls on its behalf.
  const { skills, initialized: skillsInit } = useSkillStore();
  const { domains, mappings, initialized: domainsInit } = useDomainStore();
  const { counts: questionCounts } = useQuestionStore();
  const { templates, initialized: templatesInit } = useTemplateStore();

  const allLoaded = skillsInit && domainsInit && templatesInit;

  const completion = useMemo(() => ({
    skills: skills.length > 0,
    domains: domains.length > 0,
    mappings: mappings.length > 0,
    questions: questionCounts.total > 0,
    template: templates.some((t) => t.status === 'active'),
  }), [skills, domains, mappings, questionCounts.total, templates]);

  const done = Object.values(completion).filter(Boolean).length;
  const total = setupSteps.length;

  if (!allLoaded) return null;
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
