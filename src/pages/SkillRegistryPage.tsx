import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRegistryStore, RatingLevel, SkillSelfRating, ratingLabels } from '@/stores/registryStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore, Skill } from '@/stores/skillStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useCycleStore } from '@/stores/cycleStore';
import { useAuth } from '@/contexts/AuthContext';
import RatingSlider from '@/components/registry/RatingSlider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  CheckCircle, Lock, AlertTriangle, Send, Search, Info, FolderOpen, Tag,
  ClipboardCheck, Clock, Eye, TrendingUp, Award, BarChart3, MessageSquare,
  Calendar, ArrowRight, Save, Loader2, Play, FileText,
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
  submission: ReturnType<typeof useRegistryStore.getState>['submissions'][0] | undefined,
  assessments: ReturnType<typeof useAssessmentStore.getState>['assessments'],
  attempts: ReturnType<typeof useAttemptStore.getState>['attempts'],
  reviews: ReturnType<typeof useReviewStore.getState>['reviews'],
): EmployeeStatus {
  if (!submission) return 'not_started';
  if (submission.status === 'draft') return 'in_progress';

  // Find assessment for this submission
  const assessment = assessments.find((a) => a.submission_id === submission.id);
  if (!assessment) return 'submitted';

  // Find attempt for this assessment
  const attempt = attempts.find((a) => a.assessment_id === assessment.id);
  if (!attempt || attempt.status === 'in_progress') return 'assessment_pending';

  // Find review
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

// ── Page ──
export default function SkillRegistryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Stores
  const { submissions, assignments, currentCycle, getSubmission, createOrUpdateDraft, submitRegistry, markAssessmentGenerated, fetchRegistry, setCurrentCycle } = useRegistryStore();
  const { assessments, addAssessment, fetchAssessments } = useAssessmentStore();
  const { attempts, fetchAttempts } = useAttemptStore();
  const { reviews, fetchReviews } = useReviewStore();
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

  // Previous cycle ratings
  const previousRatings = useMemo<Record<string, RatingLevel>>(() => {
    if (!activeCycle) return {};
    const pastSubs = submissions.filter((s) => s.employee_id === employeeId && s.cycle !== activeCycle.name);
    if (pastSubs.length === 0) return {};
    const latest = pastSubs[0]; // already sorted desc
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
      // schedule auto-save after state updates
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

  // Past registries
  const pastSubmissions = useMemo(() => {
    if (!activeCycle) return [];
    return submissions.filter((s) => s.employee_id === employeeId && s.cycle !== activeCycle.name);
  }, [submissions, employeeId, activeCycle]);

  // CTA handler
  const handleCTA = () => {
    switch (employeeStatus) {
      case 'not_started':
      case 'in_progress':
        setShowForm(true);
        break;
      case 'submitted':
      case 'assessment_pending':
        navigate('/assessments');
        break;
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

  // ── RENDER ──

  // No active cycle
  if (!activeCycle) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">My Skill Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">Submit your self-assessed skill ratings and track your progress.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <Clock size={32} className="text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Active Review Cycle</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            There is no active review cycle at the moment. Please wait for your admin to start a cycle.
          </p>
        </div>
        {pastSubmissions.length > 0 && <PastRegistriesTable submissions={pastSubmissions} skills={skills} />}
      </div>
    );
  }

  // No domain
  if (!assignedDomain) {
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
      </div>
    );
  }

  const config = statusConfig[employeeStatus];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">My Skill Registry</h2>
        <p className="text-sm text-muted-foreground mt-1">Submit your self-assessed skill ratings and track your progress.</p>
      </div>

      {/* Section 1: Active Cycle Card */}
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
              {ratedCount > 0 && employeeStatus !== 'not_started' && (
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={(ratedCount / domainSkills.length) * 100} className="h-1.5 w-32" />
                  <span className="text-xs text-muted-foreground">{ratedCount}/{domainSkills.length} skills rated</span>
                </div>
              )}
            </div>
            <Button
              onClick={handleCTA}
              disabled={config.ctaDisabled}
              className="gap-1.5 shrink-0"
            >
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

      {/* Section 2: Self Review Form */}
      {(showForm || employeeStatus === 'in_progress' || isLocked) && (
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

      {/* Section 3: Past Registries */}
      {pastSubmissions.length > 0 && <PastRegistriesTable submissions={pastSubmissions} skills={skills} />}

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
                          {/* Optional comment */}
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

// ── Past Registries Table ──
function PastRegistriesTable({
  submissions,
  skills,
}: {
  submissions: ReturnType<typeof useRegistryStore.getState>['submissions'];
  skills: Skill[];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <FileText size={14} className="text-muted-foreground" /> Past Registries
      </h3>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Cycle</TableHead>
              <TableHead className="text-xs">Skills Rated</TableHead>
              <TableHead className="text-xs">Avg Score</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((sub) => {
              const avgRating = sub.ratings.length > 0
                ? Math.round((sub.ratings.reduce((sum, r) => sum + r.rating, 0) / sub.ratings.length) * 10) / 10
                : 0;
              return (
                <TableRow key={sub.id}>
                  <TableCell className="text-sm font-medium">{sub.cycle}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sub.ratings.length}</TableCell>
                  <TableCell className="text-sm">
                    {avgRating > 0 ? <Badge variant="secondary" className="text-xs">L{avgRating}</Badge> : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${
                      sub.status === 'assessment_generated' ? 'bg-success/15 text-success border-success/20'
                        : sub.status === 'submitted' ? 'bg-primary/15 text-primary border-primary/20'
                        : 'bg-warning/15 text-warning border-warning/20'
                    }`}>
                      {sub.status === 'assessment_generated' ? 'Completed' : sub.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
