import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSkillRegistryStore, SkillRegistryItem } from '@/stores/skillRegistryStore';
import { useCompetencyLevelStore, getRatingLabels } from '@/stores/competencyLevelStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore, Skill } from '@/stores/skillStore';
import { useRegistryReviewStore } from '@/stores/registryReviewStore';
import { useAuth } from '@/contexts/AuthContext';
import { RatingLevel } from '@/stores/registryStore';
import RatingSlider from '@/components/registry/RatingSlider';
import { Badge } from '@/components/ui/badge';
import { deriveRegistryStatus } from '@/lib/registryStatus';
import { RegistryStatusBadge } from '@/components/registry/RegistryStatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle, Lock, Send, Search, Info, Tag,
  ArrowLeft, Loader2, MessageSquare, Star, Pencil, ChevronDown, Trash2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function SkillRegistryDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { registries, fetchRegistries, fetchItems, saveDraft, submitRegistry, createNewVersion, discardDraft } = useSkillRegistryStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { levels: competencyLevels } = useCompetencyLevelStore();
  const { reviewStatuses, fetchReviewStatusesForRegistries } = useRegistryReviewStore();
  const maxLevel = competencyLevels.length || 5;

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  useEffect(() => {
    fetchRegistries(employeeId);
    fetchDomains();
    fetchSkills();
  }, []);

  // Fetch review status for this registry (cached in shared store)
  useEffect(() => {
    if (submissionId) fetchReviewStatusesForRegistries([submissionId]);
  }, [submissionId]);

  const registry = useMemo(
    () => registries.find((r) => r.id === submissionId),
    [registries, submissionId]
  );

  const isDraft = registry?.status === 'draft';
  const isSubmitted = registry?.status === 'submitted';

  // Domain
  const assignedDomain = useMemo(() => {
    if (!registry) return null;
    return domains.find((d) => d.id === registry.domain_id) ?? null;
  }, [registry, domains]);

  const domainSkillIds = useMemo(() => {
    if (!assignedDomain) return [];
    return mappings.filter((m) => m.domain_id === assignedDomain.id).map((m) => m.skill_id);
  }, [assignedDomain, mappings]);

  const domainSkills = useMemo(
    () => skills.filter((s) => domainSkillIds.includes(s.id) && s.status === 'active'),
    [skills, domainSkillIds]
  );

  // Load items for this registry
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [ratings, setRatings] = useState<Record<string, RatingLevel>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!submissionId) return;
    fetchItems(submissionId).then((items) => {
      const rMap: Record<string, RatingLevel> = {};
      const cMap: Record<string, string> = {};
      items.forEach((i) => {
        rMap[i.skill_id] = i.self_score as RatingLevel;
        if (i.comment) cMap[i.skill_id] = i.comment;
      });
      setRatings(rMap);
      setComments(cMap);
      setItemsLoaded(true);
    });
  }, [submissionId]);

  // Previous version ratings for reference
  const previousRatings = useMemo<Record<string, RatingLevel>>(() => {
    if (!registry) return {};
    const prevVersions = registries.filter(
      (r) => r.employee_id === employeeId && r.status === 'submitted' && r.version_number < registry.version_number
    );
    if (prevVersions.length === 0) return {};
    // Items for previous version may not be loaded — return empty
    const prevItems = useSkillRegistryStore.getState().items.get(prevVersions[0].id);
    if (!prevItems) return {};
    const map: Record<string, RatingLevel> = {};
    prevItems.forEach((i) => { map[i.skill_id] = i.self_score as RatingLevel; });
    return map;
  }, [registries, registry, employeeId]);

  // Auto-save
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isDirtyRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const triggerAutoSave = useCallback(() => {
    if (!isDraft || !submissionId) return;
    isDirtyRef.current = true;
    setSaveStatus('idle');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return;
      setSaveStatus('saving');
      const itemsList = Object.entries(ratings).map(([skill_id, self_score]) => ({
        skill_id,
        self_score,
        comment: comments[skill_id] || null,
      }));
      await saveDraft(submissionId, itemsList);
      isDirtyRef.current = false;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 2000);
  }, [isDraft, submissionId, ratings, comments, saveDraft]);

  const handleRatingChange = useCallback((skillId: string, rating: RatingLevel | null) => {
    if (!isDraft) return;
    setRatings((prev) => {
      const next = { ...prev };
      if (rating == null) {
        delete next[skillId];
      } else {
        next[skillId] = rating;
      }
      setTimeout(() => triggerAutoSave(), 0);
      return next;
    });
  }, [isDraft, triggerAutoSave]);

  const handleCommentChange = useCallback((skillId: string, comment: string) => {
    setComments((prev) => {
      const next = { ...prev, [skillId]: comment };
      setTimeout(() => triggerAutoSave(), 0);
      return next;
    });
  }, [triggerAutoSave]);

  // Form state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const handleSaveDraftNow = useCallback(async () => {
    if (!submissionId || !isDraft) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    const itemsList = Object.entries(ratings).map(([skill_id, self_score]) => ({
      skill_id,
      self_score,
      comment: comments[skill_id] || null,
    }));
    await saveDraft(submissionId, itemsList);
    isDirtyRef.current = false;
    setSaveStatus('saved');
    toast.success('Draft saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [submissionId, isDraft, ratings, comments, saveDraft]);

  const handleSubmit = () => {
    if (!allRated) { toast.error('Please rate all skills before submitting'); return; }
    setConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    if (!registry || !assignedDomain) return;
    setSubmitting(true);
    try {
      // Save final state
      const itemsList = Object.entries(ratings).map(([skill_id, self_score]) => ({
        skill_id,
        self_score,
        comment: comments[skill_id] || null,
      }));
      await saveDraft(registry.id, itemsList);

      // Get domain lead for notification
      const domainLeadId = assignedDomain.domain_lead_id ?? null;
      await submitRegistry(registry.id, user?.full_name ?? 'Employee', domainLeadId);

      setConfirmOpen(false);
      toast.success('Skill Registry submitted successfully!');
      navigate('/skill-registry');
    } catch (err) {
      console.error('Failed to submit:', err);
      toast.error('Failed to submit registry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDiscard = async () => {
    if (!registry) return;
    setDiscarding(true);
    try {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      isDirtyRef.current = false;
      await discardDraft(registry.id);
      setDiscardOpen(false);
      toast.success('Draft discarded');
      navigate('/skill-registry');
    } catch (err) {
      console.error('Failed to discard draft:', err);
      toast.error('Failed to discard draft. Please try again.');
    } finally {
      setDiscarding(false);
    }
  };

  if (!registry) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/skill-registry')} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Back to My Registry
        </Button>
        <div className="text-center py-16 text-sm text-muted-foreground">Registry not found.</div>
      </div>
    );
  }

  const formatDetailDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const pageDescription = [
    assignedDomain?.name ?? 'Unknown domain',
    registry.submitted_at ? `Submitted ${formatDetailDateTime(registry.submitted_at)}` : `Created ${formatDetailDateTime(registry.created_at)}`,
  ].join(' · ');

  // Summary stats
  const allItems = useSkillRegistryStore.getState().items.get(registry.id) ?? [];


  // Header used in DRAFT view
  const draftHeader = (
    <div className="space-y-1">
      <Button variant="ghost" size="sm" onClick={() => navigate('/skill-registry')} className="gap-1.5 -ml-2 text-primary hover:text-primary mb-1">
        <ArrowLeft size={14} /> Back to Registries
      </Button>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold text-foreground">{assignedDomain?.name ?? 'Your Skillset Registry'}</h1>
        <Badge className="text-xs bg-warning/15 text-warning border-warning/20 hover:bg-warning/15">Draft · v{registry.version_number}</Badge>
      </div>
      {assignedDomain?.description && (
        <p className="text-sm text-muted-foreground">{assignedDomain.description}</p>
      )}
    </div>
  );

  // ── DRAFT → Show Self Review Form ──
  if (isDraft) {
    return (
      <div className="space-y-6">
        {draftHeader}
        <SelfReviewForm
          domainSkills={domainSkills}
          filteredSkills={filteredSkills}
          groupedSkills={groupedSkills}
          ratings={ratings}
          comments={comments}
          previousRatings={previousRatings}
          ratedCount={ratedCount}
          allRated={allRated}
          search={search}
          saveStatus={saveStatus}
          onSearchChange={setSearch}
          onRatingChange={handleRatingChange}
          onCommentChange={handleCommentChange}
          onSubmit={handleSubmit}
          onSaveDraft={handleSaveDraftNow}
          onDiscard={() => setDiscardOpen(true)}
          skills={skills}
          maxLevel={maxLevel}
        />

        {/* Confirm Dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Submission</DialogTitle>
              <DialogDescription>
                Once submitted, your skill ratings for v{registry.version_number} will be locked. You can always create a new version later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 my-2 max-h-60 overflow-y-auto">
              {Object.entries(ratings).map(([skillId, rating]) => {
                const skill = skills.find((s) => s.id === skillId);
                return (
                  <div key={skillId} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5">
                    <span className="text-sm text-foreground">{skill?.skill_name}</span>
                    <span className="text-xs text-muted-foreground">Level {rating} — {getRatingLabels(useCompetencyLevelStore.getState().levels)[rating] ?? `Level ${rating}`}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={confirmSubmit} disabled={submitting} className="gap-1.5">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                {submitting ? 'Submitting...' : 'Confirm & Submit'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Discard Draft Confirmation */}
        <AlertDialog open={discardOpen} onOpenChange={(o) => !discarding && setDiscardOpen(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
              <AlertDialogDescription>
                Your unsaved changes for v{registry.version_number} will be permanently removed and cannot be restored. Your last submitted version will remain unchanged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={discarding}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); confirmDiscard(); }}
                disabled={discarding}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {discarding ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Trash2 size={14} className="mr-1.5" />}
                {discarding ? 'Discarding…' : 'Discard Draft'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── SUBMITTED → Read-only redesigned view ──

  // Submitted versions of this employee for this domain (for version switcher)
  const submittedVersions = registries
    .filter((r) => r.employee_id === employeeId && r.status === 'submitted' && r.domain_id === registry.domain_id)
    .sort((a, b) => b.version_number - a.version_number);
  const latestVersion = submittedVersions[0];
  const isLatest = latestVersion ? latestVersion.id === registry.id : true;

  // Stats
  const totalSkills = domainSkills.length;
  const ratedItems = allItems;
  const completionPct = totalSkills > 0 ? Math.round((ratedItems.length / totalSkills) * 100) : 0;
  const avgRaw = ratedItems.length > 0 ? ratedItems.reduce((s, i) => s + i.self_score, 0) / ratedItems.length : 0;
  const avgOnFive = maxLevel > 0 ? (avgRaw / maxLevel) * 5 : 0;

  // Top / lowest rated skills (by self_score)
  const maxScore = ratedItems.length > 0 ? Math.max(...ratedItems.map((i) => i.self_score)) : 0;
  const minScore = ratedItems.length > 0 ? Math.min(...ratedItems.map((i) => i.self_score)) : 0;
  const skillNameById = (id: string) => skills.find((s) => s.id === id)?.skill_name ?? 'Unknown';
  const topRatedNames = ratedItems.filter((i) => i.self_score === maxScore).map((i) => skillNameById(i.skill_id));
  const lowestRatedNames = ratedItems.filter((i) => i.self_score === minScore).map((i) => skillNameById(i.skill_id));

  // Skill rows — flat, sorted by category then skill name; only skills that have a rating in this version
  const skillRows = ratedItems
    .map((item) => {
      const skill = skills.find((s) => s.id === item.skill_id);
      return {
        id: item.skill_id,
        name: skill?.skill_name ?? 'Unknown skill',
        category: skill?.skill_category || 'Uncategorized',
        score: item.self_score,
        comment: item.comment ?? '',
        tags: skill?.tags ?? [],
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const handleEditRatings = async () => {
    if (!assignedDomain) return;
    // Look for an existing draft for this domain first
    const existingDraft = registries.find(
      (r) => r.employee_id === employeeId && r.status === 'draft' && r.domain_id === assignedDomain.id
    );
    if (existingDraft) {
      navigate(`/skill-registry/${existingDraft.id}`);
      return;
    }
    const draft = await createNewVersion(employeeId, tenantId, assignedDomain.id);
    if (draft) navigate(`/skill-registry/${draft.id}`);
  };

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/skill-registry')}
        className="gap-1.5 -ml-2 text-primary hover:text-primary"
      >
        <ArrowLeft size={14} /> Back to Registries
      </Button>

      {/* Title row + version switcher */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-foreground">{assignedDomain?.name ?? 'Domain'}</h1>
            <RegistryStatusBadge
              status={deriveRegistryStatus({
                registryStatus: registry.status as 'draft' | 'submitted',
                ratedCount: ratedItems.length,
                totalSkills,
                reviewStatus: reviewStatuses[registry.id] ?? null,
              })}
            />
            {!isLatest && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Version {registry.version_number}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {assignedDomain?.description || 'Submitted self-assessment for this domain.'}
          </p>
        </div>

        {submittedVersions.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Viewing:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 min-w-[180px] justify-between">
                  <span>
                    Version {registry.version_number}
                    {isLatest && ' (Latest)'}
                  </span>
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {submittedVersions.map((v, idx) => (
                  <DropdownMenuItem
                    key={v.id}
                    onClick={() => navigate(`/skill-registry/${v.id}`)}
                    className={v.id === registry.id ? 'bg-muted' : ''}
                  >
                    Version {v.version_number}
                    {idx === 0 && ' (Latest)'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Stats strip */}
      {!itemsLoaded ? (
        <div className="h-12 animate-pulse bg-muted/50 rounded" />
      ) : (
        <div className="flex flex-wrap items-start gap-x-12 gap-y-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total Skills</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{totalSkills}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Completion</p>
            <p className="mt-1 text-xl font-semibold text-primary">
              {completionPct}% <span className="text-sm font-medium text-primary/80">({ratedItems.length}/{totalSkills})</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Avg Rating</p>
            <p className="mt-1 text-xl font-semibold text-foreground flex items-center gap-1.5">
              <Star size={18} className="fill-amber-400 text-amber-400" />
              {ratedItems.length > 0 ? avgOnFive.toFixed(1) : '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Top Rated Skill</p>
            <div className="mt-1 text-sm font-semibold text-success flex items-center gap-1.5 flex-wrap">
              {ratedItems.length > 0 ? (
                <>
                  <span className="truncate">{topRatedNames[0]} (L{maxScore})</span>
                  {topRatedNames.length > 1 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-[10px] cursor-help">+{topRatedNames.length - 1}</Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-0.5">
                            {topRatedNames.slice(1).map((n, i) => <p key={i} className="text-xs">{n}</p>)}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground font-normal">—</span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Lowest Rated Skill</p>
            <div className="mt-1 text-sm font-semibold text-warning flex items-center gap-1.5 flex-wrap">
              {ratedItems.length > 0 ? (
                <>
                  <span className="truncate">{lowestRatedNames[0]} (L{minScore})</span>
                  {lowestRatedNames.length > 1 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-[10px] cursor-help">+{lowestRatedNames.length - 1}</Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-0.5">
                            {lowestRatedNames.slice(1).map((n, i) => <p key={i} className="text-xs">{n}</p>)}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground font-normal">—</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border" />

      {/* Skill Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Skill Breakdown</h2>
          {isLatest && (
            <Button variant="outline" size="sm" onClick={handleEditRatings} className="gap-1.5 text-primary border-primary/40 hover:bg-primary/5 hover:text-primary">
              <Pencil size={14} /> Edit Ratings
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <div className="col-span-4">Skill / Category</div>
            <div className="col-span-3">Rating</div>
            <div className="col-span-5">Self-Assessment Details</div>
          </div>

          {!itemsLoaded ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : skillRows.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No rated skills in this version.</div>
          ) : (
            <div className="divide-y divide-border">
              {skillRows.map((row) => {
                const onFive = maxLevel > 0 ? (row.score / maxLevel) * 5 : 0;
                const pct = maxLevel > 0 ? (row.score / maxLevel) * 100 : 0;
                return (
                  <div key={row.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center">
                    <div className="col-span-4">
                      <p className="text-sm font-medium text-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{row.category}</p>
                      {row.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {row.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5"
                            >
                              <Tag size={9} />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-span-3 space-y-1.5">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">{onFive.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground"> / 5.0</span>
                      </p>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                    <div className="col-span-5">
                      {row.comment ? (
                        <p className="text-sm text-muted-foreground leading-relaxed">{row.comment}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground/60 italic">No notes provided.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Self Review Form ──
function SelfReviewForm({
  domainSkills, filteredSkills, groupedSkills, ratings, comments, previousRatings,
  ratedCount, allRated, search, saveStatus,
  onSearchChange, onRatingChange, onCommentChange, onSubmit, onSaveDraft, onDiscard, skills, maxLevel,
}: {
  domainSkills: Skill[];
  filteredSkills: Skill[];
  groupedSkills: Map<string, Skill[]>;
  ratings: Record<string, RatingLevel>;
  comments: Record<string, string>;
  previousRatings: Record<string, RatingLevel>;
  ratedCount: number;
  allRated: boolean;
  search: string;
  saveStatus: 'idle' | 'saving' | 'saved';
  onSearchChange: (v: string) => void;
  onRatingChange: (skillId: string, rating: RatingLevel | null) => void;
  onCommentChange: (skillId: string, comment: string) => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
  skills: Skill[];
  maxLevel: number;
}) {
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);

  // Average across rated items, scaled to /5
  const ratedValues = Object.values(ratings);
  const avgRaw = ratedValues.length > 0 ? ratedValues.reduce((s, v) => s + v, 0) / ratedValues.length : 0;
  const avgOnFive = maxLevel > 0 ? (avgRaw / maxLevel) * 5 : 0;
  const completionPct = domainSkills.length > 0 ? Math.round((ratedCount / domainSkills.length) * 100) : 0;

  // Stars for /5 display
  const starFull = Math.floor(avgOnFive);
  const starHalf = avgOnFive - starFull >= 0.5;

  const scrollToCategory = (cat: string) => {
    const el = document.getElementById(`reg-cat-${cat}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
        {/* LEFT: Categories + skill cards */}
        <div className="space-y-8 min-w-0">
          {/* Search */}
          {domainSkills.length > 0 && (
            <div className="relative max-w-md">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search skills..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 h-9 text-sm"
                maxLength={100}
              />
            </div>
          )}

          {domainSkills.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">No skills mapped to this domain yet.</div>
          ) : groupedSkills.size === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">No skills match your search.</div>
          ) : (
            Array.from(groupedSkills.entries()).map(([catName, catSkills]) => (
              <section key={catName} id={`reg-cat-${catName}`} className="space-y-4 scroll-mt-6">
                {/* Category header */}
                <div className="space-y-1 border-b border-border pb-2">
                  <h3 className="text-base font-semibold text-foreground">{catName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {catSkills.length} skill{catSkills.length !== 1 ? 's' : ''} in this category.
                  </p>
                </div>

                {/* Skill cards */}
                <div className="space-y-4">
                  {catSkills.map((skill) => {
                    const isActive = activeSkillId === skill.id;
                    const isRated = ratings[skill.id] != null;
                    return (
                      <div
                        key={skill.id}
                        onClick={() => setActiveSkillId(skill.id)}
                        className={`rounded-xl border bg-card p-5 space-y-4 transition-all ${
                          isActive ? 'ring-1 ring-primary/40 border-primary/40' : 'border-border hover:border-primary/20'
                        }`}
                      >
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">{skill.skill_name}</p>
                              {skill.skill_description && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info size={13} className="text-muted-foreground cursor-help shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">{skill.skill_description}</TooltipContent>
                                </Tooltip>
                              )}
                              {isRated && (
                                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Rated</Badge>
                              )}
                            </div>
                            {(skill.tags || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {skill.tags.map((tag) => (
                                  <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                                    <Tag size={9} />{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Assess your current proficiency. Click a level again to clear it.
                            </p>
                          </div>
                        </div>

                        {/* Proficiency Level */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-foreground">Proficiency Level</p>
                          <RatingSlider
                            value={ratings[skill.id] ?? null}
                            onChange={(rating) => onRatingChange(skill.id, rating)}
                            disabled={false}
                            previousRating={previousRatings[skill.id]}
                            variant="card"
                            allowUnselect
                          />
                        </div>

                        {/* Supporting Details (collapsible) */}
                        <Collapsible defaultOpen={!!comments[skill.id]}>
                          <div className="flex items-center justify-between">
                            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors">
                              <MessageSquare size={12} />
                              Supporting Details
                            </CollapsibleTrigger>
                            <span className="text-[10px] text-muted-foreground">Optional, but recommended</span>
                          </div>
                          <CollapsibleContent className="mt-2">
                            <Textarea
                              placeholder="Add context, recent projects, or examples to support your rating..."
                              value={comments[skill.id] || ''}
                              onChange={(e) => onCommentChange(skill.id, e.target.value)}
                              onFocus={() => setActiveSkillId(skill.id)}
                              className="text-xs min-h-[70px]"
                              maxLength={500}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {/* RIGHT: Registry Summary (sticky) */}
        <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Registry Summary</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Your progress at a glance</p>
            </div>

            {/* Current Average */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Current Average</p>
              <p className="text-3xl font-semibold text-foreground leading-none">
                {ratedCount > 0 ? avgOnFive.toFixed(1) : '—'}
                <span className="text-sm font-normal text-muted-foreground"> / 5.0</span>
              </p>
              <div className="flex items-center justify-center gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => {
                  if (i < starFull) return <Star key={i} size={14} className="fill-amber-400 text-amber-400" />;
                  if (i === starFull && starHalf) return (
                    <span key={i} className="relative inline-block w-[14px] h-[14px]">
                      <Star size={14} className="absolute inset-0 text-amber-400" />
                      <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                        <Star size={14} className="fill-amber-400 text-amber-400" />
                      </span>
                    </span>
                  );
                  return <Star key={i} size={14} className="text-muted-foreground/40" />;
                })}
              </div>
            </div>

            {/* Completion */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-foreground">Completion</p>
                <p className="text-[11px] font-semibold text-primary">{completionPct}%</p>
              </div>
              <Progress value={completionPct} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">{ratedCount} of {domainSkills.length} skills rated</p>
            </div>

            {/* Categories */}
            {groupedSkills.size > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-foreground">Categories</p>
                <div className="space-y-1">
                  {Array.from(groupedSkills.entries()).map(([catName, catSkills]) => {
                    const rated = catSkills.filter((s) => ratings[s.id] != null).length;
                    const done = rated === catSkills.length;
                    return (
                      <button
                        key={catName}
                        onClick={() => scrollToCategory(catName)}
                        className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="flex items-center gap-1.5 min-w-0 flex-1">
                          {done ? (
                            <CheckCircle size={12} className="text-success shrink-0" />
                          ) : (
                            <span className="w-3 h-3 rounded-full border border-muted-foreground/40 shrink-0" />
                          )}
                          <span className="truncate text-foreground">{catName}</span>
                        </span>
                        <span className={`text-[10px] font-medium shrink-0 ${done ? 'text-success' : 'text-muted-foreground'}`}>
                          {rated}/{catSkills.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save status */}
            <div className="min-h-[16px] text-[11px]">
              {saveStatus === 'saving' && (
                <span className="text-muted-foreground flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Saving…</span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-success flex items-center gap-1"><CheckCircle size={11} /> All changes saved</span>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <Button size="sm" onClick={onSubmit} disabled={!allRated} className="w-full gap-1.5">
                <Send size={14} /> Submit Registry
              </Button>
              <Button size="sm" variant="outline" onClick={onSaveDraft} className="w-full">
                Save as Draft
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDiscard}
                className="w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={14} /> Discard Draft
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
