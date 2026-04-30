import { useMemo, useEffect, useState } from 'react';
import { useSkillRegistryStore } from '@/stores/skillRegistryStore';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useCompetencyLevelStore } from '@/stores/competencyLevelStore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle, FileText, Plus, Edit, Eye, Play, Trash2, Loader2,
  History, Clock, CheckCircle2, BarChart3, Star, StarHalf, ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr).getTime();
  const diff = Date.now() - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const days = Math.floor(hr / 24);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function computeAvg(items: { self_score: number }[]): number | null {
  if (!items || items.length === 0) return null;
  const sum = items.reduce((acc, i) => acc + i.self_score, 0);
  return Math.round((sum / items.length) * 10) / 10;
}

function StarRow({ value, max }: { value: number | null; max: number }) {
  // Map value (in competency-level scale) to a 5-star scale
  const ratio = value !== null && max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const score5 = ratio * 5;
  const full = Math.floor(score5);
  const half = score5 - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f-${i}`} size={18} className="fill-amber-400 text-amber-400" />
      ))}
      {half && <StarHalf size={18} className="fill-amber-400 text-amber-400" />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e-${i}`} size={18} className="text-muted-foreground/30" />
      ))}
    </div>
  );
}

export default function SkillRegistryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { registries, items, fetchRegistries, fetchItemsForRegistries, createNewVersion, getDraft, getLatest, loading, initialized, discardDraft } = useSkillRegistryStore();
  const { domains, mappings, fetchDomains, initialized: domainsInitialized } = useDomainStore();
  const { skills, fetchSkills, initialized: skillsInitialized } = useSkillStore();
  const { levels, fetchLevels } = useCompetencyLevelStore();

  const employeeId = user?.id ?? '';
  const tenantId = user?.tenant_id ?? 'tenant-001';

  useEffect(() => {
    fetchRegistries(employeeId);
    fetchDomains();
    fetchSkills();
    fetchLevels();
  }, []);

  const assignedDomain = useMemo(() => {
    if (user?.domain_id) return domains.find((d) => d.id === user.domain_id) ?? null;
    return null;
  }, [user, domains]);

  const domainSkills = useMemo(() => {
    if (!assignedDomain) return [];
    const skillIds = mappings.filter((m) => m.domain_id === assignedDomain.id).map((m) => m.skill_id);
    return skills.filter((s) => skillIds.includes(s.id) && s.status === 'active');
  }, [assignedDomain, mappings, skills]);

  const myRegistries = useMemo(
    () => registries.filter((r) => r.employee_id === employeeId),
    [registries, employeeId]
  );

  useEffect(() => {
    if (myRegistries.length > 0) {
      fetchItemsForRegistries(myRegistries.map((r) => r.id));
    }
  }, [myRegistries]);

  const draft = getDraft(employeeId);
  const latest = getLatest(employeeId);
  const submittedRegistries = myRegistries.filter((r) => r.status === 'submitted');

  const handleCreateNewVersion = async () => {
    if (!assignedDomain) return;
    const reg = await createNewVersion(employeeId, tenantId, assignedDomain.id);
    if (reg) navigate(`/skill-registry/${reg.id}`);
  };

  const handleEditDetails = () => {
    if (draft) {
      navigate(`/skill-registry/${draft.id}`);
    } else {
      handleCreateNewVersion();
    }
  };

  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const handleDiscardDraft = async () => {
    if (!draft) return;
    setDiscarding(true);
    try {
      await discardDraft(draft.id);
      setDiscardOpen(false);
      toast.success('Draft discarded');
    } catch (err) {
      console.error('Failed to discard draft:', err);
      toast.error('Failed to discard draft. Please try again.');
    } finally {
      setDiscarding(false);
    }
  };

  const isInitialLoading = (loading && !initialized) || !domainsInitialized || !skillsInitialized;
  const maxLevel = levels.length > 0 ? levels.length : 5;

  // ── Initial loading skeleton ──
  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">My Registry</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage and track your assessed skill sets over time.</p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
            <div className="flex justify-end pt-2 border-t border-border">
              <Skeleton className="h-9 w-44" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── No domain warning ──
  if (!assignedDomain) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">My Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage and track your assessed skill sets over time.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle size={32} className="text-warning mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Domain Assigned</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You have not been assigned to a domain yet. Please contact your manager or admin.
          </p>
        </div>
      </div>
    );
  }

  // ── Domain without skills ──
  if (domainSkills.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">My Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage and track your assessed skill sets over time.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle size={32} className="text-warning mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Skills Configured</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            No skills have been configured for your domain ({assignedDomain.name}). Please contact your admin.
          </p>
        </div>
      </div>
    );
  }

  // Pick the registry to feature: draft if exists, else latest submitted
  const featured = draft ?? latest ?? null;
  const featuredItems = featured ? (items.get(featured.id) ?? []) : [];
  const ratedCount = featuredItems.length;
  const totalSkills = domainSkills.length;
  const avgLevel = computeAvg(featuredItems);
  const updatedTimes = submittedRegistries.length;
  const lastEditDate = featured
    ? (featured.status === 'submitted' && featured.submitted_at ? featured.submitted_at : (featured.modified_at ?? featured.created_at))
    : null;

  // Status pill
  let statusLabel = 'Not started';
  let statusClass = 'bg-muted text-muted-foreground border-border';
  if (featured?.status === 'draft') {
    statusLabel = 'Draft';
    statusClass = 'bg-warning/15 text-warning border-warning/20';
  } else if (featured?.status === 'submitted') {
    statusLabel = 'Up to date';
    statusClass = 'bg-success/15 text-success border-success/20';
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">My Registry</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage and track your assessed skill sets over time.</p>
        </div>
        {featured && (
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleEditDetails}>
            <Edit size={13} /> Edit Details
          </Button>
        )}
      </div>

      {/* Hero card */}
      {featured ? (
        <Card className="border-border">
          <CardContent className="p-6 space-y-5">
            {/* Title row */}
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-2xl font-bold text-foreground">{assignedDomain.name}</h3>
              <Badge variant="outline" className={`text-xs font-medium ${statusClass}`}>
                {statusLabel}
              </Badge>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-5 flex-wrap text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <History size={13} />
                <span>Updated <span className="font-medium text-foreground">{updatedTimes}</span> {updatedTimes === 1 ? 'time' : 'times'}</span>
              </div>
              {lastEditDate && (
                <div className="flex items-center gap-1.5">
                  <Clock size={13} />
                  <span>Last edit: <span className="font-medium text-foreground">{formatRelative(lastEditDate)}</span></span>
                </div>
              )}
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Completion Status */}
              <div className="rounded-lg border border-border p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <CheckCircle2 size={15} />
                  <span>Completion Status</span>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-bold text-foreground leading-none">{ratedCount}</span>
                  <span className="text-base text-muted-foreground">/ {totalSkills}</span>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground ml-1">Skills Rated</span>
                </div>
                <Progress value={totalSkills > 0 ? (ratedCount / totalSkills) * 100 : 0} className="h-2" />
              </div>

              {/* Overall Average Rating */}
              <div className="rounded-lg border border-border p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <BarChart3 size={15} />
                  <span>Overall Average Rating</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-bold text-foreground leading-none">
                    {avgLevel !== null ? avgLevel.toFixed(1) : '—'}
                  </span>
                  <div className="flex flex-col gap-1">
                    <StarRow value={avgLevel} max={maxLevel} />
                    <span className="text-[11px] text-muted-foreground">
                      Out of {maxLevel.toFixed(1)} possible
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer action */}
            <div className="flex justify-end items-center gap-2 pt-4 border-t border-border">
              {featured.status === 'draft' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDiscardOpen(true)}
                >
                  <Trash2 size={14} /> Discard Draft
                </Button>
              )}
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`/skill-registry/${featured.id}`)}
              >
                {featured.status === 'draft' ? 'Continue Editing' : 'View Detailed Breakdown'}
                <ArrowRight size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        // No registry yet → empty state inside hero shell
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="p-8 flex flex-col items-center text-center">
            <FileText size={32} className="text-muted-foreground mb-3" />
            <h3 className="text-base font-semibold text-foreground mb-1">Start Your First Registry</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Rate your skills in <span className="font-medium text-foreground">{assignedDomain.name}</span> to create your first skill registry version.
            </p>
            <Button size="sm" className="gap-1.5" onClick={handleCreateNewVersion}>
              <Play size={13} /> Start Self Review
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Version History */}
      {submittedRegistries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText size={14} className="text-muted-foreground" /> Version History
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-medium">Version</TableHead>
                  <TableHead className="text-xs font-medium">Date</TableHead>
                  <TableHead className="text-xs font-medium">Domain</TableHead>
                  <TableHead className="text-xs font-medium">Avg Level</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                  <TableHead className="text-xs font-medium text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submittedRegistries.map((reg) => {
                  const regItems = items.get(reg.id);
                  const avg = computeAvg(regItems ?? []);
                  return (
                    <TableRow key={reg.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/skill-registry/${reg.id}`)}>
                      <TableCell className="text-sm font-medium">v{reg.version_number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {reg.submitted_at ? formatDateTime(reg.submitted_at) : formatDateTime(reg.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{assignedDomain.name}</TableCell>
                      <TableCell className="text-sm font-medium">{avg !== null ? avg : '—'}</TableCell>
                      <TableCell>
                        <Badge className="text-[10px] bg-success/15 text-success border-success/20">Submitted</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/skill-registry/${reg.id}`); }}>
                          <Eye size={13} /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Discard Draft Confirmation */}
      <AlertDialog open={discardOpen} onOpenChange={(o) => !discarding && setDiscardOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved changes{draft ? ` for v${draft.version_number}` : ''} will be permanently removed and cannot be restored. Your last submitted version will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discarding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDiscardDraft(); }}
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
