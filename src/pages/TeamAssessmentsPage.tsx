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
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ClipboardCheck, Search, ArrowRight, UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AssignTemplateDialog from '@/components/templates/AssignTemplateDialog';

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
  const { templates, fetchTemplates } = useTemplateStore();
  const { currentRole, user } = useAuth();
  const navigate = useNavigate();

  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    fetchAssessments(); fetchQuestions(); fetchSkills(); fetchDomains(); fetchAttempts(); fetchReviews(); fetchTemplates();
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
  const getAssessmentName = (a: Assessment) => {
    if (a.template_id) {
      const t = templates.find((x) => x.id === a.template_id);
      if (t?.name) return t.name;
    }
    return 'Skill Registry Assessment';
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
      getAssessmentName(a).toLowerCase().includes(q)
    );
  }, [teamAssessments, search, userNames, templates]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Team Assessments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage your team's assessment progress and results.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setAssignOpen(true)}>
          <UserCheck size={14} /> Assign from Template
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by employee or assessment name..."
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
                      <span className="text-sm font-medium text-card-foreground">{getAssessmentName(a)}</span>
                      {a.is_reassessment && <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">Reassessment</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.assessment_questions.length} questions · {a.duration_minutes} min · {new Date(a.created_at).toLocaleDateString()}
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

      <AssignTemplateDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        template={null}
        showTemplatePicker
      />
    </div>
  );
}
