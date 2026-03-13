import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssessmentStore, Assessment } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import EvalResults from '@/components/assessment/EvalResults';
import { ClipboardCheck, Play, Eye, ChevronDown, ChevronUp, User, Users, FileSearch } from 'lucide-react';

const statusStyles: Record<string, string> = {
  pending: 'bg-warning/15 text-warning border-warning/20',
  in_progress: 'bg-info/15 text-info border-info/20',
  completed: 'bg-success/15 text-success border-success/20',
  evaluated: 'bg-success/15 text-success border-success/20',
  reviewed: 'bg-primary/15 text-primary border-primary/20',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  evaluated: 'Completed',
  reviewed: 'Reviewed',
};

function getEffectiveStatus(assessment: Assessment, getAttemptForAssessment: (id: string) => any) {
  const attempt = getAttemptForAssessment(assessment.id);
  if (attempt?.status === 'reviewed') return 'reviewed';
  if (attempt?.status === 'evaluated' || assessment.status === 'completed') return 'completed';
  if (attempt?.status === 'in_progress' || assessment.status === 'in_progress') return 'in_progress';
  return assessment.status;
}

interface AssessmentCardProps {
  assessment: Assessment;
  employeeName: string;
  isOwner: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  showEmployee?: boolean;
}

function AssessmentCard({ assessment, employeeName, isOwner, expandedId, onToggleExpand, showEmployee }: AssessmentCardProps) {
  const navigate = useNavigate();
  const { getAttemptForAssessment } = useAttemptStore();
  const { domains } = useDomainStore();

  const domain = domains.find((d) => d.id === assessment.domain_id);
  const attempt = getAttemptForAssessment(assessment.id);
  const status = getEffectiveStatus(assessment, getAttemptForAssessment);
  const isExpanded = expandedId === assessment.id;
  const isCompleted = status === 'completed' || status === 'reviewed';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-card-foreground">
              {domain?.name ?? 'Unknown Domain'}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {showEmployee && <><span className="font-medium text-foreground">{employeeName}</span> · </>}
            {assessment.assessment_questions.length} questions · {assessment.duration_minutes} min · {new Date(assessment.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && status === 'pending' && (
            <Button size="sm" variant="outline" onClick={() => navigate('/assessment-exec')} className="gap-1.5">
              <Play size={14} /> Start
            </Button>
          )}
          {isOwner && status === 'in_progress' && (
            <Button size="sm" onClick={() => navigate('/assessment-exec')} className="gap-1.5">
              <Play size={14} /> Resume
            </Button>
          )}
          {isCompleted && (
            <Button size="sm" variant="ghost" onClick={() => onToggleExpand(assessment.id)} className="gap-1.5">
              <Eye size={14} /> {isExpanded ? 'Hide' : 'View Details'}
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          )}
          {!isOwner && isCompleted && (
            <Button size="sm" variant="outline" onClick={() => navigate('/reviews')} className="gap-1.5">
              <FileSearch size={14} /> Review
            </Button>
          )}
          <Badge className={`text-xs border ${statusStyles[status] ?? statusStyles.pending}`}>
            {statusLabels[status] ?? status}
          </Badge>
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
  const { fetchDomains } = useDomainStore();
  const { currentRole, user } = useAuth();
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchAssessments(); fetchQuestions(); fetchSkills(); fetchDomains(); fetchAttempts();
  }, [fetchAssessments, fetchQuestions, fetchSkills, fetchDomains, fetchAttempts]);

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

  // Fetch employee names for team view
  useEffect(() => {
    const ids = [...new Set([...myAssessments, ...teamAssessments].map((a) => a.employee_id))];
    if (ids.length === 0) return;
    supabase.from('users').select('id, full_name').in('id', ids).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((u: any) => { map[u.id] = u.full_name; });
        setUserNames(map);
      }
    });
  }, [myAssessments, teamAssessments]);

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));
  const getName = (id: string) => userNames[id] || id;

  const showTabs = currentRole === 'admin' || currentRole === 'manager';

  if (!showTabs) {
    // Employee view — no tabs
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Your assessments are auto-generated from skill registry submissions.
        </p>
        {myAssessments.length === 0 ? (
          <EmptyState message="No assessments yet. Submit your skill registry to generate one." />
        ) : (
          <div className="space-y-4">
            {myAssessments.map((a) => (
              <AssessmentCard
                key={a.id}
                assessment={a}
                employeeName={getName(a.employee_id)}
                isOwner
                expandedId={expandedId}
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Assessments are auto-generated from employee skill submissions. Questions are selected based on claimed proficiency levels.
      </p>
      <Tabs defaultValue="my">
        <TabsList>
          <TabsTrigger value="my" className="gap-1.5">
            <User size={14} /> My Assessments
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Users size={14} /> Team's Assessments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my">
          {myAssessments.length === 0 ? (
            <EmptyState message="No assessments assigned to you yet." />
          ) : (
            <div className="space-y-4">
              {myAssessments.map((a) => (
                <AssessmentCard
                  key={a.id}
                  assessment={a}
                  employeeName={getName(a.employee_id)}
                  isOwner
                  expandedId={expandedId}
                  onToggleExpand={toggleExpand}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="team">
          {teamAssessments.length === 0 ? (
            <EmptyState message="No team assessments found." />
          ) : (
            <div className="space-y-4">
              {teamAssessments.map((a) => (
                <AssessmentCard
                  key={a.id}
                  assessment={a}
                  employeeName={getName(a.employee_id)}
                  isOwner={false}
                  expandedId={expandedId}
                  onToggleExpand={toggleExpand}
                  showEmployee
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
