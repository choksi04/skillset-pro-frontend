import { useState, useEffect, useMemo } from "react";
import { useCycleStore, ReviewCycle } from "@/stores/cycleStore";
import { useDomainStore } from "@/stores/domainStore";
import { useSkillStore } from "@/stores/skillStore";
import { useQuestionStore } from "@/stores/questionStore";
import { useAssessmentConfigStore, getQuestionLimits } from "@/stores/assessmentConfigStore";
import { useCompetencyLevelStore, getLevelToCompetencyMap } from "@/stores/competencyLevelStore";
import { useRegistryStore } from "@/stores/registryStore";
import { useAssessmentStore } from "@/stores/assessmentStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  CalendarIcon, Plus, Play, Square, Trash2, Bell, Users, CheckCircle,
  Clock, ClipboardCheck, BarChart3, Send, AlertTriangle, Timer, Shield, Upload,
  RotateCcw, Zap,
} from "lucide-react";

const statusBadge = (status: string) => {
  switch (status) {
    case "active":
      return <Badge className="bg-success/15 text-success border-success/20 text-xs gap-1"><Play size={10} /> Active</Badge>;
    case "closed":
      return <Badge variant="secondary" className="text-xs gap-1"><Square size={10} /> Closed</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">Draft</Badge>;
  }
};

export default function ReviewCyclesPage() {
  const { user } = useAuth();
  const {
    cycles, activeCycle, loading, summary, cycleDomainSelections,
    fetchCycles, createCycle, activateCycle, closeCycle, deleteCycle,
    sendReminder, computeSummary, getDaysRemaining, getSelectedDomainIds, forceSubmitEmployee,
  } = useCycleStore();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [graceDays, setGraceDays] = useState(3);
  const [saving, setSaving] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [readinessTarget, setReadinessTarget] = useState<string | null>(null);
  const [readinessChecks, setReadinessChecks] = useState<{ label: string; pass: boolean; details?: string[] }[]>([]);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [readinessStep, setReadinessStep] = useState<1 | 2>(1);
  const [expandedChecks, setExpandedChecks] = useState<Set<number>>(new Set());
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [pendingEmployees, setPendingEmployees] = useState<{ id: string; name: string; email: string; submissionId?: string; status: string }[]>([]);
  const [overrideLoading, setOverrideLoading] = useState(false);

  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { questions, fetchQuestions } = useQuestionStore();
  const { configs, fetchConfigs } = useAssessmentConfigStore();
  const { levels, fetchLevels } = useCompetencyLevelStore();
  const { submissions, fetchRegistry } = useRegistryStore();

  const tenantId = user?.tenant_id ?? "tenant-001";

  useEffect(() => {
    fetchCycles(); fetchDomains(); fetchSkills(); fetchQuestions(); fetchConfigs(); fetchLevels(); fetchRegistry();
  }, [fetchCycles, fetchDomains, fetchSkills, fetchQuestions, fetchConfigs, fetchLevels, fetchRegistry]);

  useEffect(() => {
    if (activeCycle) computeSummary(tenantId);
  }, [activeCycle, tenantId, computeSummary]);

  const daysRemaining = getDaysRemaining();

  const activeDomains = useMemo(() => domains.filter(d => d.status === 'active'), [domains]);

  // Get selected domains for the active cycle
  const activeCycleDomainIds = useMemo(() => {
    if (!activeCycle) return [];
    return getSelectedDomainIds(activeCycle.id);
  }, [activeCycle, cycleDomainSelections]);

  const activeCycleDomainNames = useMemo(() => {
    return activeCycleDomainIds
      .map(id => domains.find(d => d.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }, [activeCycleDomainIds, domains]);

  const handleCreate = async () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error("Please fill all required fields"); return;
    }
    if (startDate >= endDate) {
      toast.error("Start date must be before end date"); return;
    }
    setSaving(true);
    try {
      await createCycle({
        tenant_id: tenantId, name: name.trim(),
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        grace_period_days: graceDays,
      });
      toast.success("Cycle created");
      setSheetOpen(false); setName(""); setStartDate(undefined); setEndDate(undefined); setGraceDays(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to create cycle");
    }
    setSaving(false);
  };

  const openReadinessDialog = (cycleId: string) => {
    setReadinessTarget(cycleId);
    setReadinessStep(1);
    setReadinessChecks([]);
    setSelectedDomains([]);
    setExpandedChecks(new Set());
    setReadinessOpen(true);
  };

  const runReadinessCheck = async (domainIds: string[]) => {
    setReadinessLoading(true);
    setReadinessStep(2);
    setExpandedChecks(new Set());

    const selectedDomainObjs = activeDomains.filter(d => domainIds.includes(d.id));
    const checks: { label: string; pass: boolean; details?: string[] }[] = [];

    // 1. Skills mapped
    const domainsWithoutSkills = selectedDomainObjs.filter(d => mappings.filter(m => m.domain_id === d.id).length === 0);
    checks.push({
      label: 'All selected domains have skills mapped',
      pass: domainsWithoutSkills.length === 0,
      details: domainsWithoutSkills.length > 0
        ? domainsWithoutSkills.map(d => d.name)
        : ['All selected domains have mapped skills'],
    });

    // 2. Published questions coverage
    const publishedQuestions = questions.filter(q => q.status === 'published');
    const levelMap = getLevelToCompetencyMap(levels);
    const questionTypes = ['mcq', 'scenario', 'coding'];
    const gaps: string[] = [];

    for (const domain of selectedDomainObjs) {
      const domainSkillIds = mappings.filter(m => m.domain_id === domain.id).map(m => m.skill_id);
      for (const skillId of domainSkillIds) {
        const skill = skills.find(s => s.id === skillId);
        for (const [levelNum, levelName] of Object.entries(levelMap)) {
          for (const qType of questionTypes) {
            const { min } = getQuestionLimits(configs, qType);
            if (min <= 0) continue;
            const count = publishedQuestions.filter(
              q => q.skill_id === skillId && q.competency_level === levelName && q.question_type === qType
            ).length;
            if (count < min) {
              gaps.push(`${skill?.skill_name || skillId} / L${levelNum} / ${qType}: ${count}/${min}`);
            }
          }
        }
      }
    }
    checks.push({
      label: 'Sufficient published questions for all skills',
      pass: gaps.length === 0,
      details: gaps.length > 0 ? gaps : ['All skill/level/type combinations covered'],
    });

    // 3. Assigned employees
    const { data: assignmentData } = await supabase.from('employee_domain_assignments').select('domain_id').eq('tenant_id', tenantId);
    const assignedDomainIds = new Set((assignmentData || []).map((a: any) => a.domain_id));
    const domainsWithoutEmployees = selectedDomainObjs.filter(d => !assignedDomainIds.has(d.id));
    checks.push({
      label: 'All selected domains have assigned employees',
      pass: domainsWithoutEmployees.length === 0,
      details: domainsWithoutEmployees.length > 0
        ? domainsWithoutEmployees.map(d => d.name)
        : ['All selected domains have employees'],
    });

    // 4. Domain lead
    const domainsWithoutLead = selectedDomainObjs.filter(d => !d.domain_lead_id);
    checks.push({
      label: 'All selected domains have a domain lead',
      pass: domainsWithoutLead.length === 0,
      details: domainsWithoutLead.length > 0
        ? domainsWithoutLead.map(d => d.name)
        : ['All selected domains have leads'],
    });

    // 5. No other active cycle
    const otherActive = cycles.find(c => c.status === 'active' && c.id !== readinessTarget);
    checks.push({
      label: 'No other cycle currently active',
      pass: !otherActive,
      details: otherActive ? [`"${otherActive.name}" is currently active and will be auto-closed`] : ['No conflicts'],
    });

    setReadinessChecks(checks);
    setReadinessLoading(false);
  };

  const toggleDomain = (domainId: string) => {
    setSelectedDomains(prev =>
      prev.includes(domainId) ? prev.filter(id => id !== domainId) : [...prev, domainId]
    );
  };

  const handleActivate = async () => {
    if (!confirmActivate) return;
    if (selectedDomains.length === 0) {
      toast.error("Please select at least one domain"); return;
    }
    try {
      await activateCycle(confirmActivate, selectedDomains);
      toast.success("Cycle activated. Eligible employees have been notified.");
    } catch (err: any) {
      toast.error(err.message || "Failed to activate cycle");
    }
    setConfirmActivate(null);
    setReadinessOpen(false);
    setReadinessTarget(null);
  };

  const handleClose = async () => {
    if (!confirmClose) return;
    await closeCycle(confirmClose);
    toast.success("Cycle closed");
    setConfirmClose(null);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteCycle(confirmDelete);
    toast.success("Cycle deleted");
    setConfirmDelete(null);
  };

  const handleReminder = async () => {
    if (!activeCycle) return;
    const count = await sendReminder(activeCycle.id);
    toast.success(`Reminder sent to ${count} employee(s) who haven't submitted.`);
  };

  // Manual override: load pending employees for active cycle
  const openOverridePanel = async () => {
    if (!activeCycle) return;
    setOverrideOpen(true);
    setOverrideLoading(true);

    const domainIds = getSelectedDomainIds(activeCycle.id);
    
    // Get all eligible employees
    const { data: assignments } = await supabase
      .from('employee_domain_assignments')
      .select('employee_id')
      .eq('tenant_id', tenantId)
      .in('domain_id', domainIds.length > 0 ? domainIds : ['__none__']);

    const { data: directUsers } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('domain_id', domainIds.length > 0 ? domainIds : ['__none__']);

    const eligibleIds = new Set([
      ...(assignments || []).map((a: any) => a.employee_id),
      ...(directUsers || []).map((u: any) => u.id),
    ]);

    // Get user details
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('id', Array.from(eligibleIds));

    // Get submissions for this cycle
    const cycleSubmissions = submissions.filter(s => s.cycle === activeCycle.name);
    const subMap = new Map(cycleSubmissions.map(s => [s.employee_id, s]));

    const list = (users || []).map((u: any) => {
      const sub = subMap.get(u.id);
      return {
        id: u.id,
        name: u.full_name,
        email: u.email,
        submissionId: sub?.id,
        status: sub ? sub.status : 'not_started',
      };
    }).sort((a, b) => {
      const order: Record<string, number> = { not_started: 0, draft: 1, submitted: 2, assessment_generated: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });

    setPendingEmployees(list);
    setOverrideLoading(false);
  };

  const handleForceSubmit = async (emp: typeof pendingEmployees[0]) => {
    if (!emp.submissionId) {
      toast.error("Employee has no draft submission to force-submit");
      return;
    }
    try {
      await forceSubmitEmployee(emp.submissionId);
      toast.success(`Submission force-submitted for ${emp.name}`);
      setPendingEmployees(prev =>
        prev.map(e => e.id === emp.id ? { ...e, status: 'submitted' } : e)
      );
      await fetchRegistry();
    } catch (err: any) {
      toast.error(err.message || "Failed to force-submit");
    }
  };

  const statusBadgeSmall = (status: string) => {
    switch (status) {
      case 'submitted': return <Badge className="bg-success/15 text-success text-[10px]">Submitted</Badge>;
      case 'draft': return <Badge className="bg-warning/15 text-warning text-[10px]">Draft</Badge>;
      case 'assessment_generated': return <Badge className="bg-primary/15 text-primary text-[10px]">Assessment Gen.</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">Not Started</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Review Cycles</h2>
          <p className="text-sm text-muted-foreground">
            Manage review cycles, track employee progress, and drive skill assessments.
          </p>
        </div>
        <Button size="sm" onClick={() => setSheetOpen(true)} className="gap-1.5">
          <Plus size={14} /> Create Cycle
        </Button>
      </div>

      {/* Active Cycle Dashboard */}
      {activeCycle && summary && (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Play size={16} className="text-success" /> {activeCycle.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(parseISO(activeCycle.start_date), "MMM d, yyyy")} –{" "}
                  {format(parseISO(activeCycle.end_date), "MMM d, yyyy")}
                  {activeCycle.grace_period_days > 0 && ` · +${activeCycle.grace_period_days} day grace period`}
                </p>
                {activeCycleDomainNames && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Domains: <span className="font-medium text-foreground">{activeCycleDomainNames}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {daysRemaining !== null && (
                  <div className={`flex items-center gap-1.5 text-sm font-semibold ${daysRemaining <= 3 ? "text-destructive" : daysRemaining <= 7 ? "text-warning" : "text-foreground"}`}>
                    <Timer size={14} />
                    {daysRemaining > 0 ? `${daysRemaining} days left` : daysRemaining === 0 ? "Ends today" : "Grace period"}
                  </div>
                )}
                <Button size="sm" variant="outline" onClick={openOverridePanel} className="gap-1.5">
                  <Shield size={14} /> Manage Employees
                </Button>
                <Button size="sm" variant="outline" onClick={handleReminder} className="gap-1.5">
                  <Bell size={14} /> Send Reminder
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmClose(activeCycle.id)} className="gap-1.5 text-destructive hover:text-destructive">
                  <Square size={14} /> Close Cycle
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
              <Card><CardContent className="p-3 text-center">
                <Users size={16} className="mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-bold text-foreground">{summary.totalEmployees}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Eligible</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <Send size={16} className="mx-auto text-success mb-1" />
                <p className="text-lg font-bold text-foreground">{summary.submitted}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Submitted</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <AlertTriangle size={16} className="mx-auto text-warning mb-1" />
                <p className="text-lg font-bold text-foreground">{Math.max(0, summary.totalEmployees - summary.submitted)}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <ClipboardCheck size={16} className="mx-auto text-primary mb-1" />
                <p className="text-lg font-bold text-foreground">{summary.assessmentsCompleted}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Assessed</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <Clock size={16} className="mx-auto text-warning mb-1" />
                <p className="text-lg font-bold text-foreground">{summary.managerReviewsPending}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Reviews Pending</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <CheckCircle size={16} className="mx-auto text-success mb-1" />
                <p className="text-lg font-bold text-foreground">{summary.approved}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Approved</p>
              </CardContent></Card>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Overall Completion</span>
                <span className="text-xs font-medium text-foreground">
                  {summary.totalEmployees > 0 ? Math.round((summary.approved / summary.totalEmployees) * 100) : 0}%
                </span>
              </div>
              <Progress value={summary.totalEmployees > 0 ? (summary.approved / summary.totalEmployees) * 100 : 0} className="h-2" />
            </div>
          </div>
        </div>
      )}

      {/* Cycles Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cycle Name</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Domains</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cycles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                  No review cycles created yet. Click "Create Cycle" to get started.
                </TableCell>
              </TableRow>
            ) : (
              cycles.map((cycle) => {
                const cycleDomains = getSelectedDomainIds(cycle.id);
                const domainNames = cycleDomains.map(id => domains.find(d => d.id === id)?.name).filter(Boolean);
                return (
                  <TableRow key={cycle.id}>
                    <TableCell className="font-medium text-foreground">{cycle.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(parseISO(cycle.start_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(parseISO(cycle.end_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {domainNames.length > 0 ? (
                        <span className="truncate max-w-[200px] inline-block" title={domainNames.join(', ')}>
                          {domainNames.length <= 2 ? domainNames.join(', ') : `${domainNames.length} domains`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(cycle.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {cycle.status === "draft" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-success" onClick={() => openReadinessDialog(cycle.id)}>
                              <Play size={12} /> Activate
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => setConfirmDelete(cycle.id)}>
                              <Trash2 size={12} /> Delete
                            </Button>
                          </>
                        )}
                        {cycle.status === "active" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => setConfirmClose(cycle.id)}>
                            <Square size={12} /> Close
                          </Button>
                        )}
                        {cycle.status === "closed" && cycle.closed_at && (
                          <span className="text-xs text-muted-foreground">Closed {format(parseISO(cycle.closed_at), "MMM d")}</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Cycle Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create Review Cycle</SheetTitle>
            <SheetDescription>Define the cycle name and date range. You can activate it later.</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="space-y-2">
              <Label>Cycle Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2026-Q2" maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Grace Period (days)</Label>
              <Input type="number" value={graceDays} onChange={(e) => setGraceDays(Number(e.target.value))} min={0} max={30} />
              <p className="text-xs text-muted-foreground">Employees can submit during this period after the end date.</p>
            </div>
            <Button onClick={handleCreate} disabled={saving} className="w-full">
              {saving ? "Creating…" : "Create Cycle"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm Activate */}
      <AlertDialog open={!!confirmActivate} onOpenChange={() => setConfirmActivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will enable skill registry submissions for employees in {selectedDomains.length} selected domain(s) and send notifications.
              {cycles.find(c => c.status === 'active' && c.id !== confirmActivate) && " Any previously active cycle will be closed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate}>Activate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Close */}
      <AlertDialog open={!!confirmClose} onOpenChange={() => setConfirmClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Cycle?</AlertDialogTitle>
            <AlertDialogDescription>This will lock new submissions and assessment attempts. Manager reviews can still be completed after closure.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Close Cycle</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cycle?</AlertDialogTitle>
            <AlertDialogDescription>This cycle will be permanently deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Readiness Check + Domain Selection Dialog */}
      <AlertDialog open={readinessOpen} onOpenChange={(open) => { if (!open) { setReadinessOpen(false); setReadinessTarget(null); } }}>
        <AlertDialogContent className="max-w-lg">
          {readinessStep === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ClipboardCheck size={18} /> Select Participating Domains
                </AlertDialogTitle>
                <AlertDialogDescription>Choose which domains to include in this cycle. Readiness checks will only run against selected domains.</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activeDomains.map((domain) => (
                  <label key={domain.id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer border border-transparent has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                    <Checkbox
                      checked={selectedDomains.includes(domain.id)}
                      onCheckedChange={() => toggleDomain(domain.id)}
                    />
                    <span className="text-sm text-foreground font-medium">{domain.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {mappings.filter(m => m.domain_id === domain.id).length} skills
                    </span>
                  </label>
                ))}
                {activeDomains.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No active domains found.</p>
                )}
              </div>
              {selectedDomains.length === 0 && activeDomains.length > 0 && (
                <p className="text-xs text-destructive">Select at least one domain to proceed.</p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  onClick={() => runReadinessCheck(selectedDomains)}
                  disabled={selectedDomains.length === 0}
                >
                  Check Readiness →
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ClipboardCheck size={18} /> Pre-Activation Readiness Check
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Checking {selectedDomains.length} selected domain(s): {selectedDomains.map(id => domains.find(d => d.id === id)?.name).filter(Boolean).join(', ')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {readinessLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Running checks…</div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {readinessChecks.map((check, i) => {
                    const MAX_VISIBLE = 10;
                    const isExpanded = expandedChecks.has(i);
                    const items = check.details || [];
                    const visibleItems = !check.pass && items.length > MAX_VISIBLE && !isExpanded ? items.slice(0, MAX_VISIBLE) : items;
                    const hasMore = !check.pass && items.length > MAX_VISIBLE && !isExpanded;

                    return (
                      <div key={i} className={`rounded-md px-3 py-2.5 text-sm ${check.pass ? 'bg-success/10' : 'bg-destructive/10'}`}>
                        <div className="flex items-start gap-2">
                          {check.pass ? <CheckCircle size={16} className="text-success mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />}
                          <p className={`font-medium ${check.pass ? 'text-success' : 'text-destructive'}`}>{check.label}</p>
                        </div>
                        {items.length > 0 && (
                          <ul className={`mt-1.5 ml-6 space-y-0.5 ${check.pass ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {visibleItems.map((item, j) => (
                              <li key={j} className="text-xs flex items-start gap-1.5">
                                <span className="shrink-0 mt-1">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                            {hasMore && (
                              <li>
                                <button
                                  className="text-xs text-primary hover:underline mt-0.5"
                                  onClick={() => setExpandedChecks(prev => new Set([...prev, i]))}
                                >
                                  Show all {items.length} items
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="ghost" size="sm" onClick={() => setReadinessStep(1)} className="mr-auto text-xs gap-1">
                  ← Back to Domain Selection
                </Button>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                {!readinessLoading && (
                  <AlertDialogAction
                    onClick={() => {
                      setReadinessOpen(false);
                      setConfirmActivate(readinessTarget);
                    }}
                    disabled={
                      selectedDomains.length === 0 ||
                      readinessChecks.some(c => !c.pass && c.label !== 'No other cycle currently active' && c.label !== 'Sufficient published questions for all skills')
                    }
                  >
                    Proceed to Activate
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Override / Manage Employees Sheet */}
      <Sheet open={overrideOpen} onOpenChange={setOverrideOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Shield size={18} /> Manage Employee Submissions
            </SheetTitle>
            <SheetDescription>
              View eligible employee status and perform manual overrides for the active cycle.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {overrideLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading employees…</div>
            ) : pendingEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No eligible employees found for this cycle.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {pendingEmployees.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-border bg-card">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadgeSmall(emp.status)}
                      {emp.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleForceSubmit(emp)}
                        >
                          <Upload size={12} /> Force Submit
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
