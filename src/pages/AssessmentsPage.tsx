import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssessmentStore, Assessment, assessmentStatusConfig } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ClipboardCheck, Search, ArrowRight,
} from 'lucide-react';

function getEffectiveStatus(assessment: Assessment, attempt: any, review: any): string {
  if (review?.status === 'completed') return 'approved';
  if (review) return 'review_pending';
  if (attempt?.status === 'evaluated') return 'evaluated';
  if (attempt?.status === 'submitted') return 'completed';
  if (attempt?.status === 'in_progress' || assessment.status === 'in_progress') return 'in_progress';
  return assessment.status;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <ClipboardCheck size={32} className="text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground text-center max-w-md">{message}</p>
    </div>
  );
}

export default function AssessmentsPage() {
  const { assessments, fetchAssessments } = useAssessmentStore();
  const { fetchAttempts, getAttemptForAssessment } = useAttemptStore();
  const { fetchQuestions } = useQuestionStore();
  const { fetchSkills } = useSkillStore();
  const { fetchDomains, domains } = useDomainStore();
  const { fetchReviews, reviews } = useReviewStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAssessments(); fetchQuestions(); fetchSkills(); fetchDomains(); fetchAttempts(); fetchReviews();
  }, []);

  const getDomain = (id: string) => domains.find((d) => d.id === id)?.name ?? 'Unknown Domain';

  const myAssessments = useMemo(
    () => assessments.filter((a) => a.employee_id === user?.id),
    [assessments, user]
  );

  const filteredMy = useMemo(() => {
    if (!search.trim()) return myAssessments;
    const q = search.toLowerCase();
    return myAssessments.filter((a) =>
      getDomain(a.domain_id).toLowerCase().includes(q)
    );
  }, [myAssessments, search, domains]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">My Assessments</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Assessments validate your skill self-ratings through structured questions and AI evaluation.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search assessments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {filteredMy.length === 0 ? (
        <EmptyState message="No assessments yet. Submit your skill registry to generate one." />
      ) : (
        <div className="space-y-3">
          {filteredMy.map((a) => {
            const attempt = getAttemptForAssessment(a.id);
            const review = reviews.find((r) => r.assessment_id === a.id);
            const status = getEffectiveStatus(a, attempt, review);
            const config = assessmentStatusConfig[status] ?? assessmentStatusConfig.pending;

            return (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/assessments/${a.id}`)}
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-card-foreground">{getDomain(a.domain_id)}</span>
                      {a.is_reassessment && <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">Reassessment</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.is_adaptive
                        ? 'Adaptive · questions chosen as you go'
                        : a.assessment_questions.length === 0
                          ? 'Questions pending generation'
                          : `${a.assessment_questions.length} questions`}
                      {' · '}{a.duration_minutes} min · {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {attempt?.total_ai_score != null && (
                      <span className={`text-sm font-semibold ${attempt.total_ai_score >= 75 ? 'text-success' : attempt.total_ai_score >= 50 ? 'text-warning' : 'text-destructive'}`}>
                        {attempt.total_ai_score}%
                      </span>
                    )}
                    <Badge className={`text-xs border ${config.color}`}>{config.label}</Badge>
                    <ArrowRight size={14} className="text-muted-foreground" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
