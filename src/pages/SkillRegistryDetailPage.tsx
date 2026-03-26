import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { ScoreCard } from '@/components/registry/ScoreCard';
import { ManagerAvatar } from '@/components/registry/ManagerAvatar';
import { RegistrySkillTable } from '@/components/registry/RegistrySkillTable';
import { deriveStatus, statusConfig, statusLabel, statusColor, avgRound, EnrichedSubmission } from '@/components/registry/registryHelpers';
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
  CheckCircle, Lock, Send, Search, Info, FolderOpen, Tag,
  ClipboardCheck, Clock, Eye, MessageSquare, ArrowLeft, Loader2,
  BarChart3, Award, UserCheck, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SkillRegistryDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { submissions, getSubmission, createOrUpdateDraft, submitRegistry, markAssessmentGenerated, fetchRegistry, currentCycle } = useRegistryStore();
  const { assessments, addAssessment, fetchAssessments } = useAssessmentStore();
  const { attempts, fetchAttempts } = useAttemptStore();
  const { reviews, officialEntries, fetchReviews } = useReviewStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { questions, fetchQuestions } = useQuestionStore();
  const { activeCycle, isSubmissionAllowed, fetchCycles } = useCycleStore();

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  useEffect(() => {
    fetchAssessments(); fetchDomains(); fetchSkills(); fetchQuestions(); fetchRegistry(); fetchCycles(); fetchAttempts(); fetchReviews();
  }, []);

  const submission = useMemo(
    () => submissions.find((s) => s.id === submissionId),
    [submissions, submissionId]
  );

  // Closed cycle check
  const isCycleClosed = useMemo(() => {
    if (!submission) return false;
    if (!activeCycle) return true; // no active cycle means it's closed
    return submission.cycle !== activeCycle.name;
  }, [submission, activeCycle]);

  const isDraft = submission?.status === 'draft';
  const isLocked = submission?.status === 'submitted' || submission?.status === 'assessment_generated';
  const isIncomplete = isDraft && isCycleClosed;

  const employeeStatus = useMemo(() => {
    return deriveStatus(submission, assessments, attempts, reviews, isIncomplete);
  }, [isIncomplete, submission, assessments, attempts, reviews]);

  // Domain
  const assignedDomain = useMemo(() => {
    if (!submission) return null;
    return domains.find((d) => d.id === submission.domain_id) ?? null;
  }, [submission, domains]);

  const domainSkillIds = useMemo(() => {
    if (!assignedDomain) return [];
    return mappings.filter((m) => m.domain_id === assignedDomain.id).map((m) => m.skill_id);
  }, [assignedDomain, mappings]);

  const domainSkills = useMemo(
    () => skills.filter((s) => domainSkillIds.includes(s.id) && s.status === 'active'),
    [skills, domainSkillIds]
  );

  // Reviewer
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

  // Enriched data
  const enriched = useMemo<EnrichedSubmission | null>(() => {
    if (!submission) return null;
    const selfAvg = avgRound(submission.ratings.map((r) => r.rating));
    let assessmentAvg: number | null = null;
    const assessment = assessments.find((a) => a.submission_id === submission.id);
    if (assessment) {
      const attempt = attempts.find((a) => a.assessment_id === assessment.id);
      if (attempt && attempt.skill_scores.length > 0) {
        assessmentAvg = avgRound(attempt.skill_scores.map((ss) => ss.calculated_level));
      }
    }
    let finalAvg: number | null = null;
    const officialForCycle = (officialEntries || []).filter(
      (oe) => oe.employee_id === submission.employee_id && oe.cycle === submission.cycle
    );
    if (officialForCycle.length > 0) {
      finalAvg = avgRound(officialForCycle.map((oe) => oe.final_level));
    }
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
    const isActive = activeCycle ? submission.cycle === activeCycle.name : false;
    return { submission, selfAvg, assessmentAvg, finalAvg, status: employeeStatus, reviewer, isActive };
  }, [submission, assessments, attempts, reviews, officialEntries, reviewerMap, activeCycle, employeeStatus]);

  // Previous cycle ratings
  const previousRatings = useMemo<Record<string, RatingLevel>>(() => {
    if (!submission) return {};
    const pastSubs = submissions.filter((s) => s.employee_id === employeeId && s.cycle !== submission.cycle);
    if (pastSubs.length === 0) return {};
    const latest = pastSubs[0];
    const map: Record<string, RatingLevel> = {};
    latest.ratings.forEach((r) => { map[r.skill_id] = r.rating; });
    return map;
  }, [submissions, employeeId, submission]);

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
    if (isLocked || isIncomplete || !assignedDomain) return;
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
  }, [isLocked, isIncomplete, assignedDomain, ratings, comments, employeeId, tenantId, createOrUpdateDraft]);

  const handleRatingChange = useCallback((skillId: string, rating: RatingLevel) => {
    if (isLocked || isIncomplete) return;
    setRatings((prev) => {
      const next = { ...prev, [skillId]: rating };
      setTimeout(() => triggerAutoSave(), 0);
      return next;
    });
  }, [isLocked, isIncomplete, triggerAutoSave]);

  const handleCommentChange = useCallback((skillId: string, comment: string) => {
    setComments((prev) => {
      const next = { ...prev, [skillId]: comment };
      setTimeout(() => triggerAutoSave(), 0);
      return next;
    });
  }, [triggerAutoSave]);

  // Form state
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

  const handleSubmit = () => {
    if (!allRated) { toast.error('Please rate all skills before submitting'); return; }
    setConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    if (!assignedDomain || !submission) return;
    const ratingsList: SkillSelfRating[] = Object.entries(ratings).map(([skill_id, rating]) => ({
      skill_id, rating, comment: comments[skill_id] || undefined,
    }));
    await createOrUpdateDraft(employeeId, tenantId, assignedDomain.id, ratingsList);
    await submitRegistry(submission.id);
    const skillIds = ratingsList.map((r) => r.skill_id);
    const publishedQuestions = questions.filter(
      (q) => skillIds.includes(q.skill_id) && q.status === 'published'
    );
    await addAssessment({
      tenant_id: tenantId, employee_id: employeeId, submission_id: submission.id,
      domain_id: assignedDomain.id, ratings: ratingsList, publishedQuestions,
    });
    await markAssessmentGenerated(submission.id);
    setConfirmOpen(false);
    setSuccessOpen(true);
  };

  const submissionAllowed = isSubmissionAllowed();

  // Score maps for read-only detail
  const assessment = useMemo(() => assessments.find((a) => a.submission_id === submission?.id), [assessments, submission]);
  const attempt = useMemo(() => assessment ? attempts.find((a) => a.assessment_id === assessment.id) : null, [assessment, attempts]);
  const review = useMemo(() => attempt ? reviews.find((r) => r.attempt_id === attempt.id) : null, [attempt, reviews]);

  const assessmentScoreMap = useMemo<Record<string, number>>(() => {
    if (!attempt) return {};
    const map: Record<string, number> = {};
    attempt.skill_scores.forEach((ss) => { map[ss.skill_id] = ss.calculated_level; });
    return map;
  }, [attempt]);

  const finalScoreMap = useMemo<Record<string, number>>(() => {
    if (!submission) return {};
    const entries = (officialEntries || []).filter(
      (oe) => oe.employee_id === submission.employee_id && oe.cycle === submission.cycle
    );
    const map: Record<string, number> = {};
    entries.forEach((oe) => { map[oe.skill_id] = oe.final_level; });
    return map;
  }, [officialEntries, submission]);

  const ratingMap: Record<string, RatingLevel> = {};
  submission?.ratings.forEach((r) => { ratingMap[r.skill_id] = r.rating; });

  if (!submission) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/skill-registry')} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Back to My Registry
        </Button>
        <div className="text-center py-16 text-sm text-muted-foreground">Submission not found.</div>
      </div>
    );
  }

  // ── Page header (consistent across draft & read-only) ──
  const pageTitle = isDraft && !isIncomplete ? `Self Review — ${submission.cycle}` : submission.cycle;
  const pageDescription = [
    assignedDomain?.name ?? 'Unknown domain',
    submission.submitted_at ? `Submitted ${new Date(submission.submitted_at).toLocaleDateString()}` : `Created ${new Date(submission.created_at).toLocaleDateString()}`,
  ].join(' · ');

  const header = (
    <div className="space-y-1">
      <Button variant="ghost" size="sm" onClick={() => navigate('/skill-registry')} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft size={14} /> Back to My Registry
      </Button>
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold text-foreground">{pageTitle}</h2>
        <Badge className={`text-xs ${statusColor(employeeStatus)}`}>{statusLabel(employeeStatus)}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{pageDescription}</p>
    </div>
  );

  // ── DRAFT / IN PROGRESS → Show Self Review Form ──
  if (isDraft) {
    return (
      <div className="space-y-6">
        {header}

        {/* Incomplete banner */}
        {isIncomplete && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Review cycle has closed</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your draft was not submitted in time. This submission is now locked and no assessment will be generated.</p>
            </div>
          </div>
        )}

        <SelfReviewForm
          domainSkills={domainSkills}
          filteredSkills={filteredSkills}
          groupedSkills={groupedSkills}
          ratings={ratings}
          comments={comments}
          previousRatings={previousRatings}
          isLocked={isIncomplete}
          submissionAllowed={submissionAllowed && !isIncomplete}
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

        {/* Confirm Dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Submission</DialogTitle>
              <DialogDescription>
                Once submitted, your skill ratings will be locked for this cycle ({submission.cycle}) and an assessment will be automatically generated.
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
              <Button variant="ghost" onClick={() => { setSuccessOpen(false); navigate('/skill-registry'); }} className="w-full gap-1.5">
                <Clock size={14} /> Later
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── SUBMITTED / LOCKED / COMPLETED → Read-only detail view ──
  const showGoToAssessment = ['submitted', 'assessment_pending'].includes(employeeStatus);

  return (
    <div className="space-y-6">
      {header}

      {/* Go to Assessment CTA */}
      {showGoToAssessment && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Assessment Generated</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your self-assessment has been submitted. Proceed to take your skill assessment.</p>
          </div>
          <Button onClick={() => navigate('/assessments')} className="gap-1.5 shrink-0">
            <ClipboardCheck size={14} /> Go to Assessment
          </Button>
        </div>
      )}

      {/* Score tiles with icons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ScoreCard
          label="Self Score (avg)"
          value={enriched?.selfAvg ?? null}
          icon={<BarChart3 size={20} className="text-primary" />}
        />
        <ScoreCard
          label="Assessment Score (avg)"
          value={enriched?.assessmentAvg ?? null}
          icon={<ClipboardCheck size={20} className="text-primary" />}
        />
        <ScoreCard
          label="Final Score (avg)"
          value={enriched?.finalAvg ?? null}
          icon={<Award size={20} className="text-primary" />}
        />
        <ScoreCard
          label="Manager"
          value={null}
          icon={<UserCheck size={20} className="text-primary" />}
        >
          {enriched?.reviewer ? (
            <div className="flex flex-col items-center gap-1.5">
              <ManagerAvatar reviewer={enriched.reviewer} />
              <span className="text-xs font-medium text-foreground">{enriched.reviewer.name}</span>
              {review?.overall_comment && (
                <p className="text-[10px] text-muted-foreground italic text-center line-clamp-2">"{review.overall_comment}"</p>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </ScoreCard>
      </div>

      {/* Skill table */}
      <RegistrySkillTable
        skills={skills}
        ratedSkillIds={submission.ratings.map((r) => r.skill_id)}
        ratingMap={ratingMap}
        assessmentScoreMap={assessmentScoreMap}
        finalScoreMap={finalScoreMap}
      />
    </div>
  );
}

// ── Self Review Form ──
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

        {domainSkills.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No skills mapped to this domain yet.</div>
        ) : groupedSkills.size === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No skills match your search.</div>
        ) : (
          <Accordion type="multiple" defaultValue={[]} className="space-y-3">
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

        {!isLocked && submissionAllowed && domainSkills.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{ratedCount}/{domainSkills.length} skills rated</p>
            <Button size="sm" onClick={onSubmit} disabled={!allRated} className="gap-1.5">
              <Send size={14} /> Submit & Generate Assessment
            </Button>
          </div>
        )}

        {isLocked && !submissionAllowed && (
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
