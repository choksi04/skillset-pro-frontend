import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSkillRegistryStore, SkillRegistryItem } from '@/stores/skillRegistryStore';
import { useCompetencyLevelStore, getRatingLabels } from '@/stores/competencyLevelStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore, Skill } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { RatingLevel } from '@/stores/registryStore';
import RatingSlider from '@/components/registry/RatingSlider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle, Lock, Send, Search, Info, FolderOpen, Tag,
  ArrowLeft, Loader2, MessageSquare, Star, Pencil, ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function SkillRegistryDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { registries, fetchRegistries, fetchItems, saveDraft, submitRegistry, createNewVersion } = useSkillRegistryStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { levels: competencyLevels } = useCompetencyLevelStore();
  const maxLevel = competencyLevels.length || 5;

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  useEffect(() => {
    fetchRegistries(employeeId);
    fetchDomains();
    fetchSkills();
  }, []);

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

  const handleRatingChange = useCallback((skillId: string, rating: RatingLevel) => {
    if (!isDraft) return;
    setRatings((prev) => {
      const next = { ...prev, [skillId]: rating };
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
  const avgLevel = allItems.length > 0 ? Math.round((allItems.reduce((s, i) => s + i.self_score, 0) / allItems.length) * 10) / 10 : null;
  const maxScore = allItems.length > 0 ? Math.max(...allItems.map((i) => i.self_score)) : 0;
  const minScore = allItems.length > 0 ? Math.min(...allItems.map((i) => i.self_score)) : 0;
  const topRatedItems = allItems.filter((i) => i.self_score === maxScore);
  const lowestRatedItems = allItems.filter((i) => i.self_score === minScore);
  const topRatedSkillNames = topRatedItems.map((i) => skills.find((s) => s.id === i.skill_id)?.skill_name ?? i.skill_id);
  const lowestRatedSkillNames = lowestRatedItems.map((i) => skills.find((s) => s.id === i.skill_id)?.skill_name ?? i.skill_id);

  const SkillListBadge = ({ names, score }: { names: string[]; score: number }) => {
    if (names.length === 0) return <span className="text-muted-foreground">—</span>;
    const first = names[0];
    const rest = names.slice(1);
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-sm font-medium text-foreground">{first} (L{score})</span>
        {rest.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-[10px] cursor-help">+{rest.length}</Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-0.5">
                  {rest.map((n, i) => <p key={i} className="text-xs">{n}</p>)}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  const header = (
    <div className="space-y-1">
      <Button variant="ghost" size="sm" onClick={() => navigate('/skill-registry')} className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft size={14} /> Back to My Registry
      </Button>
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold text-foreground">Your Skillset Registry</h2>
        <Badge className={`text-xs ${isDraft ? 'bg-warning/15 text-warning border-warning/20' : 'bg-success/15 text-success border-success/20'}`}>
          {isDraft ? 'Draft' : 'Submitted'}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">v{registry.version_number} · {pageDescription}</p>
    </div>
  );

  const summarySection = isSubmitted && allItems.length > 0 ? (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Average Level</p>
          <p className="text-2xl font-bold text-foreground">{avgLevel}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Top Rated</p>
          <SkillListBadge names={topRatedSkillNames} score={maxScore} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Lowest Rated</p>
          <SkillListBadge names={lowestRatedSkillNames} score={minScore} />
        </CardContent>
      </Card>
    </div>
  ) : null;

  // ── DRAFT → Show Self Review Form ──
  if (isDraft) {
    return (
      <div className="space-y-6">
        {header}
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
          skills={skills}
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
      </div>
    );
  }

  // ── SUBMITTED → Read-only view ──
  return (
    <div className="space-y-6">
      {header}
      {summarySection}
      {/* Read-only skill list */}
      <div className="space-y-3">
        {groupedSkills.size === 0 && domainSkills.length > 0 && (
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search skills..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
        )}
        {domainSkills.length > 4 && (
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search skills..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
        )}
        <Accordion type="multiple" defaultValue={Array.from(groupedSkills.keys())} className="space-y-3">
          {Array.from(groupedSkills.entries()).map(([catName, catSkills]) => (
            <AccordionItem key={catName} value={catName} className="rounded-xl border border-border bg-card overflow-hidden">
              <AccordionTrigger className="px-5 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left flex-1">
                  <FolderOpen size={16} className="text-primary shrink-0" />
                  <span className="font-semibold text-card-foreground">{catName}</span>
                  <span className="text-xs text-muted-foreground">({catSkills.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <div className="divide-y divide-border">
                  {catSkills.map((skill) => (
                    <div key={skill.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{skill.skill_name}</p>
                        {comments[skill.id] && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">"{comments[skill.id]}"</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {ratings[skill.id] != null ? `L${ratings[skill.id]} — ${getRatingLabels(useCompetencyLevelStore.getState().levels)[ratings[skill.id]] ?? `Level ${ratings[skill.id]}`}` : '—'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

// ── Self Review Form ──
function SelfReviewForm({
  domainSkills, filteredSkills, groupedSkills, ratings, comments, previousRatings,
  ratedCount, allRated, search, saveStatus,
  onSearchChange, onRatingChange, onCommentChange, onSubmit, skills,
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
                              <Badge variant="secondary" className="text-xs ml-3 shrink-0">L{ratings[skill.id]} — {getRatingLabels(useCompetencyLevelStore.getState().levels)[ratings[skill.id]] ?? `Level ${ratings[skill.id]}`}</Badge>
                            )}
                          </div>
                          <RatingSlider
                            value={ratings[skill.id] ?? null}
                            onChange={(rating) => onRatingChange(skill.id, rating)}
                            disabled={false}
                            previousRating={previousRatings[skill.id]}
                          />
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
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {domainSkills.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{ratedCount}/{domainSkills.length} skills rated</p>
            <Button size="sm" onClick={onSubmit} disabled={!allRated} className="gap-1.5">
              <Send size={14} /> Submit Registry
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
