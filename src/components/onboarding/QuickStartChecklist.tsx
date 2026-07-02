import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStore, checklistItems } from '@/stores/onboardingStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useRegistryStore } from '@/stores/registryStore';
import { useReviewStore } from '@/stores/reviewStore';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, X, Sparkles } from 'lucide-react';

export default function QuickStartChecklist() {
  const { currentRole, user } = useAuth();
  const { tutorialCompleted, checklistDismissed, dismissChecklist } = useOnboardingStore();

  const { domains, mappings } = useDomainStore();
  const { skills } = useSkillStore();
  const { counts: questionCounts } = useQuestionStore();
  const { assessments } = useAssessmentStore();
  const { attempts } = useAttemptStore();
  const { submissions } = useRegistryStore();
  const { reviews, officialEntries } = useReviewStore();

  const employeeId = user?.id ?? '';

  const completionMap: Record<string, boolean> = useMemo(() => ({
    hasDomains: domains.length > 0,
    hasCustomSkills: skills.length > 0,
    hasMappings: mappings.length > 0,
    // Use aggregated count, not the full row preload.
    hasQuestions: questionCounts.total > 0,
    hasAssessments: assessments.length > 0,
    hasSubmission: submissions.some((s) => s.employee_id === employeeId && s.status !== 'draft'),
    hasAttempt: attempts.some((a) => a.employee_id === employeeId && a.status !== 'in_progress'),
    hasFeedback: attempts.some((a) => a.employee_id === employeeId && a.ai_evaluations.length > 0),
    hasReview: reviews.some((r) => r.status !== 'pending'),
    hasCompletedReview: reviews.some((r) => r.status === 'completed'),
  }), [domains, skills, mappings, questionCounts.total, assessments, submissions, attempts, reviews, employeeId]);


  const roleItems = checklistItems.filter((item) => item.roles.includes(currentRole));
  const completedCount = roleItems.filter((item) => completionMap[item.checkFn]).length;
  const allDone = completedCount === roleItems.length;

  // Don't show if: not completed tutorial yet (still in tour), or dismissed, or all done
  if (!tutorialCompleted || checklistDismissed) return null;
  if (allDone) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <h3 className="text-xs font-semibold text-card-foreground">Quick Start</h3>
          <span className="text-[10px] text-muted-foreground">
            {completedCount}/{roleItems.length}
          </span>
        </div>
        <button onClick={dismissChecklist} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={12} />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${(completedCount / roleItems.length) * 100}%` }}
        />
      </div>
      <div className="p-3 space-y-1">
        {roleItems.map((item) => {
          const done = completionMap[item.checkFn];
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                done ? 'text-muted-foreground line-through' : 'text-foreground'
              }`}
            >
              {done ? (
                <CheckCircle size={14} className="text-success shrink-0" />
              ) : (
                <Circle size={14} className="text-muted-foreground shrink-0" />
              )}
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
