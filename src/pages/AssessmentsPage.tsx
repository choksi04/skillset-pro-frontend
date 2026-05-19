import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAssessmentStore, Assessment, assessmentStatusConfig } from "@/stores/assessmentStore";
import { useAttemptStore } from "@/stores/attemptStore";
import { useQuestionStore } from "@/stores/questionStore";
import { useSkillStore } from "@/stores/skillStore";
import { useDomainStore } from "@/stores/domainStore";
import { useReviewStore } from "@/stores/reviewStore";
import { useTemplateStore } from "@/stores/templateStore";
import { useAssignmentStore } from "@/stores/assignmentStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ClipboardCheck, Search, ArrowRight, HelpCircle, Clock, Layers,
  Filter as FilterIcon, Bot,
} from "lucide-react";
import { getEffectiveStatus, getAchievedLevelFromAttempt } from "@/lib/assessmentStatus";
import { useCompetencyLevelStore, getFormattedLevelLabel } from "@/stores/competencyLevelStore";

const PAGE_SIZE = 10;

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "pending", label: "Not Started" },
  { key: "in_progress", label: "In Progress" },
  { key: "submitted", label: "Submitted" },
  { key: "evaluated", label: "Evaluated" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
];

const ACTIVE_STATUSES = new Set(["pending", "in_progress"]);
const COMPLETE_STATUSES = new Set(["submitted", "evaluated", "under_review", "approved"]);

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function AssessmentsPage() {
  const { assessments, fetchAssessments, loading, initialized } = useAssessmentStore();
  const { fetchAttempts, getAttemptForAssessment } = useAttemptStore();
  const { fetchQuestions } = useQuestionStore();
  const { fetchSkills } = useSkillStore();
  const { fetchDomains, domains } = useDomainStore();
  const { fetchReviews, reviews } = useReviewStore();
  const { templates, fetchTemplates } = useTemplateStore();
  const { fetchAssignments, getAssignmentByAssessmentId } = useAssignmentStore();
  const { levels: competencyLevels, fetchLevels } = useCompetencyLevelStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [assignerNames, setAssignerNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<"all" | "adaptive" | "fixed">("all");

  useEffect(() => {
    fetchAssessments();
    fetchQuestions();
    fetchSkills();
    fetchDomains();
    fetchAttempts();
    fetchReviews();
    fetchTemplates();
    fetchAssignments();
    fetchLevels();
  }, []);

  const myAssessments = useMemo(
    () => assessments.filter((a) => a.employee_id === user?.id),
    [assessments, user],
  );

  // Resolve assigner full names
  useEffect(() => {
    const ids = new Set<string>();
    myAssessments.forEach((a) => {
      const asg = getAssignmentByAssessmentId(a.id);
      if (asg?.assigned_by) ids.add(asg.assigned_by);
    });
    const missing = [...ids].filter((id) => !(id in assignerNames));
    if (missing.length === 0) return;
    supabase.from("users").select("id, full_name").in("id", missing).then(({ data }) => {
      if (data) {
        setAssignerNames((prev) => {
          const next = { ...prev };
          data.forEach((u: any) => { next[u.id] = u.full_name; });
          return next;
        });
      }
    });
  }, [myAssessments]);

  const getAssessmentName = (a: Assessment) => {
    if (a.template_id) {
      const t = templates.find((x) => x.id === a.template_id);
      if (t?.name) return t.name;
    }
    return "Assessment";
  };
  const getDomainName = (a: Assessment) => {
    const d = domains.find((x) => x.id === a.domain_id);
    return d?.name ?? null;
  };

  // Filter + search
  const filteredMy = useMemo(() => {
    let list = myAssessments;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        getAssessmentName(a).toLowerCase().includes(q) ||
        (getDomainName(a) ?? "").toLowerCase().includes(q),
      );
    }
    if (formatFilter !== "all") {
      list = list.filter((a) => (formatFilter === "adaptive" ? a.is_adaptive : !a.is_adaptive));
    }
    if (statusFilter.length > 0) {
      list = list.filter((a) => {
        const attempt = getAttemptForAssessment(a.id);
        const aReviews = reviews.filter((r) => r.assessment_id === a.id);
        return statusFilter.includes(getEffectiveStatus(a, attempt, aReviews));
      });
    }
    return list;
  }, [myAssessments, search, formatFilter, statusFilter, templates, domains, reviews]);

  // Reset page on filter changes
  useEffect(() => { setPage(1); }, [search, formatFilter, statusFilter]);

  const total = filteredMy.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paged = filteredMy.slice(pageStart, pageStart + PAGE_SIZE);

  const showLoadingRows = loading && !initialized;

  const toggleStatus = (key: string) => {
    setStatusFilter((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };
  const clearFilters = () => {
    setStatusFilter([]);
    setFormatFilter("all");
  };
  const filterCount = statusFilter.length + (formatFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">My Assessments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            View and take your assigned skill assessments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assessments..."
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
                        <Checkbox
                          checked={statusFilter.includes(s.key)}
                          onCheckedChange={() => toggleStatus(s.key)}
                        />
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
                        <RadioGroupItem value={o.v} id={`fmt-${o.v}`} />
                        <Label htmlFor={`fmt-${o.v}`} className="text-sm cursor-pointer">{o.l}</Label>
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
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assessment Details
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Format
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assigned By
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status & Date
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
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-24 mb-2" />
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div>
                        <Skeleton className="h-3 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 mb-2 rounded-full" />
                    <Skeleton className="h-3 w-28" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-24 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : paged.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-16">
                  <div className="flex flex-col items-center justify-center">
                    <ClipboardCheck size={32} className="text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      {myAssessments.length === 0
                        ? "No assessments yet. Submit your skill registry to generate one."
                        : "No assessments match the current filters."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paged.map((a) => {
                const attempt = getAttemptForAssessment(a.id);
                const assessmentReviews = reviews.filter((r) => r.assessment_id === a.id);
                const status = getEffectiveStatus(a, attempt, assessmentReviews);
                const config = assessmentStatusConfig[status] ?? assessmentStatusConfig.pending;
                const assignment = getAssignmentByAssessmentId(a.id);
                const assignerName = assignment?.assigned_by
                  ? assignerNames[assignment.assigned_by] ?? null
                  : null;
                const isAuto = !assignment?.assigned_by;

                const domainName = getDomainName(a);
                const questionCount = a.assessment_questions.length;
                const formatLabel = a.is_adaptive ? "Adaptive" : "Fixed";

                const isCompleted = COMPLETE_STATUSES.has(status);
                const isActive = ACTIVE_STATUSES.has(status);

                let dateLine: string | null = null;
                if (status === "approved" || status === "evaluated") {
                  dateLine = `Completed: ${formatDate(a.updated_at)}`;
                } else if (status === "submitted" || status === "under_review") {
                  dateLine = `Submitted: ${formatDate(a.updated_at)}`;
                } else if (assignment?.assigned_at) {
                  dateLine = `Assigned: ${formatDate(assignment.assigned_at)}`;
                } else {
                  dateLine = `Created: ${formatDate(a.created_at)}`;
                }

                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/assessments/${a.id}`)}
                  >
                    <TableCell className="align-top">
                      <div className="font-medium text-sm text-card-foreground">
                        {getAssessmentName(a)}
                      </div>
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
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <HelpCircle size={13} />
                        <span className="text-foreground">
                          {questionCount > 0 ? questionCount : "—"}
                        </span>
                        <span className="text-muted-foreground">({formatLabel})</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock size={13} />
                        <span>{a.duration_minutes} mins</span>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-[11px] bg-muted text-muted-foreground">
                            {isAuto ? <Bot size={14} /> : getInitials(assignerName ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-card-foreground truncate">
                            {isAuto ? "System Auto-Assign" : (assignerName ?? "—")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isAuto ? "Automated" : "Manager"}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <Badge className={`text-xs border ${config.color}`}>{config.label}</Badge>
                      {dateLine && (
                        <div className="text-xs text-muted-foreground mt-1.5">{dateLine}</div>
                      )}
                      {isCompleted && (() => {
                        const { level, correct, total } = getAchievedLevelFromAttempt(attempt);
                        if (level == null) return null;
                        return (
                          <div className="mt-1.5 space-y-0.5">
                            <Badge className="text-[10px] h-5 px-2 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                              {getFormattedLevelLabel(competencyLevels, level)}
                            </Badge>
                            {total > 0 && (
                              <div className="text-[10px] text-muted-foreground">
                                {correct} / {total} correct
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>

                    <TableCell className="align-top text-right">
                      {isActive ? (
                        <Button
                          size="sm"
                          className="h-8 gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/assessments/${a.id}`);
                          }}
                        >
                          {status === "in_progress" ? "Resume" : "Start"}
                          <ArrowRight size={13} />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/assessments/${a.id}`);
                          }}
                        >
                          View Results
                        </Button>
                      )}
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
            <span className="font-medium text-foreground">
              {Math.min(pageStart + PAGE_SIZE, total)}
            </span>{" "}
            of <span className="font-medium text-foreground">{total}</span> assessments
          </p>
          {pageCount > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
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
                        onClick={(e) => { e.preventDefault(); setPage(n); }}
                      >
                        {n}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(pageCount, p + 1)); }}
                    className={safePage === pageCount ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  );
}
