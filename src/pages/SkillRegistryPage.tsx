import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRegistryStore, RatingLevel, SkillSelfRating, ratingLabels, SkillRegistrySubmission } from '@/stores/registryStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore, Skill } from '@/stores/skillStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useCycleStore } from '@/stores/cycleStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import RatingSlider from '@/components/registry/RatingSlider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle, Lock, AlertTriangle, Send, Search, Info, FolderOpen, Tag,
  ClipboardCheck, Clock, Eye, Award, MessageSquare,
  Calendar, ArrowRight, Play, FileText, Loader2, ArrowLeft, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ── Status derivation ──
type EmployeeStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'assessment_pending'
  | 'assessment_completed'
  | 'review_pending'
  | 'approved';

function deriveStatus(
  submission: SkillRegistrySubmission | undefined,
  assessments: ReturnType<typeof useAssessmentStore.getState>['assessments'],
  attempts: ReturnType<typeof useAttemptStore.getState>['attempts'],
  reviews: ReturnType<typeof useReviewStore.getState>['reviews'],
): EmployeeStatus {
  if (!submission) return 'not_started';
  if (submission.status === 'draft') return 'in_progress';
  const assessment = assessments.find((a) => a.submission_id === submission.id);
  if (!assessment) return 'submitted';
  const attempt = attempts.find((a) => a.assessment_id === assessment.id);
  if (!attempt || attempt.status === 'in_progress') return 'assessment_pending';
  const review = reviews.find((r) => r.attempt_id === attempt.id);
  if (!review) return 'assessment_completed';
  if (review.status === 'completed') return 'approved';
  return 'review_pending';
}

const statusConfig: Record<EmployeeStatus, { label: string; color: string; cta: string; ctaDisabled?: boolean }> = {
  not_started: { label: 'Not Started', color: 'bg-muted text-muted-foreground', cta: 'Start Self Review' },
  in_progress: { label: 'In Progress', color: 'bg-warning/15 text-warning border-warning/20', cta: 'Continue Self Review' },
  submitted: { label: 'Self Review Submitted', color: 'bg-primary/15 text-primary border-primary/20', cta: 'Attempt Assessment' },
  assessment_pending: { label: 'Assessment Pending', color: 'bg-accent text-accent-foreground', cta: 'Attempt Assessment' },
  assessment_completed: { label: 'Assessment Completed', color: 'bg-success/15 text-success border-success/20', cta: 'View Assessment Results' },
  review_pending: { label: 'Manager Review Pending', color: 'bg-warning/15 text-warning border-warning/20', cta: 'Waiting for Review', ctaDisabled: true },
  approved: { label: 'Approved', color: 'bg-success/15 text-success border-success/20', cta: 'View Final Results' },
};

const statusLabel = (status: EmployeeStatus) => statusConfig[status].label;
const statusColor = (status: EmployeeStatus) => statusConfig[status].color;

// ── Helper: compute avg ──
function avgRound(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

// ── Types for enriched submission ──
interface EnrichedSubmission {
  submission: SkillRegistrySubmission;
  selfAvg: number;
  assessmentAvg: number | null;
  finalAvg: number | null;
  status: EmployeeStatus;
  reviewer: { id: string; name: string; email: string; avatar_url: string } | null;
  isActive: boolean;
}

// ── Page ──
export default function SkillRegistryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Stores
  const { submissions, assignments, currentCycle, getSubmission, createOrUpdateDraft, submitRegistry, markAssessmentGenerated, fetchRegistry, setCurrentCycle } = useRegistryStore();
  const { assessments, addAssessment, fetchAssessments } = useAssessmentStore();
  const { attempts, fetchAttempts } = useAttemptStore();
  const { reviews, officialEntries, fetchReviews } = useReviewStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, categories, fetchSkills } = useSkillStore();
  const { questions, fetchQuestions } = useQuestionStore();
  const { activeCycle, isSubmissionAllowed, getDaysRemaining, fetchCycles } = useCycleStore();

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  // Fetch all data
  useEffect(() => {
    fetchAssessments(); fetchDomains(); fetchSkills(); fetchQuestions(); fetchRegistry(); fetchCycles(); fetchAttempts(); fetchReviews();
  }, []);

  useEffect(() => {
    if (activeCycle) setCurrentCycle(activeCycle.name);
  }, [activeCycle, setCurrentCycle]);

  // Reviewer data fetched from users table
  const [reviewerMap, setReviewerMap] = useState<Record<string, { name: string; email: string; avatar_url: string }>>({});

  useEffect(() => {
    const reviewerIds = [...new Set(reviews.filter((r) => r.employee_id === employeeId).map((r) => r.reviewer_id))];
    if (reviewerIds.length === 0) return;
    supabase.from('users').select('id, full_name, email, avatar_url').in('id', reviewerIds).then(({ data }) => {
      if (!data) return;
      const map: Record<string, { name: string; email: string; avatar_url: string }> = {};
      data.forEach((u: any) => { map[u.id] = { name: u.full_name, email: u.email, avatar_url: u.avatar_url || '' }; });
      setReviewerMap(map);
    });
  }, [reviews, employeeId]);

  // Domain
  const assignedDomain = useMemo(() => {
    if (user?.domain_id) return domains.find((d) => d.id === user.domain_id) ?? null;
    const assignment = assignments.find((a) => a.employee_id === employeeId);
    return assignment ? domains.find((d) => d.id === assignment.domain_id) ?? null : null;
  }, [user, domains, assignments, employeeId]);

  const domainSkillIds = useMemo(() => {
    if (!assignedDomain) return [];
    return mappings.filter((m) => m.domain_id === assignedDomain.id).map((m) => m.skill_id);
  }, [assignedDomain, mappings]);

  const domainSkills = useMemo(
    () => skills.filter((s) => domainSkillIds.includes(s.id) && s.status === 'active'),
    [skills, domainSkillIds]
  );

  // Current submission & status
  const submission = getSubmission(employeeId, currentCycle);
  const employeeStatus = deriveStatus(submission, assessments, attempts, reviews);
  const isLocked = submission?.status === 'submitted' || submission?.status === 'assessment_generated';

  // ── Build enriched submissions list ──
  const enrichedSubmissions = useMemo<EnrichedSubmission[]>(() => {
    const mySubmissions = submissions.filter((s) => s.employee_id === employeeId);
    return mySubmissions.map((sub) => {
      const isActive = activeCycle ? sub.cycle === activeCycle.name : false;

      // Self avg
      const selfAvg = avgRound(sub.ratings.map((r) => r.rating));

      // Assessment avg: submission → assessment → attempt → skill_scores
      let assessmentAvg: number | null = null;
      const assessment = assessments.find((a) => a.submission_id === sub.id);
      if (assessment) {
        const attempt = attempts.find((a) => a.assessment_id === assessment.id);
        if (attempt && attempt.skill_scores.length > 0) {
          assessmentAvg = avgRound(attempt.skill_scores.map((ss) => ss.calculated_level));
        }
      }

      // Final avg: from officialEntries for this employee + cycle
      let finalAvg: number | null = null;
      const officialForCycle = (officialEntries || []).filter(
        (oe) => oe.employee_id === sub.employee_id && oe.cycle === sub.cycle
      );
      if (officialForCycle.length > 0) {
        finalAvg = avgRound(officialForCycle.map((oe) => oe.final_level));
      }

      // Status
      const status = deriveStatus(sub, assessments, attempts, reviews);

      // Reviewer
      let reviewer: EnrichedSubmission['reviewer'] = null;
      if (assessment) {
        const attempt = attempts.find((a) => a.assessment_id === assessment.id);
        if (attempt) {
          const review = reviews.find((r) => r.attempt_id === attempt.id);
          if (review && reviewerMap[review.reviewer_id]) {
            reviewer = { id: review.reviewer_id, ...reviewerMap[review.reviewer_id] };
          }
        }
      }

      return { submission: sub, selfAvg, assessmentAvg, finalAvg, status, reviewer, isActive };
    }).sort((a, b) => {
      // Active first, then by date desc
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return new Date(b.submission.created_at).getTime() - new Date(a.submission.created_at).getTime();
    });
  }, [submissions, employeeId, activeCycle, assessments, attempts, reviews, officialEntries, reviewerMap]);

  // Previous cycle ratings
  const previousRatings = useMemo<Record<string, RatingLevel>>(() => {
    if (!activeCycle) return {};
    const pastSubs = submissions.filter((s) => s.employee_id === employeeId && s.cycle !== activeCycle.name);
    if (pastSubs.length === 0) return {};
    const latest = pastSubs[0];
    const map: Record<string, RatingLevel> = {};
    latest.ratings.forEach((r) => { map[r.skill_id] = r.rating; });
    return map;
  }, [submissions, employeeId, activeCycle]);

  // Ratings state
  const [ratings, setRatings] = useState<Record<string, RatingLevel>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (submission?.ratings) {
      const rMap: Record<string, RatingLevel> = {};
      const cMap: Record<string, string> = {};
      submission.ratings.forEach((r) => {
        rMap[r.skill_id] = r.rating;
        if (r.comment) cMap[r.skill_id] = r.comment;
      });
      setRatings(rMap);
      setComments(cMap);
    }
  }, [submission?.id]);

  // Auto-save
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isDirtyRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const triggerAutoSave = useCallback(() => {
    if (isLocked || !assignedDomain) return;
    isDirtyRef.current = true;
    setSaveStatus('idle');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return;
      setSaveStatus('saving');
      const ratingsList: SkillSelfRating[] = Object.entries(ratings).map(([skill_id, rating]) => ({
        skill_id, rating, comment: comments[skill_id] || undefined,
      }));
      await createOrUpdateDraft(employeeId, tenantId, assignedDomain!.id, ratingsList);
      isDirtyRef.current = false;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 2000);
  }, [isLocked, assignedDomain, ratings, comments, employeeId, tenantId, createOrUpdateDraft]);

  const handleRatingChange = useCallback((skillId: string, rating: RatingLevel) => {
    if (isLocked) return;
    setRatings((prev) => {
      const next = { ...prev, [skillId]: rating };
      setTimeout(() => triggerAutoSave(), 0);
      return next;
    });
  }, [isLocked, triggerAutoSave]);

  const handleCommentChange = useCallback((skillId: string, comment: string) => {
    setComments((prev) => {
      const next = { ...prev, [skillId]: comment };
      setTimeout(() => triggerAutoSave(), 0);
      return next;
    });
  }, [triggerAutoSave]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [detailSubmissionId, setDetailSubmissionId] = useState<string | null>(null);

  const allRated = domainSkills.length > 0 && domainSkills.every((s) => ratings[s.id] != null);
  const ratedCount = domainSkills.filter((s) => ratings[s.id] != null).length;

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return domainSkills;
    const q = search.toLowerCase();
    return domainSkills.filter((s) =>
      s.skill_name.toLowerCase().includes(q) ||
      s.skill_description.toLowerCase().includes(q) ||
      (s.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [domainSkills, search]);

  const groupedSkills = useMemo(() => {
    const map = new Map<string, Skill[]>();
    filteredSkills.forEach((s) => {
      const cat = s.skill_category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [filteredSkills]);

  // CTA handler
  const handleCTA = () => {
    switch (employeeStatus) {
      case 'not_started':
      case 'in_progress':
        setShowForm(true);
        break;
      case 'submitted':
      case 'assessment_pending':
      case 'assessment_completed':
      case 'approved':
        navigate('/assessments');
        break;
      default:
        break;
    }
  };

  const handleSubmit = () => {
    if (!allRated) { toast.error('Please rate all skills before submitting'); return; }
    setConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    if (!assignedDomain) return;
    const ratingsList: SkillSelfRating[] = Object.entries(ratings).map(([skill_id, rating]) => ({
      skill_id, rating, comment: comments[skill_id] || undefined,
    }));
    await createOrUpdateDraft(employeeId, tenantId, assignedDomain.id, ratingsList);
    const sub = getSubmission(employeeId, currentCycle);
    if (sub) {
      await submitRegistry(sub.id);
      const skillIds = ratingsList.map((r) => r.skill_id);
      const publishedQuestions = questions.filter(
        (q) => skillIds.includes(q.skill_id) && q.status === 'published'
      );
      await addAssessment({
        tenant_id: tenantId, employee_id: employeeId, submission_id: sub.id,
        domain_id: assignedDomain.id, ratings: ratingsList, publishedQuestions,
      });
      await markAssessmentGenerated(sub.id);
    }
    setConfirmOpen(false);
    setSuccessOpen(true);
  };

  const submissionAllowed = isSubmissionAllowed();
  const daysRemaining = getDaysRemaining();

  // ── Detail view for past registry ──
  const detailEnriched = detailSubmissionId
    ? enrichedSubmissions.find((e) => e.submission.id === detailSubmissionId)
    : null;

  if (detailEnriched) {
    return (
      <RegistryDetailView
        enriched={detailEnriched}
        skills={skills}
        assessments={assessments}
        attempts={attempts}
        reviews={reviews}
        officialEntries={officialEntries || []}
        onBack={() => setDetailSubmissionId(null)}
      />
    );
  }

  // ── RENDER ──
  const config = employeeStatus ? statusConfig[employeeStatus] : null;

  // No domain warning
  if (activeCycle && !assignedDomain) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">My Skill Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">Submit your self-assessed skill ratings and track your progress.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle size={32} className="text-warning mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Domain Assigned</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You have not been assigned to a domain yet. Please contact your manager or admin.
          </p>
        </div>
        {enrichedSubmissions.filter((e) => !e.isActive).length > 0 && (
          <RegistryCardList
            enrichedList={enrichedSubmissions.filter((e) => !e.isActive)}
            onViewDetail={(id) => setDetailSubmissionId(id)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">My Skill Registry</h2>
        <p className="text-sm text-muted-foreground mt-1">Submit your self-assessed skill ratings and track your progress.</p>
      </div>

      {/* Section 1: Active Cycle Card */}
      {activeCycle && assignedDomain && config && (
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-primary" />
                  <h3 className="text-base font-semibold text-foreground">{activeCycle.name}</h3>
                  <Badge className={`text-xs ${config.color}`}>{config.label}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Domain: <span className="font-medium text-foreground">{assignedDomain.name}</span></span>
                  <span>•</span>
                  <span>{new Date(activeCycle.start_date).toLocaleDateString()} – {new Date(activeCycle.end_date).toLocaleDateString()}</span>
                  {daysRemaining !== null && submissionAllowed && !isLocked && (
                    <>
                      <span>•</span>
                      <span className={`font-medium ${daysRemaining <= 3 ? 'text-destructive' : daysRemaining <= 7 ? 'text-warning' : 'text-muted-foreground'}`}>
                        {daysRemaining > 0 ? `${daysRemaining} days remaining` : daysRemaining === 0 ? 'Ends today' : 'Grace period active'}
                      </span>
                    </>
                  )}
                </div>
                {/* Inline scores for active cycle */}
                {submission && (
                  <div className="flex flex-wrap gap-4 mt-1">
                    <ScoreChip label="Self" value={enrichedSubmissions.find((e) => e.isActive)?.selfAvg ?? null} />
                    <ScoreChip label="Assessment" value={enrichedSubmissions.find((e) => e.isActive)?.assessmentAvg ?? null} />
                    <ScoreChip label="Final" value={enrichedSubmissions.find((e) => e.isActive)?.finalAvg ?? null} />
                  </div>
                )}
                {ratedCount > 0 && employeeStatus !== 'not_started' && (
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={(ratedCount / domainSkills.length) * 100} className="h-1.5 w-32" />
                    <span className="text-xs text-muted-foreground">{ratedCount}/{domainSkills.length} skills rated</span>
                  </div>
                )}
              </div>
              <Button onClick={handleCTA} disabled={config.ctaDisabled} className="gap-1.5 shrink-0">
                {employeeStatus === 'not_started' && <Play size={14} />}
                {employeeStatus === 'in_progress' && <ArrowRight size={14} />}
                {(employeeStatus === 'submitted' || employeeStatus === 'assessment_pending') && <ClipboardCheck size={14} />}
                {employeeStatus === 'assessment_completed' && <Eye size={14} />}
                {employeeStatus === 'review_pending' && <Clock size={14} />}
                {employeeStatus === 'approved' && <Award size={14} />}
                {config.cta}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No active cycle message */}
      {!activeCycle && (
        <Card className="border-border">
          <CardContent className="p-5 flex items-center gap-3">
            <Clock size={20} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">No Active Review Cycle</p>
              <p className="text-xs text-muted-foreground">There is no active review cycle at the moment. Your past registries are shown below.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 2: Self Review Form */}
      {activeCycle && assignedDomain && (showForm || employeeStatus === 'in_progress' || isLocked) && (
        <SelfReviewForm
          domainSkills={domainSkills}
          filteredSkills={filteredSkills}
          groupedSkills={groupedSkills}
          ratings={ratings}
          comments={comments}
          previousRatings={previousRatings}
          isLocked={isLocked}
          submissionAllowed={submissionAllowed}
          ratedCount={ratedCount}
          allRated={allRated}
          search={search}
          saveStatus={saveStatus}
          onSearchChange={setSearch}
          onRatingChange={handleRatingChange}
          onCommentChange={handleCommentChange}
          onSubmit={handleSubmit}
          skills={skills}
        />
      )}

      {/* Section 3: Past Registries listing */}
      {enrichedSubmissions.filter((e) => !e.isActive).length > 0 && (
        <RegistryCardList
          enrichedList={enrichedSubmissions.filter((e) => !e.isActive)}
          onViewDetail={(id) => setDetailSubmissionId(id)}
        />
      )}

      {/* No submissions at all */}
      {enrichedSubmissions.length === 0 && !activeCycle && (
        <div className="flex flex-col items-center justify-center py-16">
          <FileText size={32} className="text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Skill Registry Records</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You don't have any skill registry submissions yet.
          </p>
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Submission</DialogTitle>
            <DialogDescription>
              Once submitted, your skill ratings will be locked for this cycle ({currentCycle}) and an assessment will be automatically generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 my-2 max-h-60 overflow-y-auto">
            {Object.entries(ratings).map(([skillId, rating]) => {
              const skill = skills.find((s) => s.id === skillId);
              return (
                <div key={skillId} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5">
                  <span className="text-sm text-foreground">{skill?.skill_name}</span>
                  <span className="text-xs text-muted-foreground">Level {rating} — {ratingLabels[rating]}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmSubmit} className="gap-1.5"><Lock size={14} /> Confirm & Lock</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <AlertDialog open={successOpen} onOpenChange={setSuccessOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex justify-center mb-3">
              <div className="rounded-full bg-success/10 p-3">
                <ClipboardCheck size={28} className="text-success" />
              </div>
            </div>
            <AlertDialogTitle className="text-center">Assessment Ready!</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Your skill registry has been submitted and an assessment has been generated based on your self-ratings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={() => { setSuccessOpen(false); navigate('/assessments'); }} className="w-full gap-1.5">
              <ClipboardCheck size={14} /> Attempt Now
            </Button>
            <Button variant="ghost" onClick={() => setSuccessOpen(false)} className="w-full gap-1.5">
              <Clock size={14} /> Later
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Score chip ──
function ScoreChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {value !== null ? (
        <Badge variant="secondary" className="text-xs font-semibold">L{value}</Badge>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}

// ── Manager avatar with hover card ──
function ManagerAvatar({ reviewer }: { reviewer: EnrichedSubmission['reviewer'] }) {
  if (!reviewer) return <span className="text-xs text-muted-foreground">—</span>;
  const initials = reviewer.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="focus:outline-none">
          <Avatar className="h-7 w-7 cursor-pointer">
            {reviewer.avatar_url ? <AvatarImage src={reviewer.avatar_url} alt={reviewer.name} /> : null}
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64" side="top">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {reviewer.avatar_url ? <AvatarImage src={reviewer.avatar_url} alt={reviewer.name} /> : null}
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{reviewer.name}</p>
            <p className="text-xs text-muted-foreground">{reviewer.email}</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// ── Registry card list (past registries) ──
function RegistryCardList({
  enrichedList,
  onViewDetail,
}: {
  enrichedList: EnrichedSubmission[];
  onViewDetail: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <FileText size={14} className="text-muted-foreground" /> Past Registries
      </h3>
      <div className="space-y-2">
        {enrichedList.map((item) => (
          <Card
            key={item.submission.id}
            className="border-border hover:border-primary/30 transition-colors cursor-pointer"
            onClick={() => onViewDetail(item.submission.id)}
          >
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{item.submission.cycle}</p>
                      <Badge className={`text-[10px] ${statusColor(item.status)}`}>{statusLabel(item.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(item.submission.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <ScoreChip label="Self" value={item.selfAvg || null} />
                  <ScoreChip label="Assessment" value={item.assessmentAvg} />
                  <ScoreChip label="Final" value={item.finalAvg} />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Manager:</span>
                    <ManagerAvatar reviewer={item.reviewer} />
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs shrink-0" onClick={(e) => { e.stopPropagation(); onViewDetail(item.submission.id); }}>
                    <Eye size={13} /> View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Detail view for a past registry ──
function RegistryDetailView({
  enriched,
  skills,
  assessments,
  attempts,
  reviews,
  officialEntries,
  onBack,
}: {
  enriched: EnrichedSubmission;
  skills: Skill[];
  assessments: ReturnType<typeof useAssessmentStore.getState>['assessments'];
  attempts: ReturnType<typeof useAttemptStore.getState>['attempts'];
  reviews: ReturnType<typeof useReviewStore.getState>['reviews'];
  officialEntries: ReturnType<typeof useReviewStore.getState>['officialEntries'];
  onBack: () => void;
}) {
  const [detailSearch, setDetailSearch] = useState('');
  const sub = enriched.submission;

  // Build per-skill score maps
  const assessment = assessments.find((a) => a.submission_id === sub.id);
  const attempt = assessment ? attempts.find((a) => a.assessment_id === assessment.id) : null;

  const assessmentScoreMap = useMemo<Record<string, number>>(() => {
    if (!attempt) return {};
    const map: Record<string, number> = {};
    attempt.skill_scores.forEach((ss) => { map[ss.skill_id] = ss.calculated_level; });
    return map;
  }, [attempt]);

  const finalScoreMap = useMemo<Record<string, number>>(() => {
    const entries = (officialEntries || []).filter(
      (oe) => oe.employee_id === sub.employee_id && oe.cycle === sub.cycle
    );
    const map: Record<string, number> = {};
    entries.forEach((oe) => { map[oe.skill_id] = oe.final_level; });
    return map;
  }, [officialEntries, sub]);

  const review = attempt ? reviews.find((r) => r.attempt_id === attempt.id) : null;

  // Skills from ratings
  const ratedSkillIds = sub.ratings.map((r) => r.skill_id);
  const ratedSkills = skills.filter((s) => ratedSkillIds.includes(s.id));

  const filtered = useMemo(() => {
    if (!detailSearch.trim()) return ratedSkills;
    const q = detailSearch.toLowerCase();
    return ratedSkills.filter((s) =>
      s.skill_name.toLowerCase().includes(q) || (s.skill_category || '').toLowerCase().includes(q)
    );
  }, [ratedSkills, detailSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, Skill[]>();
    filtered.forEach((s) => {
      const cat = s.skill_category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [filtered]);

  const ratingMap: Record<string, RatingLevel> = {};
  sub.ratings.forEach((r) => { ratingMap[r.skill_id] = r.rating; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft size={14} /> Back
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{sub.cycle}</h2>
          <p className="text-xs text-muted-foreground">Submitted {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}</p>
        </div>
        <Badge className={`text-xs ml-2 ${statusColor(enriched.status)}`}>{statusLabel(enriched.status)}</Badge>
      </div>

      {/* Score cards + Manager */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ScoreCard label="Self Score (avg)" value={enriched.selfAvg} />
        <ScoreCard label="Assessment Score (avg)" value={enriched.assessmentAvg} />
        <ScoreCard label="Final Score (avg)" value={enriched.finalAvg} />
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Manager</span>
            {enriched.reviewer ? (
              <div className="flex flex-col items-center gap-1">
                <ManagerAvatar reviewer={enriched.reviewer} />
                <span className="text-xs font-medium text-foreground">{enriched.reviewer.name}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
            {review?.overall_comment && (
              <p className="text-xs text-muted-foreground italic mt-1 text-center">"{review.overall_comment}"</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      {ratedSkills.length > 4 && (
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search skills..." value={detailSearch} onChange={(e) => setDetailSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
      )}

      {/* Skills grouped by category */}
      <Accordion type="multiple" defaultValue={Array.from(grouped.keys())} className="space-y-3">
        {Array.from(grouped.entries()).map(([catName, catSkills]) => (
          <AccordionItem key={catName} value={catName} className="rounded-xl border border-border bg-card overflow-hidden">
            <AccordionTrigger className="px-5 py-3 hover:no-underline">
              <div className="flex items-center gap-3 text-left flex-1">
                <FolderOpen size={16} className="text-primary shrink-0" />
                <span className="font-semibold text-card-foreground">{catName}</span>
                <span className="text-xs text-muted-foreground">({catSkills.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground">Skill</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Self</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Assessment</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Final</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {catSkills.map((skill) => {
                      const selfR = ratingMap[skill.id] ?? null;
                      const assessR = assessmentScoreMap[skill.id] ?? null;
                      const finalR = finalScoreMap[skill.id] ?? null;
                      const gap = selfR !== null && finalR !== null ? finalR - selfR : null;
                      return (
                        <tr key={skill.id} className="hover:bg-muted/20">
                          <td className="px-5 py-3 font-medium text-foreground">{skill.skill_name}</td>
                          <td className="text-center px-3 py-3">{selfR !== null ? <Badge variant="secondary" className="text-xs">L{selfR}</Badge> : '—'}</td>
                          <td className="text-center px-3 py-3">{assessR !== null ? <Badge variant="outline" className="text-xs">L{assessR}</Badge> : '—'}</td>
                          <td className="text-center px-3 py-3">{finalR !== null ? <Badge className="text-xs bg-primary/10 text-primary border-primary/20">L{finalR}</Badge> : '—'}</td>
                          <td className="text-center px-3 py-3">
                            {gap !== null ? (
                              <span className={`text-xs font-semibold ${gap > 0 ? 'text-success' : gap < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {gap > 0 ? `+${gap}` : gap}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

// ── Score card for detail header ──
function ScoreCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
        <span className="text-xs text-muted-foreground text-center">{label}</span>
        {value !== null ? (
          <span className="text-2xl font-bold text-foreground">L{value}</span>
        ) : (
          <span className="text-lg text-muted-foreground">—</span>
        )}
      </CardContent>
    </Card>
  );
}

// ── Self Review Form Component ──
function SelfReviewForm({
  domainSkills, filteredSkills, groupedSkills, ratings, comments, previousRatings,
  isLocked, submissionAllowed, ratedCount, allRated, search, saveStatus,
  onSearchChange, onRatingChange, onCommentChange, onSubmit, skills,
}: {
  domainSkills: Skill[];
  filteredSkills: Skill[];
  groupedSkills: Map<string, Skill[]>;
  ratings: Record<string, RatingLevel>;
  comments: Record<string, string>;
  previousRatings: Record<string, RatingLevel>;
  isLocked: boolean;
  submissionAllowed: boolean;
  ratedCount: number;
  allRated: boolean;
  search: string;
  saveStatus: 'idle' | 'saving' | 'saved';
  onSearchChange: (v: string) => void;
  onRatingChange: (skillId: string, rating: RatingLevel) => void;
  onCommentChange: (skillId: string, comment: string) => void;
  onSubmit: () => void;
  skills: Skill[];
}) {
  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Progress + Search bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Progress value={domainSkills.length > 0 ? (ratedCount / domainSkills.length) * 100 : 0} className="h-2 w-40" />
            <span className="text-xs text-muted-foreground font-medium">{ratedCount} of {domainSkills.length} skills rated</span>
            {saveStatus === 'saving' && (
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Saving...</span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-success flex items-center gap-1"><CheckCircle size={12} /> Saved</span>
            )}
          </div>
          {domainSkills.length > 0 && (
            <div className="relative max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search skills..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-8 h-9 text-sm" maxLength={100} />
            </div>
          )}
        </div>

        {/* Rating scale legend (draft only) */}
        {!isLocked && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Rating Scale</p>
            <div className="grid grid-cols-5 gap-2">
              {([1, 2, 3, 4, 5] as RatingLevel[]).map((l) => (
                <div key={l} className="text-center">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">L{l}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{ratingLabels[l]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Accordions */}
        {domainSkills.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No skills mapped to this domain yet.</div>
        ) : groupedSkills.size === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No skills match your search.</div>
        ) : (
          <Accordion type="multiple" defaultValue={isLocked ? [] : Array.from(groupedSkills.keys())} className="space-y-3">
            {Array.from(groupedSkills.entries()).map(([catName, catSkills]) => {
              const catRatedCount = catSkills.filter((s) => ratings[s.id] != null).length;
              const allCatRated = catRatedCount === catSkills.length;
              return (
                <AccordionItem key={catName} value={catName} className="rounded-xl border border-border bg-card overflow-hidden">
                  <AccordionTrigger className="px-5 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 text-left flex-1">
                      <FolderOpen size={16} className="text-primary shrink-0" />
                      <div className="flex-1">
                        <span className="font-semibold text-card-foreground">{catName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({catSkills.length} skill{catSkills.length !== 1 ? 's' : ''})</span>
                      </div>
                      <div className="flex items-center gap-2 mr-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${catSkills.length > 0 ? (catRatedCount / catSkills.length) * 100 : 0}%` }} />
                        </div>
                        <span className={`text-xs font-medium ${allCatRated ? 'text-success' : 'text-muted-foreground'}`}>{catRatedCount}/{catSkills.length}</span>
                        {allCatRated && <CheckCircle size={14} className="text-success" />}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-0">
                    <div className="divide-y divide-border">
                      {catSkills.map((skill) => (
                        <div key={skill.id} className="px-5 py-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-card-foreground">{skill.skill_name}</p>
                                {skill.skill_description && (
                                  <Tooltip>
                                    <TooltipTrigger asChild><Info size={13} className="text-muted-foreground cursor-help shrink-0" /></TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs text-xs">{skill.skill_description}</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              {(skill.tags || []).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {skill.tags.map((tag) => (
                                    <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5"><Tag size={9} />{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {ratings[skill.id] != null && (
                              <Badge variant="secondary" className="text-xs ml-3 shrink-0">L{ratings[skill.id]} — {ratingLabels[ratings[skill.id]]}</Badge>
                            )}
                          </div>
                          <RatingSlider
                            value={ratings[skill.id] ?? null}
                            onChange={(rating) => onRatingChange(skill.id, rating)}
                            disabled={isLocked}
                            previousRating={previousRatings[skill.id]}
                          />
                          {!isLocked && (
                            <Collapsible className="mt-2">
                              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                <MessageSquare size={12} />
                                {comments[skill.id] ? 'Edit comment' : 'Add comment'}
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <Textarea
                                  placeholder="Optional notes about your experience with this skill..."
                                  value={comments[skill.id] || ''}
                                  onChange={(e) => onCommentChange(skill.id, e.target.value)}
                                  className="text-xs min-h-[60px]"
                                  maxLength={500}
                                />
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                          {isLocked && comments[skill.id] && (
                            <p className="text-xs text-muted-foreground mt-2 italic">"{comments[skill.id]}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* Submit bar */}
        {!isLocked && submissionAllowed && domainSkills.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{ratedCount}/{domainSkills.length} skills rated</p>
            <Button size="sm" onClick={onSubmit} disabled={!allRated} className="gap-1.5">
              <Send size={14} /> Submit & Generate Assessment
            </Button>
          </div>
        )}

        {isLocked && (
          <div className="rounded-xl border border-success/20 bg-success/5 p-4 flex items-start gap-3">
            <CheckCircle size={18} className="text-success mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Submission Complete</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your self-assessment has been locked. Navigate to Assessments to complete your skill validation.</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
