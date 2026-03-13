import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRegistryStore, RatingLevel, SkillSelfRating, ratingLabels } from '@/stores/registryStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useQuestionStore } from '@/stores/questionStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import RatingSlider from '@/components/registry/RatingSlider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { CheckCircle, Lock, AlertTriangle, Send, Search, Info, FolderOpen, Tag, Users, User, ClipboardCheck, Clock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Employee self-rating view (used for both employee role and manager's "My Registry" tab)
function MyRegistryView() {
  const { user } = useAuth();
  const { submissions, assignments, currentCycle, getSubmission, createOrUpdateDraft, submitRegistry, markAssessmentGenerated, fetchRegistry } = useRegistryStore();
  const { addAssessment } = useAssessmentStore();
  const { domains, mappings } = useDomainStore();
  const { skills, categories } = useSkillStore();
  const { questions } = useQuestionStore();

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  // Use user's domain_id directly, fallback to employee_domain_assignments
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
  const [search, setSearch] = useState('');

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
    if (!allRated) {
      toast.error('Please rate all skills before submitting');
      return;
    }
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
    toast.success('Skill registry submitted! Assessment has been generated.');
  };

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

  const ratedCount = domainSkills.filter((s) => ratings[s.id] != null).length;

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-3xl">
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
              : `Rate your proficiency for each skill below (${domainSkills.length} skills). You can save as draft and return later.`
            }
          </p>
        </div>

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

        {domainSkills.length > 0 && (
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search skills by name or tag..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" maxLength={100} />
          </div>
        )}

        {domainSkills.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No skills are mapped to your domain yet. Please contact your domain lead.</div>
        ) : filteredSkills.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No skills match your search.</div>
        ) : (
          <Accordion type="multiple" defaultValue={Array.from(groupedSkills.keys())} className="space-y-3">
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
                          <RatingSlider value={ratings[skill.id] ?? null} onChange={(rating) => handleRatingChange(skill.id, rating)} disabled={isLocked} />
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {!isLocked && domainSkills.length > 0 && (
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
      </div>
    </TooltipProvider>
  );
}

// Team's Registry view for managers/admins
function TeamRegistryView() {
  const { user, currentRole } = useAuth();
  const { submissions } = useRegistryStore();
  const { domains } = useDomainStore();
  const { skills } = useSkillStore();
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // For managers, only show their domain's submissions
  const teamSubmissions = useMemo(() => {
    if (currentRole === 'admin') return submissions;
    // Manager sees only their domain
    const managerDomainId = user?.domain_id;
    if (!managerDomainId) return [];
    return submissions.filter((s) => s.domain_id === managerDomainId);
  }, [submissions, currentRole, user]);

  // Fetch employee names
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

  if (teamSubmissions.length === 0) {
    return <div className="text-center py-16 text-sm text-muted-foreground">No submissions from your team yet.</div>;
  }

  return (
    <div className="space-y-3">
      {teamSubmissions.map((sub) => {
        const domain = domains.find((d) => d.id === sub.domain_id);
        return (
          <div key={sub.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-card-foreground">{userNames[sub.employee_id] || sub.employee_id}</p>
                <p className="text-xs text-muted-foreground">{domain?.name ?? 'Unknown domain'} · Cycle: {sub.cycle}</p>
              </div>
              <Badge className={`text-xs ${
                sub.status === 'assessment_generated' ? 'bg-success/15 text-success border-success/20'
                  : sub.status === 'submitted' ? 'bg-primary/15 text-primary border-primary/20'
                  : 'bg-warning/15 text-warning border-warning/20'
              }`}>
                {sub.status === 'assessment_generated' ? 'Assessment Generated' : sub.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {sub.ratings.map((r) => {
                const skill = skills.find((s) => s.id === r.skill_id);
                return (
                  <div key={r.skill_id} className="rounded-md bg-muted px-2.5 py-1">
                    <span className="text-xs text-foreground">{skill?.skill_name ?? 'Unknown'}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">L{r.rating}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SkillRegistryPage() {
  const { currentRole } = useAuth();
  const { fetchRegistry } = useRegistryStore();
  const { fetchAssessments } = useAssessmentStore();
  const { fetchDomains } = useDomainStore();
  const { fetchSkills } = useSkillStore();
  const { fetchQuestions } = useQuestionStore();

  useEffect(() => {
    fetchAssessments(); fetchDomains(); fetchSkills(); fetchQuestions(); fetchRegistry();
  }, [fetchAssessments, fetchDomains, fetchSkills, fetchQuestions, fetchRegistry]);

  const isEmployee = currentRole === 'employee';

  // Employee only sees their own registry
  if (isEmployee) return <MyRegistryView />;

  // Manager/Admin sees tabs
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
