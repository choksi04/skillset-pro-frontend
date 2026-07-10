import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAssessmentStore, Assessment, assessmentStatusConfig } from "@/stores/assessmentStore";
import { useAttemptStore } from "@/stores/attemptStore";
import { useQuestionStore } from "@/stores/questionStore";
import { useSkillStore } from "@/stores/skillStore";
import { useDomainStore } from "@/stores/domainStore";
import { useReviewStore } from "@/stores/reviewStore";
import { useTemplateStore } from "@/stores/templateStore";
import { useCompetencyLevelStore, getLevelLabelByNumber, getFormattedLevelLabel } from "@/stores/competencyLevelStore";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ClipboardCheck,
  Search,
  ArrowRight,
  UserCheck,
  UserCog,
  HelpCircle,
  Clock,
  Layers,
  Filter as FilterIcon,
  Bell,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import AssignTemplateDialog from "@/components/templates/AssignTemplateDialog";
import SearchableSelect from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getEffectiveStatus, getAchievedLevelFromAttempt, getVerifiedLevelFromReviews } from "@/lib/assessmentStatus";
import { useAssignmentStore } from "@/stores/assignmentStore";
import { Textarea } from "@/components/ui/textarea";

const PAGE_SIZE = 10;

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "pending", label: "Not Started" },
  { key: "in_progress", label: "In Progress" },
  { key: "submitted", label: "Submitted" },
  { key: "evaluated", label: "Evaluated" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
];

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const COMPLETE_STATUSES = new Set(["submitted", "evaluated", "under_review", "approved"]);

export default function TeamAssessmentsPage() {
  const { assessments, fetchAssessments, loading, initialized } = useAssessmentStore();
  const { fetchAttempts, getAttemptForAssessment } = useAttemptStore();
  const { fetchQuestionCounts } = useQuestionStore();
  const { fetchSkills } = useSkillStore();
  const { fetchDomains, domains } = useDomainStore();
  const { fetchReviews, reviews, reassignReviewer } = useReviewStore();
  const { templates, fetchTemplates } = useTemplateStore();
  const { levels, fetchLevels } = useCompetencyLevelStore();
  const { currentRole, user } = useAuth();
  const navigate = useNavigate();
  const { revokeAssessment, fetchAssignments } = useAssignmentStore();

  const [revokeFor, setRevokeFor] = useState<{ assessmentId: string; employeeName: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);


  const [userMeta, setUserMeta] = useState<
    Record<string, { full_name: string; designation: string | null; domain_id: string | null }>
  >({});
  const [namesLoading, setNamesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [reminderPending, setReminderPending] = useState<Record<string, boolean>>({});
  const [reassignFor, setReassignFor] = useState<{ reviewId: string; employeeName: string } | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reviewerOptions, setReviewerOptions] = useState<{ value: string; label: string }[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<"all" | "adaptive" | "fixed">("all");
  const [verifFilter, setVerifFilter] = useState<"all" | "verified" | "unverified">("all");

  useEffect(() => {
    fetchAssessments();
    // Team-assessments list only needs question counts (from assessment_questions),
    // not the full ~7000-row question preload.
    fetchQuestionCounts();
    fetchSkills();
    fetchDomains();
    fetchAttempts();
    fetchReviews();
    fetchTemplates();
    fetchLevels();
    fetchAssignments();

  }, []);

  useEffect(() => {
    if (!initialized) return;
    const ids = [...new Set(assessments.map((a) => a.employee_id))];
    const missing = ids.filter((id) => !(id in userMeta));
    if (missing.length === 0) {
      setNamesLoading(false);
      return;
    }
    setNamesLoading(true);
    supabase
      .from("users")
      .select("id, full_name, designation, domain_id")
      .in("id", missing)
      .then(
        ({ data }) => {
          if (data) {
            setUserMeta((prev) => {
              const next = { ...prev };
              data.forEach((u: any) => {
                next[u.id] = {
                  full_name: u.full_name,
                  designation: u.designation ?? null,
                  domain_id: u.domain_id ?? null,
                };
              });
              return next;
            });
          }
          setNamesLoading(false);
        },
        () => setNamesLoading(false),
      );
  }, [assessments, initialized]);

  const getName = (id: string) => userMeta[id]?.full_name || "—";
  const getDesignation = (id: string) => userMeta[id]?.designation || null;
  const getAssessmentName = (a: Assessment) => {
    if (a.template_id) {
      const t = templates.find((x) => x.id === a.template_id);
      if (t?.name) return t.name;
    }
    return "Skill Registry Assessment";
  };
  const getDomainName = (a: Assessment) => {
    const d = domains.find((x) => x.id === a.domain_id);
    return d?.name ?? null;
  };

  // Domains the current manager leads
  const ledDomainIds = useMemo(() => {
    if (currentRole !== "manager" || !user) return new Set<string>();
    return new Set(domains.filter((d) => d.domain_lead_id === user.id).map((d) => d.id));
  }, [domains, currentRole, user]);
  const notDomainLead = currentRole === "manager" && ledDomainIds.size === 0;

  // Manager scope — only domains the manager leads
  const teamAssessments = useMemo(() => {
    if (currentRole === "admin") return assessments;
    if (currentRole === "manager") {
      if (ledDomainIds.size === 0) return [];
      return assessments.filter((a) => a.domain_id && ledDomainIds.has(a.domain_id));
    }
    return [];
  }, [assessments, currentRole, ledDomainIds]);

  // Per-assessment derived skill level + verification
  const computeRow = (a: Assessment) => {
    const attempt = getAttemptForAssessment(a.id);
    const assessmentReviews = reviews.filter((r) => r.assessment_id === a.id);
    const status = getEffectiveStatus(a, attempt, assessmentReviews);
    const verified = assessmentReviews.some((r) => r.status === "completed");

    let levelLabel = "N/A";
    let hasLevel = false;
    const achieved = getAchievedLevelFromAttempt(attempt);
    if (achieved.level != null && levels.length > 0) {
      levelLabel = getLevelLabelByNumber(levels, achieved.level);
      hasLevel = true;
    }
    return { attempt, assessmentReviews, status, verified, levelLabel, hasLevel, achieved };
  };

  // Filter
  const filteredTeam = useMemo(() => {
    let list = teamAssessments;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          getName(a.employee_id).toLowerCase().includes(q) ||
          getAssessmentName(a).toLowerCase().includes(q) ||
          (getDomainName(a) ?? "").toLowerCase().includes(q),
      );
    }
    if (formatFilter !== "all") {
      list = list.filter((a) => (formatFilter === "adaptive" ? a.is_adaptive : !a.is_adaptive));
    }
    if (statusFilter.length > 0 || verifFilter !== "all") {
      list = list.filter((a) => {
        const { status, verified } = computeRow(a);
        if (statusFilter.length > 0 && !statusFilter.includes(status)) return false;
        if (verifFilter === "verified" && !verified) return false;
        if (verifFilter === "unverified" && verified) return false;
        return true;
      });
    }
    return list;
  }, [teamAssessments, search, formatFilter, statusFilter, verifFilter, userMeta, templates, domains, reviews, levels]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, formatFilter, verifFilter]);

  const total = filteredTeam.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paged = filteredTeam.slice(pageStart, pageStart + PAGE_SIZE);

  const showLoadingRows = !initialized || namesLoading || teamAssessments.some((a) => !(a.employee_id in userMeta));

  const toggleStatus = (key: string) =>
    setStatusFilter((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  const clearFilters = () => {
    setStatusFilter([]);
    setFormatFilter("all");
    setVerifFilter("all");
  };
  const filterCount = statusFilter.length + (formatFilter !== "all" ? 1 : 0) + (verifFilter !== "all" ? 1 : 0);

  const sendReminder = async (a: Assessment) => {
    if (!user?.tenant_id) return;
    setReminderPending((p) => ({ ...p, [a.id]: true }));
    try {
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await supabase.from("notifications").insert({
        id: notifId,
        tenant_id: user.tenant_id,
        target_role: "employee",
        target_user_id: a.employee_id,
        message: `Reminder: please complete your assessment "${getAssessmentName(a)}".`,
        type: "assessment_reminder",
        reference_id: a.id,
        action_link: `/assessments/${a.id}`,
        read: false,
      });
      if (error) throw error;
      toast.success(`Reminder sent to ${getName(a.employee_id)}`);
    } catch (err: any) {
      toast.error(`Failed to send reminder: ${err?.message ?? "Unknown error"}`);
    } finally {
      setTimeout(() => setReminderPending((p) => ({ ...p, [a.id]: false })), 1500);
    }
  };

  const openReassign = async (reviewId: string, employeeName: string) => {
    if (!user?.tenant_id) return;
    setReassignFor({ reviewId, employeeName });
    setReassignTo("");
    if (reviewerOptions.length === 0) {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, role")
        .eq("tenant_id", user.tenant_id)
        .eq("status", "active")
        .in("role", ["admin", "manager"]);
      const opts = (data ?? []).map((u: any) => ({
        value: u.id,
        label: `${u.full_name} (${u.role})`,
      }));
      setReviewerOptions(opts);
    }
  };

  const confirmReassign = async () => {
    if (!reassignFor || !reassignTo) return;
    setReassignSaving(true);
    try {
      await reassignReviewer(reassignFor.reviewId, reassignTo);
      toast.success(`Reviewer updated for ${reassignFor.employeeName}`);
      setReassignFor(null);
    } catch (err: any) {
      toast.error(`Failed to reassign: ${err?.message ?? "Unknown error"}`);
    } finally {
      setReassignSaving(false);
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Team Assessments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track and review your team's ongoing and completed skill assessments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm w-72"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <FilterIcon size={14} />
                Filter
                {filterCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                    {filterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Status</p>
                  <div className="space-y-1.5">
                    {STATUS_FILTERS.map((s) => (
                      <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={statusFilter.includes(s.key)} onCheckedChange={() => toggleStatus(s.key)} />
                        <span className="text-foreground">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Format</p>
                  <RadioGroup value={formatFilter} onValueChange={(v) => setFormatFilter(v as any)}>
                    {[
                      { v: "all", l: "All" },
                      { v: "adaptive", l: "Adaptive" },
                      { v: "fixed", l: "Fixed" },
                    ].map((o) => (
                      <div key={o.v} className="flex items-center gap-2">
                        <RadioGroupItem value={o.v} id={`tfmt-${o.v}`} />
                        <Label htmlFor={`tfmt-${o.v}`} className="text-sm cursor-pointer">
                          {o.l}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Verification</p>
                  <RadioGroup value={verifFilter} onValueChange={(v) => setVerifFilter(v as any)}>
                    {[
                      { v: "all", l: "All" },
                      { v: "verified", l: "Verified" },
                      { v: "unverified", l: "Unverified" },
                    ].map((o) => (
                      <div key={o.v} className="flex items-center gap-2">
                        <RadioGroupItem value={o.v} id={`tver-${o.v}`} />
                        <Label htmlFor={`tver-${o.v}`} className="text-sm cursor-pointer">
                          {o.l}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                  <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
                    Clear
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setAssignOpen(true)}>
            <UserCheck size={14} /> Assign from Template
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Employee
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assessment Details
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Achieved Level
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Verified Level
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showLoadingRows ? (
              [1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div>
                        <Skeleton className="h-3 w-28 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-24 mb-2" />
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-24 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : paged.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-16">
                  <div className="flex flex-col items-center justify-center">
                    <ClipboardCheck size={32} className="text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      {notDomainLead
                        ? "You're not assigned as Domain Lead for any domain. Ask an admin to assign you."
                        : teamAssessments.length === 0
                          ? "No team assessments yet."
                          : "No assessments match the current filters."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paged.map((a) => {
                const { attempt, status, assessmentReviews } = computeRow(a);
                const config = assessmentStatusConfig[status] ?? assessmentStatusConfig.pending;
                const designation = getDesignation(a.employee_id);
                const domainName = getDomainName(a);
                const formatLabel = a.is_adaptive ? "Adaptive" : "Fixed";
                const questionCount = a.assessment_questions.length;
                const isCompleted = COMPLETE_STATUSES.has(status);

                let dateLine: string | null = null;
                if (status === "approved" || status === "evaluated") {
                  dateLine = `Completed: ${formatDate(a.updated_at)}`;
                } else if (status === "submitted" || status === "under_review") {
                  dateLine = `Submitted: ${formatDate(a.updated_at)}`;
                } else {
                  dateLine = `Created: ${formatDate(a.created_at)}`;
                }

                let actionEl: JSX.Element;
                if (status === "pending") {
                  actionEl = (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      disabled={!!reminderPending[a.id]}
                      onClick={(e) => {
                        e.stopPropagation();
                        sendReminder(a);
                      }}
                    >
                      <Bell size={13} />
                      {reminderPending[a.id] ? "Sending…" : "Send Reminder"}
                    </Button>
                  );
                } else if (status === "in_progress" || status === "submitted") {
                  actionEl = (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/team-assessments/${a.id}`);
                      }}
                    >
                      View Progress
                    </Button>
                  );
                } else if (status === "evaluated" || status === "under_review") {
                  actionEl = (
                    <Button
                      size="sm"
                      className="h-8 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/team-assessments/${a.id}`);
                      }}
                    >
                      Review <ArrowRight size={13} />
                    </Button>
                  );
                } else {
                  actionEl = (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/team-assessments/${a.id}`);
                      }}
                    >
                      View Results
                    </Button>
                  );
                }

                return (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/team-assessments/${a.id}`)}>
                    <TableCell className="align-top">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                            {getInitials(getName(a.employee_id))}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-card-foreground truncate">
                            {getName(a.employee_id)}
                          </div>
                          {/* <div className="text-xs text-muted-foreground truncate">{email || "—"}</div> */}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="text-sm font-medium text-card-foreground">{getAssessmentName(a)}</div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {domainName && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground text-[11px] px-1.5 py-0.5">
                            <Layers size={11} />
                            {domainName}
                          </span>
                        )}
                        {a.is_reassessment && (
                          <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                            Reassessment
                          </Badge>
                        )}

                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <HelpCircle size={12} />
                          <span className="text-foreground">{questionCount > 0 ? questionCount : "—"}</span>
                          <span>({formatLabel})</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock size={12} />
                          {a.duration_minutes} mins
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <Badge className={`text-xs border ${config.color}`}>{config.label}</Badge>
                      {dateLine && <div className="text-xs text-muted-foreground mt-1.5">{dateLine}</div>}
                    </TableCell>

                    <TableCell className="align-top">
                      {(() => {
                        if (!isCompleted) return <span className="text-sm text-muted-foreground">—</span>;
                        const { level } = getAchievedLevelFromAttempt(attempt);
                        if (level == null) return <span className="text-sm text-muted-foreground">—</span>;
                        return (
                          <Badge className="text-[11px] h-5 px-2 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                            {getFormattedLevelLabel(levels, level)}
                          </Badge>
                        );
                      })()}
                    </TableCell>

                    <TableCell className="align-top">
                      {(() => {
                        const { level } = getVerifiedLevelFromReviews(assessmentReviews, attempt?.id, attempt);
                        if (level == null) return <span className="text-sm text-muted-foreground">—</span>;
                        return (
                          <Badge className="text-[11px] h-5 px-2 bg-success/10 text-success border-success/20 hover:bg-success/15">
                            {getFormattedLevelLabel(levels, level)}
                          </Badge>
                        );
                      })()}
                    </TableCell>

                    <TableCell className="align-top text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {currentRole === "admin" &&
                          (() => {
                            const openReview = assessmentReviews.find(
                              (r) => r.status !== "completed",
                            );
                            if (!openReview) return null;
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-xs"
                                title="Change reviewer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReassign(openReview.id, getName(a.employee_id));
                                }}
                              >
                                <UserCog size={13} />
                                Reassign
                              </Button>
                            );
                          })()}
                        {actionEl}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!showLoadingRows && total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{pageStart + 1}</span> to{" "}
            <span className="font-medium text-foreground">{Math.min(pageStart + PAGE_SIZE, total)}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span> assessments
          </p>
          {pageCount > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    className={safePage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {Array.from({ length: pageCount }).map((_, i) => {
                  const n = i + 1;
                  return (
                    <PaginationItem key={n}>
                      <PaginationLink
                        href="#"
                        isActive={n === safePage}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(n);
                        }}
                      >
                        {n}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(pageCount, p + 1));
                    }}
                    className={safePage === pageCount ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      <AssignTemplateDialog open={assignOpen} onOpenChange={setAssignOpen} template={null} showTemplatePicker />

      <Dialog open={!!reassignFor} onOpenChange={(o) => !o && setReassignFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change reviewer</DialogTitle>
            <DialogDescription>
              Select a new reviewer for {reassignFor?.employeeName}'s assessment. The new
              reviewer will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <SearchableSelect
              options={reviewerOptions}
              value={reassignTo}
              onValueChange={setReassignTo}
              placeholder="Select reviewer..."
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignFor(null)} disabled={reassignSaving}>
              Cancel
            </Button>
            <Button onClick={confirmReassign} disabled={!reassignTo || reassignSaving}>
              {reassignSaving ? "Saving..." : "Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeFor} onOpenChange={(o) => { if (!o && !revoking) { setRevokeFor(null); setRevokeReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke assessment?</DialogTitle>
            <DialogDescription>
              This soft-deletes {revokeFor?.employeeName}'s assessment, its attempts, and the
              assignment record so the template can be assigned again. Answers stay in the
              database for audit but disappear from listings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-xs font-medium text-foreground">Reason <span className="text-destructive">*</span></label>
            <Textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Why is this assessment being revoked?"
              rows={3}
              disabled={revoking}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRevokeFor(null); setRevokeReason(""); }} disabled={revoking}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revoking || !revokeReason.trim()}
              onClick={async () => {
                if (!revokeFor) return;
                setRevoking(true);
                try {
                  await revokeAssessment(revokeFor.assessmentId, revokeReason.trim());
                  toast.success("Assessment revoked");
                  setRevokeFor(null);
                  setRevokeReason("");
                  await fetchAssessments({ force: true } as any);
                } catch (err: any) {
                  toast.error(err?.message || "Failed to revoke");
                } finally {
                  setRevoking(false);
                }
              }}
            >
              {revoking ? "Revoking…" : "Revoke Assessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
