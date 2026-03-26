import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssessmentStore, Assessment, assessmentStatusConfig } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useCycleStore } from '@/stores/cycleStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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

export default function TeamAssessmentsPage() {
  const { assessments, fetchAssessments } = useAssessmentStore();
  const { fetchAttempts, getAttemptForAssessment } = useAttemptStore();
  const { fetchQuestions } = useQuestionStore();
  const { fetchSkills } = useSkillStore();
  const { fetchDomains, domains } = useDomainStore();
  const { fetchReviews, reviews } = useReviewStore();
  const { cycles, fetchCycles } = useCycleStore();
  const { currentRole, user } = useAuth();
  const navigate = useNavigate();

  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAssessments(); fetchQuestions(); fetchSkills(); fetchDomains(); fetchAttempts(); fetchReviews(); fetchCycles();
  }, []);

  useEffect(() => {
    const ids = [...new Set(assessments.map((a) => a.employee_id))];
    if (ids.length === 0) return;
    supabase.from('users').select('id, full_name').in('id', ids).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((u: any) => { map[u.id] = u.full_name; });
        setUserNames(map);
      }
    });
  }, [assessments]);

  const getName = (id: string) => userNames[id] || id;
  const getDomain = (id: string) => domains.find((d) => d.id === id)?.name ?? 'Unknown Domain';
  const getCycle = (a: Assessment) => {
    if (a.cycle_id) {
      const cycle = cycles.find((c) => c.id === a.cycle_id);
      if (cycle) return cycle.name;
    }
    return '';
  };

  const teamAssessments = useMemo(() => {
    if (currentRole === 'admin') return assessments.filter((a) => a.employee_id !== user?.id);
    if (currentRole === 'manager') {
      const domainId = user?.domain_id;
      if (!domainId) return [];
      return assessments.filter((a) => a.employee_id !== user?.id && a.domain_id === domainId);
    }
    return [];
  }, [assessments, currentRole, user]);

  const filteredTeam = useMemo(() => {
    if (!search.trim()) return teamAssessments;
    const q = search.toLowerCase();
    return teamAssessments.filter((a) =>
      getName(a.employee_id).toLowerCase().includes(q) ||
      getDomain(a.domain_id).toLowerCase().includes(q) ||
      getCycle(a).toLowerCase().includes(q)
    );
  }, [teamAssessments, search, userNames, domains, cycles]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Team Assessments</h2>
        <p className="text-sm text-muted-foreground mt-1">
          View and manage your team's assessment progress and results.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by employee, domain..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {filteredTeam.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <ClipboardCheck size={32} className="text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground text-center max-w-md">No team assessments found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTeam.map((a) => {
            const attempt = getAttemptForAssessment(a.id);
            const review = reviews.find((r) => r.assessment_id === a.id);
            const status = getEffectiveStatus(a, attempt, review);
            const config = assessmentStatusConfig[status] ?? assessmentStatusConfig.pending;

            return (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/team-assessments/${a.id}`)}
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-card-foreground">{getName(a.employee_id)}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm font-medium text-card-foreground">{getDomain(a.domain_id)}</span>
                      {a.is_reassessment && <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">Reassessment</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getCycle(a)} · {a.assessment_questions.length} questions · {a.duration_minutes} min · {new Date(a.created_at).toLocaleDateString()}
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
