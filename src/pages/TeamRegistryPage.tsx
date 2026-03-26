import { useState, useMemo, useEffect } from 'react';
import { useRegistryStore, RatingLevel, ratingLabels } from '@/stores/registryStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore, Skill } from '@/stores/skillStore';
import { useCycleStore } from '@/stores/cycleStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import RatingSlider from '@/components/registry/RatingSlider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  User, ChevronRight, ArrowLeft, Search, Info, FolderOpen, Tag,
  CheckCircle, BarChart3, TrendingUp, Award, Users,
} from 'lucide-react';

// ── Team Member Detail ──
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

  const ratedSkills = domainSkills.filter((s) => ratings[s.id] != null);
  const totalAvg = ratedSkills.length > 0
    ? Math.round((ratedSkills.reduce((sum, s) => sum + (ratings[s.id] ?? 0), 0) / ratedSkills.length) * 10) / 10
    : 0;

  return (
    <div className="space-y-5">
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

      {/* Stats */}
      {totalAvg > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><BarChart3 size={18} className="text-primary" /></div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Overall Avg</p>
                <p className="text-xl font-bold text-foreground">L{totalAvg}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2"><TrendingUp size={18} className="text-muted-foreground" /></div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Skills Rated</p>
                <p className="text-xl font-bold text-foreground">{ratedSkills.length}/{domainSkills.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      {domainSkills.length > 0 && (
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search skills..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" maxLength={100} />
        </div>
      )}

      {/* Category Accordions */}
      <TooltipProvider>
        {groupedSkills.size === 0 ? (
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
                          <RatingSlider value={ratings[skill.id] ?? null} onChange={() => {}} disabled />
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </TooltipProvider>
    </div>
  );
}

// ── Team Registry Page ──
export default function TeamRegistryPage() {
  const { user, currentRole } = useAuth();
  const { submissions, fetchRegistry } = useRegistryStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { fetchCycles } = useCycleStore();
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  useEffect(() => {
    fetchRegistry(); fetchDomains(); fetchSkills(); fetchCycles();
  }, []);

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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Team Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">Monitor your team's skill self-assessments.</p>
        </div>
        <TeamMemberDetail
          submission={selectedSubmission}
          employeeName={userNames[selectedSubmission.employee_id] || selectedSubmission.employee_id}
          domainName={domains.find((d) => d.id === selectedSubmission.domain_id)?.name ?? 'Unknown'}
          skills={skills}
          mappings={mappings}
          onBack={() => setSelectedSubmissionId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Team Registry</h2>
        <p className="text-sm text-muted-foreground mt-1">Monitor your team's skill self-assessments.</p>
      </div>

      {teamSubmissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Users size={32} className="text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Submissions Yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            No team members have submitted their skill registries yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {teamSubmissions.map((sub) => {
            const domain = domains.find((d) => d.id === sub.domain_id);
            const avgRating = sub.ratings.length > 0
              ? Math.round((sub.ratings.reduce((sum, r) => sum + r.rating, 0) / sub.ratings.length) * 10) / 10
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
      )}
    </div>
  );
}
