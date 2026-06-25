import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSkillRegistryStore } from "@/stores/skillRegistryStore";
import { useCompetencyLevelStore } from "@/stores/competencyLevelStore";
import { useDomainStore } from "@/stores/domainStore";
import { useSkillStore } from "@/stores/skillStore";
import { useRegistryReviewStore } from "@/stores/registryReviewStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { RatingLevel } from "@/stores/registryStore";
import { Badge } from "@/components/ui/badge";
import { RegistryStatusBadge } from "@/components/registry/RegistryStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/ui/searchable-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle2, Star, User as UserIcon, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

export default function TeamRegistryDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { registries, fetchRegistries, fetchItems } = useSkillRegistryStore();
  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { levels, fetchLevels } = useCompetencyLevelStore();
  const { reviews, ensureReview, fetchReviewForRegistry, setItemScore, setItemComment, approveReview } =
    useRegistryReviewStore();

  useEffect(() => {
    fetchRegistries();
    fetchDomains();
    fetchSkills();
    fetchLevels();
  }, []);

  const registry = useMemo(() => registries.find((r) => r.id === submissionId), [registries, submissionId]);

  const [employee, setEmployee] = useState<{ full_name: string; designation: string } | null>(null);
  const [ratings, setRatings] = useState<Record<string, RatingLevel>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [managerComments, setManagerComments] = useState<Record<string, string>>({});
  const commentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Fetch employee meta
  useEffect(() => {
    if (!registry) return;
    supabase
      .from("users")
      .select("full_name, designation")
      .eq("id", registry.employee_id)
      .single()
      .then(({ data }) => {
        if (data) {
          setEmployee({
            full_name: (data as any).full_name,
            designation: (data as any).designation || "",
          });
        }
      });
  }, [registry?.employee_id]);

  // Fetch employee items + the manager review
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
    });
    fetchReviewForRegistry(submissionId);
  }, [submissionId]);

  // Sync local manager comments with store
  const review = submissionId ? reviews.get(submissionId) : undefined;
  useEffect(() => {
    if (!review) return;
    const map: Record<string, string> = {};
    review.items.forEach((i) => {
      if (i.manager_comment) map[i.skill_id] = i.manager_comment;
    });
    setManagerComments(map);
  }, [review?.id]);

  const domain = useMemo(
    () => (registry ? domains.find((d) => d.id === registry.domain_id) : null),
    [registry, domains],
  );

  const domainSkillIds = useMemo(() => {
    if (!domain) return [];
    return mappings.filter((m) => m.domain_id === domain.id).map((m) => m.skill_id);
  }, [domain, mappings]);

  const domainSkills = useMemo(
    () => skills.filter((s) => domainSkillIds.includes(s.id) && s.status === "active"),
    [skills, domainSkillIds],
  );

  const groupedSkills = useMemo(() => {
    const map = new Map<string, typeof domainSkills>();
    domainSkills.forEach((s) => {
      const cat = s.skill_category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [domainSkills]);

  // ─── Stats ──────────────────────────────────────────────────────────────
  const maxLevel = useMemo(() => {
    const active = levels.filter((l) => l.status === "active");
    return active.length > 0 ? Math.max(...active.map((l) => l.level)) : 5;
  }, [levels]);

  const ratedSkillIds = Object.keys(ratings);
  const totalSkills = domainSkills.length;
  const ratedCount = ratedSkillIds.filter((id) => domainSkillIds.includes(id)).length;
  const completionPct = totalSkills > 0 ? Math.round((ratedCount / totalSkills) * 100) : 0;

  const employeeAvgRaw =
    ratedCount > 0 ? ratedSkillIds.reduce((s, id) => s + Number(ratings[id] || 0), 0) / ratedCount : 0;
  const employeeAvg5 = maxLevel > 0 ? (employeeAvgRaw / maxLevel) * 5 : 0;

  const managerScoresMap = useMemo(() => {
    const m: Record<string, number> = {};
    review?.items.forEach((i) => {
      if (typeof i.manager_score === "number") m[i.skill_id] = i.manager_score;
    });
    return m;
  }, [review]);
  const managerScored = Object.values(managerScoresMap);
  const managerAvgRaw =
    managerScored.length > 0 ? managerScored.reduce((s, v) => s + v, 0) / managerScored.length : employeeAvgRaw;
  const managerAvg5 = maxLevel > 0 ? (managerAvgRaw / maxLevel) * 5 : 0;

  // Top / lowest skill (by employee score)
  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const ratedEntries = ratedSkillIds.map((id) => ({ id, score: Number(ratings[id]) }));
  const topEntry = ratedEntries.length > 0 ? ratedEntries.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  const lowEntry = ratedEntries.length > 0 ? ratedEntries.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  const topName = topEntry ? (skillById.get(topEntry.id)?.skill_name ?? "—") : "—";
  const lowName = lowEntry ? (skillById.get(lowEntry.id)?.skill_name ?? "—") : "—";

  const isApproved = review?.status === "approved";
  const isReviewable = registry?.status === "submitted" && !isApproved;

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleScoreChange = useCallback(
    async (skillId: string, value: string) => {
      if (!submissionId || !registry) return;
      await ensureReview(submissionId, user?.id ?? "", user?.tenant_id ?? "tenant-001");
      await setItemScore(submissionId, skillId, Number(value));
    },
    [submissionId, registry, user, ensureReview, setItemScore],
  );

  const handleCommentChange = useCallback(
    (skillId: string, value: string) => {
      setManagerComments((m) => ({ ...m, [skillId]: value }));
      if (!submissionId) return;
      if (commentTimers.current[skillId]) clearTimeout(commentTimers.current[skillId]);
      commentTimers.current[skillId] = setTimeout(async () => {
        await ensureReview(submissionId, user?.id ?? "", user?.tenant_id ?? "tenant-001");
        await setItemComment(submissionId, skillId, value);
      }, 600);
    },
    [submissionId, user, ensureReview, setItemComment],
  );

  const handleApprove = async () => {
    if (!submissionId || !registry) return;
    await ensureReview(submissionId, user?.id ?? "", user?.tenant_id ?? "tenant-001");
    // Flush any pending comment timers
    Object.values(commentTimers.current).forEach((t) => clearTimeout(t));
    for (const skillId of Object.keys(managerComments)) {
      await setItemComment(submissionId, skillId, managerComments[skillId]);
    }
    await approveReview(submissionId, registry.employee_id, registry.tenant_id);
    toast.success("Registry approved and finalized.");
    navigate("/team-registry");
  };

  if (!registry) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/team-registry")}
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to Team Registries
        </Button>
        <div className="text-center py-16 text-sm text-muted-foreground">Registry not found.</div>
      </div>
    );
  }

  const initials = (employee?.full_name || registry.employee_id)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Score select options
  const scoreOptions = useMemo(
    () => levels.filter((l) => l.status === "active").sort((a, b) => a.level - b.level),
    [levels],
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/team-registry")}
        className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to Team Registries
      </Button>

      {/* Header band */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
              {initials || <UserIcon size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{employee?.full_name || registry.employee_id}</h2>
                <RegistryStatusBadge status={isApproved ? 'approved' : 'review_pending'} size="sm" />
              </div>
              <p className="text-xs text-muted-foreground">
                {employee?.designation || "—"}
                {" · "}
                {domain?.name || "Unknown domain"} Registry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Request Changes — TODO: implement in a future iteration. Hidden for now. */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="gap-1.5" disabled={!isReviewable}>
                  <CheckCircle2 size={14} />
                  {isApproved ? "Approved" : "Approve & Finalize"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Finalize this registry review?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your scores and notes will be saved as the manager-validated record. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApprove}>Approve &amp; Finalize</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-3 border-t border-border">
          <Stat label="Total Skills" value={totalSkills.toString()} />
          <Stat label="Completion" value={`${completionPct}% (${ratedCount}/${totalSkills})`} />
          <Stat
            label="Employee Avg"
            value={ratedCount > 0 ? employeeAvg5.toFixed(1) : "—"}
            icon={<Star size={13} className="fill-warning text-warning" />}
          />
          <Stat
            label="Manager Avg (Draft)"
            value={ratedCount > 0 ? managerAvg5.toFixed(1) : "—"}
            icon={<Star size={13} className="fill-primary text-primary" />}
            muted={managerScored.length === 0}
          />
          <Stat
            label="Top Rated Skill"
            value={topEntry ? `${topName} (L${topEntry.score})` : "—"}
            valueClass="text-success"
          />
          <Stat
            label="Lowest Rated Skill"
            value={lowEntry ? `${lowName} (L${lowEntry.score})` : "—"}
            valueClass="text-warning"
          />
        </div>
      </div>

      {/* Section header */}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Skill Review Breakdown</h3>
        <p className="text-xs text-muted-foreground">Compare employee self-assessments with your evaluation.</p>
      </div>

      {/* Per-skill cards, grouped by category */}
      <div className="space-y-5">
        {Array.from(groupedSkills.entries()).map(([catName, catSkills]) => (
          <div key={catName} className="space-y-3">
            {catSkills.map((skill) => {
              const empScore = ratings[skill.id] != null ? Number(ratings[skill.id]) : null;
              const empScore5 = empScore != null && maxLevel > 0 ? (empScore / maxLevel) * 5 : null;
              const empPct = empScore != null && maxLevel > 0 ? (empScore / maxLevel) * 100 : 0;
              const mgrScore = managerScoresMap[skill.id] ?? null;
              const mgrScore5 = mgrScore != null && maxLevel > 0 ? (mgrScore / maxLevel) * 5 : null;
              const mgrComment = managerComments[skill.id] ?? "";

              return (
                <div key={skill.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 pt-4 pb-3">
                    <p className="text-sm font-semibold text-card-foreground">{skill.skill_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{catName}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 border-t border-border">
                    {/* Employee Assessment */}
                    <div className="p-5 bg-muted/30 md:border-r border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <UserIcon size={13} /> Self Rated
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {empScore5 != null ? (
                            <>
                              {empScore5.toFixed(1)}{" "}
                              <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </p>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, empPct))}%` }}
                        />
                      </div>
                      {comments[skill.id] && (
                        <p className="text-xs italic text-muted-foreground leading-relaxed">"{comments[skill.id]}"</p>
                      )}
                    </div>

                    {/* Manager Review */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-primary">
                          <ClipboardCheck size={13} /> Manager Review
                        </div>
                        {isApproved ? (
                          <p className="text-sm font-semibold text-foreground">
                            {mgrScore5 != null ? (
                              <>
                                {mgrScore5.toFixed(1)}{" "}
                                <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-xs">Not rated</span>
                            )}
                          </p>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Score:</span>
                            <Select
                              value={mgrScore != null ? String(mgrScore) : ""}
                              onValueChange={(v) => handleScoreChange(skill.id, v)}
                              disabled={!isReviewable}
                            >
                              <SelectTrigger className="h-8 min-w-[14rem] text-xs">
                                <SelectValue placeholder="Select level">
                                  {mgrScore != null
                                    ? (scoreOptions.find((l) => l.level === mgrScore)?.label ??
                                      `L${mgrScore}`)
                                    : null}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {scoreOptions.map((l) => {
                                  const showName =
                                    !!l.name &&
                                    !l.label?.toLowerCase().includes(l.name.toLowerCase());
                                  return (
                                    <SelectItem key={l.id} value={String(l.level)}>
                                      <span className="font-medium">{l.label}</span>
                                      {showName ? (
                                        <span className="text-muted-foreground"> ({l.name})</span>
                                      ) : null}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      {isApproved ? (
                        mgrComment ? (
                          <p className="text-xs italic text-muted-foreground leading-relaxed">"{mgrComment}"</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">No notes added.</p>
                        )
                      ) : (
                        <Input
                          value={mgrComment}
                          onChange={(e) => handleCommentChange(skill.id, e.target.value)}
                          placeholder="+ Add notes"
                          disabled={!isReviewable}
                          className="h-9 text-xs"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {domainSkills.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">No skills mapped to this domain.</div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  valueClass = "",
  muted = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClass?: string;
  muted?: boolean;
}) {
  return (
    <div className="space-y-1 min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <div
        className={`flex items-center gap-1.5 text-sm font-semibold truncate ${muted ? "text-muted-foreground" : "text-foreground"} ${valueClass}`}
      >
        {icon}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
