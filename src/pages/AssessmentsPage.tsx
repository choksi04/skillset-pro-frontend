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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EvalResults from '@/components/assessment/EvalResults';
import {
  ClipboardCheck, Play, Eye, ChevronDown, ChevronUp, Search,
  BarChart3, RefreshCw, ArrowRight,
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

interface AssessmentRowProps {
  assessment: Assessment;
  employeeName: string;
  domainName: string;
  cycleName: string;
  isOwner: boolean;
  showEmployee?: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}

function AssessmentRow({ assessment, employeeName, domainName, cycleName, isOwner, showEmployee, expandedId, onToggleExpand }: AssessmentRowProps) {
  const navigate = useNavigate();
  const { getAttemptForAssessment } = useAttemptStore();
  const { reviews } = useReviewStore();

  const attempt = getAttemptForAssessment(assessment.id);
  const review = reviews.find((r) => r.assessment_id === assessment.id);
  const status = getEffectiveStatus(assessment, attempt, review);
  const config = assessmentStatusConfig[status] ?? assessmentStatusConfig.pending;
  const isExpanded = expandedId === assessment.id;
  const isCompleted = ['evaluated', 'review_pending', 'approved', 'completed'].includes(status);
  const isPendingEval = attempt?.status === 'submitted' && status === 'completed';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {showEmployee && <span className="text-sm font-semibold text-card-foreground">{employeeName}</span>}
            {showEmployee && <span className="text-muted-foreground">·</span>}
            <span className="text-sm font-medium text-card-foreground">{domainName}</span>
            {assessment.is_reassessment && <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">Reassessment</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cycleName} · {assessment.assessment_questions.length} questions · {assessment.duration_minutes} min · {new Date(assessment.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {attempt?.total_ai_score != null && (
            <span className={`text-sm font-semibold ${attempt.total_ai_score >= 75 ? 'text-success' : attempt.total_ai_score >= 50 ? 'text-warning' : 'text-destructive'}`}>
              {attempt.total_ai_score}%
            </span>
          )}

          {isOwner && status === 'pending' && (
            <Button size="sm" onClick={() => navigate('/assessment-exec')} className="gap-1.5">
              <Play size={14} /> Start
            </Button>
          )}
          {isOwner && status === 'in_progress' && (
            <Button size="sm" onClick={() => navigate('/assessment-exec')} className="gap-1.5">
              <Play size={14} /> Resume
            </Button>
          )}
          {isPendingEval && isOwner && (
            <Badge variant="outline" className="text-xs text-warning border-warning/20">Pending Evaluation</Badge>
          )}
          {isCompleted && (
            <Button size="sm" variant="ghost" onClick={() => onToggleExpand(assessment.id)} className="gap-1.5">
              <Eye size={14} /> {isExpanded ? 'Hide' : 'Details'}
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          )}
          {!isOwner && (status === 'evaluated' || status === 'review_pending') && (
            <Button size="sm" variant="outline" onClick={() => navigate('/manager-reviews')} className="gap-1.5">
              <ArrowRight size={14} /> Review
            </Button>
          )}
          <Badge className={`text-xs border ${config.color}`}>{config.label}</Badge>
        </div>
      </div>

      {isExpanded && isCompleted && attempt && (
        <div className="border-t border-border px-5 py-5">
          <EvalResults attempt={attempt} assessment={assessment} />
        </div>
      )}
    </div>
  );
}

export default function AssessmentsPage() {
  const { assessments, fetchAssessments } = useAssessmentStore();
  const { fetchAttempts } = useAttemptStore();
  const { fetchQuestions } = useQuestionStore();
  const { fetchSkills } = useSkillStore();
  const { fetchDomains, domains } = useDomainStore();
  const { fetchReviews } = useReviewStore();
  const { cycles, fetchCycles } = useCycleStore();
  const { currentRole, user } = useAuth();
  const navigate = useNavigate();

  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAssessments(); fetchQuestions(); fetchSkills(); fetchDomains(); fetchAttempts(); fetchReviews(); fetchCycles();
  }, []);

  // Fetch names
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

  const myAssessments = useMemo(
    () => assessments.filter((a) => a.employee_id === user?.id),
    [assessments, user]
  );

  const teamAssessments = useMemo(() => {
    if (currentRole === 'admin') return assessments.filter((a) => a.employee_id !== user?.id);
    if (currentRole === 'manager') {
      const domainId = user?.domain_id;
      if (!domainId) return [];
      return assessments.filter((a) => a.employee_id !== user?.id && a.domain_id === domainId);
    }
    return [];
  }, [assessments, currentRole, user]);

  const filteredMy = useMemo(() => {
    if (!search.trim()) return myAssessments;
    const q = search.toLowerCase();
    return myAssessments.filter((a) =>
      getDomain(a.domain_id).toLowerCase().includes(q) ||
      getCycle(a).toLowerCase().includes(q)
    );
  }, [myAssessments, search, domains, cycles]);

  const filteredTeam = useMemo(() => {
    if (!search.trim()) return teamAssessments;
    const q = search.toLowerCase();
    return teamAssessments.filter((a) =>
      getName(a.employee_id).toLowerCase().includes(q) ||
      getDomain(a.domain_id).toLowerCase().includes(q)
    );
  }, [teamAssessments, search, userNames, domains]);

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));
  const showTeam = currentRole === 'admin' || currentRole === 'manager';

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Assessments validate your skill self-ratings through structured questions and AI evaluation.
      </p>

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

      {/* My Assessments */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 size={14} className="text-primary" /> My Assessments ({filteredMy.length})
        </h2>
        {filteredMy.length === 0 ? (
          <EmptyState message="No assessments yet. Submit your skill registry to generate one." />
        ) : (
          <div className="space-y-3">
            {filteredMy.map((a) => (
              <AssessmentRow
                key={a.id}
                assessment={a}
                employeeName={getName(a.employee_id)}
                domainName={getDomain(a.domain_id)}
                cycleName={getCycle(a)}
                isOwner
                expandedId={expandedId}
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>
        )}
      </div>

      {/* Team Assessments */}
      {showTeam && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ClipboardCheck size={14} className="text-primary" /> Team Assessments ({filteredTeam.length})
          </h2>
          {filteredTeam.length === 0 ? (
            <EmptyState message="No team assessments found." />
          ) : (
            <div className="space-y-3">
              {filteredTeam.map((a) => (
                <AssessmentRow
                  key={a.id}
                  assessment={a}
                  employeeName={getName(a.employee_id)}
                  domainName={getDomain(a.domain_id)}
                  cycleName={getCycle(a)}
                  isOwner={false}
                  showEmployee
                  expandedId={expandedId}
                  onToggleExpand={toggleExpand}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
