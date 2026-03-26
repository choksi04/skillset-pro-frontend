import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRegistryStore, RatingLevel, SkillSelfRating, ratingLabels } from '@/stores/registryStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { CheckCircle, Lock, AlertTriangle, Send, Search, Info, FolderOpen, Tag, Users, User, ClipboardCheck, Clock, Eye, ChevronRight, TrendingUp, Award, BarChart3, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ── Helpers ──
function computeCategoryStats(
  groupedSkills: Map<string, Skill[]>,
  ratings: Record<string, RatingLevel>
) {
  const stats: { name: string; avg: number; count: number; rated: number }[] = [];
  groupedSkills.forEach((catSkills, catName) => {
    const rated = catSkills.filter((s) => ratings[s.id] != null);
    const avg = rated.length > 0 ? rated.reduce((sum, s) => sum + (ratings[s.id] ?? 0), 0) / rated.length : 0;
    stats.push({ name: catName, avg: Math.round(avg * 10) / 10, count: catSkills.length, rated: rated.length });
  });
  return stats;
}

function computeOverallStats(
  domainSkills: Skill[],
  ratings: Record<string, RatingLevel>,
  categoryStats: { name: string; avg: number; count: number; rated: number }[]
) {
  const ratedSkills = domainSkills.filter((s) => ratings[s.id] != null);
  const totalAvg = ratedSkills.length > 0
    ? Math.round((ratedSkills.reduce((sum, s) => sum + (ratings[s.id] ?? 0), 0) / ratedSkills.length) * 10) / 10
    : 0;
  const topCategory = categoryStats.length > 0
    ? categoryStats.reduce((best, c) => (c.avg > best.avg ? c : best), categoryStats[0])
    : null;
  return { totalAvg, ratedCount: ratedSkills.length, totalCount: domainSkills.length, topCategory };
}

// ── Shared detailed skill view (used by both My and Team detail) ──
function SkillDetailView({
  domainSkills,
  ratings,
  groupedSkills,
  isLocked,
  onRatingChange,
  skills,
  search,
  onSearchChange,
}: {
  domainSkills: Skill[];
  ratings: Record<string, RatingLevel>;
  groupedSkills: Map<string, Skill[]>;
  isLocked: boolean;
  onRatingChange?: (skillId: string, rating: RatingLevel) => void;
  skills: Skill[];
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const categoryStats = computeCategoryStats(groupedSkills, ratings);
  const overall = computeOverallStats(domainSkills, ratings, categoryStats);

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Summary Stats */}
        {overall.ratedCount > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-primary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2"><BarChart3 size={18} className="text-primary" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Overall Avg</p>
                  <p className="text-xl font-bold text-foreground">L{overall.totalAvg}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2"><TrendingUp size={18} className="text-muted-foreground" /></div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Skills Rated</p>
                  <p className="text-xl font-bold text-foreground">{overall.ratedCount}/{overall.totalCount}</p>
                </div>
              </CardContent>
            </Card>
            {overall.topCategory && overall.topCategory.avg > 0 && (
              <Card className="col-span-2">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-success/10 p-2"><Award size={18} className="text-success" /></div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Strongest Category</p>
                    <p className="text-sm font-semibold text-foreground">{overall.topCategory.name} <span className="text-muted-foreground font-normal">(Avg L{overall.topCategory.avg})</span></p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Rating scale for draft mode */}
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

        {/* Search */}
        {domainSkills.length > 0 && (
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search skills by name or tag..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-8 h-9 text-sm" maxLength={100} />
          </div>
        )}

        {/* Category Accordions — collapsed by default when locked/submitted */}
        {domainSkills.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No skills mapped to this domain yet.</div>
        ) : groupedSkills.size === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No skills match your search.</div>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={isLocked ? [] : Array.from(groupedSkills.keys())}
            className="space-y-3"
          >
            {Array.from(groupedSkills.entries()).map(([catName, catSkills]) => {
              const catRatedCount = catSkills.filter((s) => ratings[s.id] != null).length;
              const allCatRated = catRatedCount === catSkills.length;
              const catRated = catSkills.filter((s) => ratings[s.id] != null);
              const catAvg = catRated.length > 0
                ? Math.round((catRated.reduce((sum, s) => sum + (ratings[s.id] ?? 0), 0) / catRated.length) * 10) / 10
                : 0;
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
                        {catAvg > 0 && (
                          <Badge variant="secondary" className="text-xs">Avg L{catAvg}</Badge>
                        )}
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
                            onChange={(rating) => onRatingChange?.(skill.id, rating)}
                            disabled={isLocked || !onRatingChange}
                          />
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </TooltipProvider>
  );
}

// ── Employee / "My Registry" view ──
function MyRegistryView() {
  const { user } = useAuth();
  const { submissions, assignments, currentCycle, getSubmission, createOrUpdateDraft, submitRegistry, markAssessmentGenerated, fetchRegistry, setCurrentCycle } = useRegistryStore();
  const { addAssessment } = useAssessmentStore();
  const { domains, mappings } = useDomainStore();
  const { skills, categories } = useSkillStore();
  const { questions } = useQuestionStore();
  const { activeCycle, isSubmissionAllowed, getDaysRemaining, fetchCycles } = useCycleStore();

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  // Sync current cycle from cycle store
  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  useEffect(() => {
    if (activeCycle) setCurrentCycle(activeCycle.name);
  }, [activeCycle, setCurrentCycle]);

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

  const submission = getSubmission(employeeId, currentCycle);
  const isLocked = submission?.status === 'submitted' || submission?.status === 'assessment_generated';

  const [ratings, setRatings] = useState<Record<string, RatingLevel>>(() => {
    if (submission?.ratings) {
      const map: Record<string, RatingLevel> = {};
      submission.ratings.forEach((r) => { map[r.skill_id] = r.rating; });
      return map;
    }
    return {};
  });

  useEffect(() => {
    if (submission?.ratings) {
      const map: Record<string, RatingLevel> = {};
      submission.ratings.forEach((r) => { map[r.skill_id] = r.rating; });
      setRatings(map);
    }
  }, [submission?.id]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const allRated = domainSkills.length > 0 && domainSkills.every((s) => ratings[s.id] != null);

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
    const map = new Map<string, typeof filteredSkills>();
    filteredSkills.forEach((s) => {
      const cat = s.skill_category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [filteredSkills]);

  const handleRatingChange = useCallback((skillId: string, rating: RatingLevel) => {
    if (isLocked) return;
    setRatings((prev) => ({ ...prev, [skillId]: rating }));
  }, [isLocked]);

  const handleSaveDraft = () => {
    if (!assignedDomain || isLocked) return;
    const ratingsList: SkillSelfRating[] = Object.entries(ratings).map(([skill_id, rating]) => ({ skill_id, rating }));
    createOrUpdateDraft(employeeId, tenantId, assignedDomain.id, ratingsList);
    toast.success('Draft saved successfully');
  };

  const handleSubmit = () => {
    if (!allRated) { toast.error('Please rate all skills before submitting'); return; }
    setConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    if (!assignedDomain) return;
    const ratingsList: SkillSelfRating[] = Object.entries(ratings).map(([skill_id, rating]) => ({ skill_id, rating }));
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

  if (!activeCycle) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Clock size={32} className="text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold text-foreground mb-1">No Active Review Cycle</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          There is no active review cycle at the moment. Please wait for your admin to start a cycle.
        </p>
      </div>
    );
  }

  if (!assignedDomain) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle size={32} className="text-warning mb-3" />
        <h2 className="text-lg font-semibold text-foreground mb-1">No Domain Assigned</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          You have not been assigned to a domain yet. Please contact your manager or admin to get assigned.
        </p>
      </div>
    );
  }

  const submissionAllowed = isSubmissionAllowed();
  const daysRemaining = getDaysRemaining();

  const ratedCount = domainSkills.filter((s) => ratings[s.id] != null).length;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Skill Self-Assessment</h2>
            <p className="text-sm text-muted-foreground">
              Domain: <span className="font-medium text-foreground">{assignedDomain.name}</span> · Cycle: <span className="font-medium text-foreground">{currentCycle}</span>
            </p>
          </div>
          {isLocked && (
            <Badge className="bg-success/15 text-success border-success/20 gap-1 text-xs">
              <Lock size={12} /> Submitted
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isLocked
            ? 'Your skill registry has been submitted and locked for this cycle. An assessment has been generated.'
            : !submissionAllowed
            ? 'The submission window for this cycle has ended.'
            : `Rate your proficiency for each skill below (${domainSkills.length} skills). You can save as draft and return later.`
          }
        </p>
        {daysRemaining !== null && !isLocked && submissionAllowed && (
          <p className={`text-xs font-medium mt-1 ${daysRemaining <= 3 ? 'text-destructive' : daysRemaining <= 7 ? 'text-warning' : 'text-muted-foreground'}`}>
            {daysRemaining > 0 ? `${daysRemaining} days remaining` : daysRemaining === 0 ? 'Ends today' : 'Grace period active'}
          </p>
        )}
      </div>

      {/* Detailed view with collapsed sections when submitted */}
      <SkillDetailView
        domainSkills={domainSkills}
        ratings={ratings}
        groupedSkills={groupedSkills}
        isLocked={isLocked}
        onRatingChange={isLocked ? undefined : handleRatingChange}
        skills={skills}
        search={search}
        onSearchChange={setSearch}
      />

      {/* Actions */}
      {!isLocked && submissionAllowed && domainSkills.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{ratedCount}/{domainSkills.length} skills rated</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveDraft}>Save Draft</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!allRated} className="gap-1.5"><Send size={14} /> Submit & Generate Assessment</Button>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="rounded-xl border border-success/20 bg-success/5 p-4 flex items-start gap-3">
          <CheckCircle size={18} className="text-success mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Submission Complete</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your self-assessment has been locked and an assessment has been automatically generated. Navigate to "Take Assessment" to complete your skill validation.</p>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Submission</DialogTitle>
            <DialogDescription>Once submitted, your skill ratings will be locked for this cycle ({currentCycle}) and an assessment will be automatically generated.</DialogDescription>
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
              Your skill registry has been submitted successfully and an assessment has been generated based on your self-ratings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={() => { setSuccessOpen(false); navigate('/assessments'); }} className="w-full gap-1.5">
              <ClipboardCheck size={14} /> Attempt Now
            </Button>
            <Button variant="outline" onClick={() => { setSuccessOpen(false); navigate('/assessments'); }} className="w-full gap-1.5">
              <Eye size={14} /> View Assessment
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

// ── Team member detail view (shown when clicking a team member) ──
function TeamMemberDetail({
  submission,
  employeeName,
  domainName,
  skills,
  mappings,
  onBack,
}: {
  submission: ReturnType<typeof useRegistryStore.getState>['submissions'][0];
  employeeName: string;
  domainName: string;
  skills: Skill[];
  mappings: { domain_id: string; skill_id: string }[];
  onBack: () => void;
}) {
  const [search, setSearch] = useState('');

  const domainSkillIds = useMemo(
    () => mappings.filter((m) => m.domain_id === submission.domain_id).map((m) => m.skill_id),
    [mappings, submission.domain_id]
  );

  const domainSkills = useMemo(
    () => skills.filter((s) => domainSkillIds.includes(s.id) && s.status === 'active'),
    [skills, domainSkillIds]
  );

  const ratings: Record<string, RatingLevel> = useMemo(() => {
    const map: Record<string, RatingLevel> = {};
    submission.ratings.forEach((r) => { map[r.skill_id] = r.rating; });
    return map;
  }, [submission.ratings]);

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

  return (
    <div className="space-y-5 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Back to Team
      </Button>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">{employeeName}</h2>
            <p className="text-sm text-muted-foreground">
              Domain: <span className="font-medium text-foreground">{domainName}</span> · Cycle: <span className="font-medium text-foreground">{submission.cycle}</span>
            </p>
          </div>
          <Badge className={`text-xs ${
            submission.status === 'assessment_generated' ? 'bg-success/15 text-success border-success/20'
              : submission.status === 'submitted' ? 'bg-primary/15 text-primary border-primary/20'
              : 'bg-warning/15 text-warning border-warning/20'
          }`}>
            {submission.status === 'assessment_generated' ? 'Submitted' : submission.status}
          </Badge>
        </div>
      </div>

      <SkillDetailView
        domainSkills={domainSkills}
        ratings={ratings}
        groupedSkills={groupedSkills}
        isLocked={true}
        skills={skills}
        search={search}
        onSearchChange={setSearch}
      />
    </div>
  );
}

// ── Team Registry Listing ──
function TeamRegistryView() {
  const { user, currentRole } = useAuth();
  const { submissions } = useRegistryStore();
  const { domains, mappings } = useDomainStore();
  const { skills } = useSkillStore();
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  const teamSubmissions = useMemo(() => {
    if (currentRole === 'admin') return submissions;
    const managerDomainId = user?.domain_id;
    if (!managerDomainId) return [];
    return submissions.filter((s) => s.domain_id === managerDomainId);
  }, [submissions, currentRole, user]);

  useEffect(() => {
    const employeeIds = [...new Set(teamSubmissions.map((s) => s.employee_id))];
    if (employeeIds.length === 0) return;
    supabase.from('users').select('id, full_name').in('id', employeeIds).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((u: any) => { map[u.id] = u.full_name; });
        setUserNames(map);
      }
    });
  }, [teamSubmissions]);

  const selectedSubmission = selectedSubmissionId
    ? teamSubmissions.find((s) => s.id === selectedSubmissionId) ?? null
    : null;

  if (selectedSubmission) {
    return (
      <TeamMemberDetail
        submission={selectedSubmission}
        employeeName={userNames[selectedSubmission.employee_id] || selectedSubmission.employee_id}
        domainName={domains.find((d) => d.id === selectedSubmission.domain_id)?.name ?? 'Unknown'}
        skills={skills}
        mappings={mappings}
        onBack={() => setSelectedSubmissionId(null)}
      />
    );
  }

  if (teamSubmissions.length === 0) {
    return <div className="text-center py-16 text-sm text-muted-foreground">No submissions from your team yet.</div>;
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {teamSubmissions.map((sub) => {
        const domain = domains.find((d) => d.id === sub.domain_id);
        const ratedSkills = sub.ratings;
        const avgRating = ratedSkills.length > 0
          ? Math.round((ratedSkills.reduce((sum, r) => sum + r.rating, 0) / ratedSkills.length) * 10) / 10
          : 0;

        return (
          <button
            key={sub.id}
            onClick={() => setSelectedSubmissionId(sub.id)}
            className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="rounded-full bg-muted p-2 shrink-0">
                  <User size={16} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">{userNames[sub.employee_id] || sub.employee_id}</p>
                  <p className="text-xs text-muted-foreground">{domain?.name ?? 'Unknown domain'} · Cycle: {sub.cycle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {avgRating > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Avg Rating</p>
                    <p className="text-sm font-semibold text-foreground">L{avgRating}</p>
                  </div>
                )}
                <Badge className={`text-xs ${
                  sub.status === 'assessment_generated' ? 'bg-success/15 text-success border-success/20'
                    : sub.status === 'submitted' ? 'bg-primary/15 text-primary border-primary/20'
                    : 'bg-warning/15 text-warning border-warning/20'
                }`}>
                  {sub.status === 'assessment_generated' ? 'Submitted' : sub.status}
                </Badge>
                <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Page Root ──
export default function SkillRegistryPage() {
  const { currentRole } = useAuth();
  const { fetchRegistry } = useRegistryStore();
  const { fetchAssessments } = useAssessmentStore();
  const { fetchDomains } = useDomainStore();
  const { fetchSkills } = useSkillStore();
  const { fetchQuestions } = useQuestionStore();
  const { fetchCycles } = useCycleStore();

  useEffect(() => {
    fetchAssessments(); fetchDomains(); fetchSkills(); fetchQuestions(); fetchRegistry(); fetchCycles();
  }, [fetchAssessments, fetchDomains, fetchSkills, fetchQuestions, fetchRegistry, fetchCycles]);

  const isEmployee = currentRole === 'employee';

  if (isEmployee) return <MyRegistryView />;

  return (
    <Tabs defaultValue="my" className="space-y-6">
      <TabsList>
        <TabsTrigger value="my" className="gap-1.5"><User size={14} /> My Registry</TabsTrigger>
        <TabsTrigger value="team" className="gap-1.5"><Users size={14} /> Team's Registry</TabsTrigger>
      </TabsList>
      <TabsContent value="my">
        <MyRegistryView />
      </TabsContent>
      <TabsContent value="team">
        <TeamRegistryView />
      </TabsContent>
    </Tabs>
  );
}
