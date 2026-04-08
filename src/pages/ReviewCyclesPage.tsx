import { useState, useEffect, useMemo } from "react";
import { useCycleStore, ReviewCycle } from "@/stores/cycleStore";
import { useDomainStore } from "@/stores/domainStore";
import { useSkillStore } from "@/stores/skillStore";
import { useQuestionStore } from "@/stores/questionStore";
import { useAssessmentConfigStore, getQuestionLimits } from "@/stores/assessmentConfigStore";
import { useCompetencyLevelStore, getLevelToCompetencyMap } from "@/stores/competencyLevelStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  CalendarIcon,
  Plus,
  Play,
  Square,
  Trash2,
  Bell,
  Users,
  CheckCircle,
  Clock,
  ClipboardCheck,
  BarChart3,
  Send,
  AlertTriangle,
  Timer,
} from "lucide-react";

const statusBadge = (status: string) => {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-success/15 text-success border-success/20 text-xs gap-1">
          <Play size={10} /> Active
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="secondary" className="text-xs gap-1">
          <Square size={10} /> Closed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          Draft
        </Badge>
      );
  }
};

export default function ReviewCyclesPage() {
  const { user } = useAuth();
  const {
    cycles,
    activeCycle,
    loading,
    summary,
    fetchCycles,
    createCycle,
    activateCycle,
    closeCycle,
    deleteCycle,
    sendReminder,
    computeSummary,
    getDaysRemaining,
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
  const [readinessChecks, setReadinessChecks] = useState<{ label: string; pass: boolean; detail?: string }[]>([]);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const { domains, mappings, fetchDomains } = useDomainStore();
  const { skills, fetchSkills } = useSkillStore();
  const { questions, fetchQuestions } = useQuestionStore();
  const { configs, fetchConfigs } = useAssessmentConfigStore();
  const { levels, fetchLevels } = useCompetencyLevelStore();

  const tenantId = user?.tenant_id ?? "tenant-001";

  useEffect(() => {
    fetchCycles();
    fetchDomains();
    fetchSkills();
    fetchQuestions();
    fetchConfigs();
    fetchLevels();
  }, [fetchCycles, fetchDomains, fetchSkills, fetchQuestions, fetchConfigs, fetchLevels]);

  useEffect(() => {
    if (activeCycle) computeSummary(tenantId);
  }, [activeCycle, tenantId, computeSummary]);

  const daysRemaining = getDaysRemaining();

  const handleCreate = async () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error("Please fill all required fields");
      return;
    }
    if (startDate >= endDate) {
      toast.error("Start date must be before end date");
      return;
    }
    setSaving(true);
    try {
      await createCycle({
        tenant_id: tenantId,
        name: name.trim(),
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        grace_period_days: graceDays,
      });
      toast.success("Cycle created");
      setSheetOpen(false);
      setName("");
      setStartDate(undefined);
      setEndDate(undefined);
      setGraceDays(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to create cycle");
    }
    setSaving(false);
  };

  const runReadinessCheck = async (cycleId: string) => {
    setReadinessTarget(cycleId);
    setReadinessLoading(true);
    setReadinessOpen(true);

    const checks: { label: string; pass: boolean; detail?: string }[] = [];

    // 1. At least one active domain exists
    const activeDomains = domains.filter(d => d.status === 'active');
    checks.push({
      label: 'At least one active domain exists',
      pass: activeDomains.length > 0,
      detail: activeDomains.length > 0 ? `${activeDomains.length} active domain(s)` : 'No active domains found',
    });

    // 2. All active domains have skills mapped
    const domainsWithoutSkills = activeDomains.filter(d => {
      const mapped = mappings.filter(m => m.domain_id === d.id);
      return mapped.length === 0;
    });
    checks.push({
      label: 'All domains have skills mapped',
      pass: domainsWithoutSkills.length === 0,
      detail: domainsWithoutSkills.length > 0 ? `Missing: ${domainsWithoutSkills.map(d => d.name).join(', ')}` : 'All domains have mapped skills',
    });

    // 3. Sufficient published questions per skill/level/type
    const publishedQuestions = questions.filter(q => q.status === 'published');
    const levelMap = getLevelToCompetencyMap(levels);
    const questionTypes = ['mcq', 'scenario', 'coding'];
    const gaps: string[] = [];

    for (const domain of activeDomains) {
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
      detail: gaps.length > 0 ? `${gaps.length} gap(s) found. ${gaps.slice(0, 5).join('; ')}${gaps.length > 5 ? ` ...and ${gaps.length - 5} more` : ''}` : 'All skill/level/type combinations covered',
    });

    // 4. All domains have at least one assigned employee
    const { data: assignmentData } = await supabase.from('employee_domain_assignments').select('domain_id').eq('tenant_id', tenantId);
    const assignedDomainIds = new Set((assignmentData || []).map((a: any) => a.domain_id));
    const domainsWithoutEmployees = activeDomains.filter(d => !assignedDomainIds.has(d.id));
    checks.push({
      label: 'All domains have assigned employees',
      pass: domainsWithoutEmployees.length === 0,
      detail: domainsWithoutEmployees.length > 0 ? `Missing: ${domainsWithoutEmployees.map(d => d.name).join(', ')}` : 'All domains have employees',
    });

    // 5. All domains have a domain lead
    const domainsWithoutLead = activeDomains.filter(d => !d.domain_lead_id);
    checks.push({
      label: 'All domains have a domain lead assigned',
      pass: domainsWithoutLead.length === 0,
      detail: domainsWithoutLead.length > 0 ? `Missing: ${domainsWithoutLead.map(d => d.name).join(', ')}` : 'All domains have leads',
    });

    // 6. No other active cycle
    const otherActive = cycles.find(c => c.status === 'active' && c.id !== cycleId);
    checks.push({
      label: 'No other cycle currently active',
      pass: !otherActive,
      detail: otherActive ? `"${otherActive.name}" is currently active and will be auto-closed` : 'No conflicts',
    });

    setReadinessChecks(checks);
    setReadinessLoading(false);
  };

  const handleActivate = async () => {
    if (!confirmActivate) return;
    try {
      await activateCycle(confirmActivate);
      toast.success("Cycle activated. All employees have been notified.");
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
              </div>
              <div className="flex items-center gap-2">
                {daysRemaining !== null && (
                  <div
                    className={`flex items-center gap-1.5 text-sm font-semibold ${daysRemaining <= 3 ? "text-destructive" : daysRemaining <= 7 ? "text-warning" : "text-foreground"}`}
                  >
                    <Timer size={14} />
                    {daysRemaining > 0
                      ? `${daysRemaining} days left`
                      : daysRemaining === 0
                        ? "Ends today"
                        : "Grace period"}
                  </div>
                )}
                <Button size="sm" variant="outline" onClick={handleReminder} className="gap-1.5">
                  <Bell size={14} /> Send Reminder
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmClose(activeCycle.id)}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Square size={14} /> Close Cycle
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
              <Card>
                <CardContent className="p-3 text-center">
                  <Users size={16} className="mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold text-foreground">{summary.totalEmployees}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Total Employees</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Send size={16} className="mx-auto text-success mb-1" />
                  <p className="text-lg font-bold text-foreground">{summary.submitted}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Submitted</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <AlertTriangle size={16} className="mx-auto text-warning mb-1" />
                  <p className="text-lg font-bold text-foreground">
                    {Math.max(0, summary.totalEmployees - summary.submitted)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <ClipboardCheck size={16} className="mx-auto text-primary mb-1" />
                  <p className="text-lg font-bold text-foreground">{summary.assessmentsCompleted}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Assessed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Clock size={16} className="mx-auto text-warning mb-1" />
                  <p className="text-lg font-bold text-foreground">{summary.managerReviewsPending}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Reviews Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <CheckCircle size={16} className="mx-auto text-success mb-1" />
                  <p className="text-lg font-bold text-foreground">{summary.approved}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Approved</p>
                </CardContent>
              </Card>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Overall Completion</span>
                <span className="text-xs font-medium text-foreground">
                  {summary.totalEmployees > 0 ? Math.round((summary.approved / summary.totalEmployees) * 100) : 0}%
                </span>
              </div>
              <Progress
                value={summary.totalEmployees > 0 ? (summary.approved / summary.totalEmployees) * 100 : 0}
                className="h-2"
              />
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
              <TableHead>Grace Period</TableHead>
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
              cycles.map((cycle) => (
                <TableRow key={cycle.id}>
                  <TableCell className="font-medium text-foreground">{cycle.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(parseISO(cycle.start_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(parseISO(cycle.end_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cycle.grace_period_days} days</TableCell>
                  <TableCell>{statusBadge(cycle.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {cycle.status === "draft" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-success"
                            onClick={() => runReadinessCheck(cycle.id)}
                          >
                            <Play size={12} /> Activate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-destructive"
                            onClick={() => setConfirmDelete(cycle.id)}
                          >
                            <Trash2 size={12} /> Delete
                          </Button>
                        </>
                      )}
                      {cycle.status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-destructive"
                          onClick={() => setConfirmClose(cycle.id)}
                        >
                          <Square size={12} /> Close
                        </Button>
                      )}
                      {cycle.status === "closed" && cycle.closed_at && (
                        <span className="text-xs text-muted-foreground">
                          Closed {format(parseISO(cycle.closed_at), "MMM d")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Grace Period (days)</Label>
              <Input
                type="number"
                value={graceDays}
                onChange={(e) => setGraceDays(Number(e.target.value))}
                min={0}
                max={30}
              />
              <p className="text-xs text-muted-foreground">
                Employees can submit during this period after the end date.
              </p>
            </div>

            <Button onClick={handleCreate} disabled={saving} className="w-full">
              {saving ? "Creating…" : "Create Cycle"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm dialogs */}
      <AlertDialog open={!!confirmActivate} onOpenChange={() => setConfirmActivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will enable skill registry submissions for all employees and send notifications. Any previously
              active cycle will be closed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate}>Activate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmClose} onOpenChange={() => setConfirmClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will lock new submissions and assessment attempts. Manager reviews can still be completed after
              closure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Close Cycle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              This cycle will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Readiness Check Dialog */}
      <AlertDialog open={readinessOpen} onOpenChange={(open) => { if (!open) { setReadinessOpen(false); setReadinessTarget(null); } }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ClipboardCheck size={18} /> Pre-Activation Readiness Check
            </AlertDialogTitle>
            <AlertDialogDescription>
              Review the checklist below before activating this cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {readinessLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Running checks…</div>
          ) : (
            <div className="space-y-2 my-2 max-h-64 overflow-y-auto">
              {readinessChecks.map((check, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${check.pass ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  {check.pass ? <CheckCircle size={16} className="text-success mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />}
                  <div>
                    <p className={`font-medium ${check.pass ? 'text-success' : 'text-destructive'}`}>{check.label}</p>
                    {check.detail && <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!readinessLoading && (
              <AlertDialogAction
                onClick={() => {
                  setReadinessOpen(false);
                  setConfirmActivate(readinessTarget);
                }}
                disabled={readinessChecks.some(c => !c.pass && c.label !== 'No other cycle currently active' && c.label !== 'Sufficient published questions for all skills')}
              >
                Proceed to Activate
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
