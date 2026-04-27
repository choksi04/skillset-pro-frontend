import { useState, useMemo, useEffect } from 'react';
import { useReviewStore, ManagerReview, ReviewAction, SkillReviewEntry } from '@/stores/reviewStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAttemptStore, AssessmentAttempt } from '@/stores/attemptStore';
import { useAssessmentStore, Assessment } from '@/stores/assessmentStore';
import { useRegistryStore } from '@/stores/registryStore';
import { useCompetencyLevelStore, getRatingLabels, getLevelColorClass, getFormattedLevelLabel } from '@/stores/competencyLevelStore';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SearchableSelect from '@/components/ui/searchable-select';
import { toast } from 'sonner';
import {
  CheckCircle, XCircle, RefreshCw, MessageSquare, Eye,
  Send, Shield, AlertTriangle, UserCog, Bell,
} from 'lucide-react';

// levelLabels and levelColors now come from competencyLevelStore
const actionLabels: Record<ReviewAction, { label: string; icon: React.ReactNode; color: string }> = {
  approve: { label: 'Approve', icon: <CheckCircle size={14} />, color: 'bg-success/15 text-success border-success/20' },
  adjust: { label: 'Adjust', icon: <RefreshCw size={14} />, color: 'bg-warning/15 text-warning border-warning/20' },
  reassess: { label: 'Reassess', icon: <XCircle size={14} />, color: 'bg-destructive/15 text-destructive border-destructive/20' },
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-success' : score >= 50 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} /></div>
      <span className="text-xs font-medium text-foreground">{score}%</span>
    </div>
  );
}

function CommentInput({ initial, onSave, onCancel }: { initial: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="space-y-3 py-2">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="Enter your comments..." />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(value)}>Save Comment</Button>
      </div>
    </div>
  );
}

function SkillReviewRow({ entry, skillName, reviewId, isCompleted }: { entry: SkillReviewEntry; skillName: string; reviewId: string; isCompleted: boolean }) {
  const { setSkillAction, setSkillComment } = useReviewStore();
  const { levels } = useCompetencyLevelStore();
  const ratingLabels = getRatingLabels(levels);
  const [commentOpen, setCommentOpen] = useState(false);
  const [adjustLevel, setAdjustLevel] = useState<number>(entry.ai_calculated_level);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const handleAction = (action: ReviewAction) => {
    if (action === 'adjust') { setAdjustOpen(true); } else {
      setSkillAction(reviewId, entry.skill_id, action);
      toast.success(`${skillName}: ${action === 'approve' ? 'AI rating approved' : 'Marked for reassessment'}`);
    }
  };
  const confirmAdjust = () => { setSkillAction(reviewId, entry.skill_id, 'adjust', adjustLevel); setAdjustOpen(false); toast.success(`${skillName}: Level adjusted to L${adjustLevel}`); };
  const saveComment = (comment: string) => { setSkillComment(reviewId, entry.skill_id, comment); setCommentOpen(false); toast.success('Comment saved'); };

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/30 transition-colors">
        <td className="py-3 px-4"><span className="text-sm font-medium text-foreground">{skillName}</span></td>
        <td className="py-3 px-4 text-center"><Badge variant="outline" className="text-xs">L{entry.self_rating} – {ratingLabels[entry.self_rating] ?? `Level ${entry.self_rating}`}</Badge></td>
        <td className="py-3 px-4">
          <div className="flex flex-col items-center gap-1">
            <Badge className={`text-xs ${getLevelColorClass(entry.ai_calculated_level)}`}>L{entry.ai_calculated_level}</Badge>
            <ScoreBar score={entry.ai_score} />
          </div>
        </td>
        <td className="py-3 px-4 text-center">
          {entry.manager_action ? (
            <div className="flex flex-col items-center gap-1">
              <Badge className={`text-xs gap-1 ${actionLabels[entry.manager_action].color}`}>{actionLabels[entry.manager_action].icon}{actionLabels[entry.manager_action].label}</Badge>
              {entry.manager_action === 'adjust' && entry.manager_adjusted_level && <span className="text-xs text-muted-foreground">→ L{entry.manager_adjusted_level}</span>}
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="py-3 px-4">
          {!isCompleted && (
            <div className="flex items-center gap-1 justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-success hover:text-success" onClick={() => handleAction('approve')}><CheckCircle size={12} /> Approve</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-warning hover:text-warning" onClick={() => handleAction('adjust')}><RefreshCw size={12} /> Adjust</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => handleAction('reassess')}><XCircle size={12} /> Reassess</Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCommentOpen(true)}><MessageSquare size={12} /></Button>
            </div>
          )}
          {isCompleted && entry.manager_comment && <p className="text-xs text-muted-foreground italic">"{entry.manager_comment}"</p>}
        </td>
      </tr>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adjust Level — {skillName}</DialogTitle><DialogDescription>AI calculated Level {entry.ai_calculated_level}. Select the corrected level.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs text-muted-foreground">New Level</Label>
            <Select value={String(adjustLevel)} onValueChange={(v) => setAdjustLevel(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4, 5].map((l) => <SelectItem key={l} value={String(l)}>{getFormattedLevelLabel(levels, l)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={confirmAdjust}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Comment — {skillName}</DialogTitle><DialogDescription>Add your review notes for this skill.</DialogDescription></DialogHeader>
          <CommentInput initial={entry.manager_comment} onSave={saveComment} onCancel={() => setCommentOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ManagerReviewPanelProps {
  review: ManagerReview;
  attempt: AssessmentAttempt;
  assessment: Assessment;
}

export default function ManagerReviewPanel({ review, attempt, assessment }: ManagerReviewPanelProps) {
  const { skills } = useSkillStore();
  const { completeReview, reassignReviewer } = useReviewStore();
  const currentCycle = useRegistryStore.getState().currentCycle || '';
  const { currentRole, user } = useAuth();

  const [overallComment, setOverallComment] = useState(review.overall_comment);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<{ value: string; label: string }[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [reviewerName, setReviewerName] = useState<string | null>(null);

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const isCompleted = review.status === 'completed';
  const allActioned = review.skill_reviews.every((sr) => sr.manager_action !== null);
  const hasReassess = review.skill_reviews.some((sr) => sr.manager_action === 'reassess');
  const isAdmin = currentRole === 'admin';

  useEffect(() => {
    supabase.from('users').select('full_name').eq('id', review.reviewer_id).single().then(({ data }) => {
      if (data) setReviewerName(data.full_name);
    });
  }, [review.reviewer_id]);

  const openReassignDialog = async () => {
    const { data } = await supabase.from('users').select('id, full_name, role').eq('tenant_id', review.tenant_id).eq('status', 'active');
    const options = (data || [])
      .filter((u: any) => u.id !== review.employee_id)
      .map((u: any) => ({ value: u.id, label: `${u.full_name} (${u.role})` }));
    setTenantUsers(options);
    setSelectedReviewer(review.reviewer_id);
    setReassignOpen(true);
  };

  const handleReassign = async () => {
    if (!selectedReviewer || selectedReviewer === review.reviewer_id) {
      setReassignOpen(false);
      return;
    }
    await reassignReviewer(review.id, selectedReviewer);
    setReassignOpen(false);
    const newName = tenantUsers.find((u) => u.value === selectedReviewer)?.label ?? '';
    setReviewerName(newName.replace(/ \(.*\)$/, ''));
    toast.success(`Reviewer reassigned to ${newName}`);
  };

  const handleFinalize = () => {
    const { setOverallComment: setComment } = useReviewStore.getState();
    setComment(review.id, overallComment);
    completeReview(review.id, currentCycle);
    setConfirmFinalize(false);
    toast.success('Review completed. Official skill registry entries generated.');
  };

  const statusBadge = {
    pending: <Badge className="bg-warning/15 text-warning border-warning/20 text-xs gap-1"><Bell size={10} /> Pending Review</Badge>,
    in_progress: <Badge className="bg-info/15 text-info border-info/20 text-xs gap-1"><Eye size={10} /> In Progress</Badge>,
    completed: <Badge className="bg-success/15 text-success border-success/20 text-xs gap-1"><Shield size={10} /> Completed</Badge>,
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Manager Review</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reviewer: {reviewerName ?? '...'}{review.reviewer_id === review.employee_id && ' (Self-Review)'}
              {review.completed_at && ` · Reviewed: ${new Date(review.completed_at).toLocaleString()}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && !isCompleted && (
              <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={openReassignDialog}>
                <UserCog size={12} /> Change Reviewer
              </Button>
            )}
            {statusBadge[review.status]}
          </div>
        </div>

        {/* Skill Review Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-xs text-muted-foreground">
                <th className="py-2.5 px-4 text-left font-medium">Skill</th>
                <th className="py-2.5 px-4 text-center font-medium">Self Rating</th>
                <th className="py-2.5 px-4 text-center font-medium">AI Assessment</th>
                <th className="py-2.5 px-4 text-center font-medium">Manager Decision</th>
                <th className="py-2.5 px-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {review.skill_reviews.map((sr) => (
                <SkillReviewRow key={sr.skill_id} entry={sr} skillName={skillMap.get(sr.skill_id)?.skill_name ?? 'Unknown'} reviewId={review.id} isCompleted={isCompleted} />
              ))}
            </tbody>
          </table>
        </div>

        {/* AI Feedback Details Toggle */}
        {attempt && assessment && (
          <div className="px-5 py-3 border-t border-border">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setDetailsOpen(!detailsOpen)}>
              <Eye size={12} /> {detailsOpen ? 'Hide' : 'View'} AI Feedback Details
            </Button>
            {detailsOpen && (
              <div className="mt-3 space-y-3">
                {attempt.ai_evaluations.map((ev) => {
                  const q = assessment.assessment_questions.find((aq) => aq.question_id === ev.question_id);
                  return (
                    <div key={ev.question_id} className="rounded-lg border border-border p-3 bg-muted/20">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="secondary" className="text-xs">{skillMap.get(q?.skill_id ?? '')?.skill_name ?? 'Skill'}</Badge>
                        <span className="text-xs text-muted-foreground">Score: {ev.score}%</span>
                      </div>
                      <p className="text-xs text-foreground">{ev.feedback}</p>
                      {ev.dimensions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {ev.dimensions.map((d) => <span key={d.dimension} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{d.dimension}: {d.score}%</span>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Finalize Section */}
        {!isCompleted && (
          <div className="px-5 py-4 border-t border-border space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Overall Comment</Label>
              <Textarea value={overallComment} onChange={(e) => setOverallComment(e.target.value)} rows={3} placeholder="Add overall review notes..." className="text-sm" />
            </div>
            {hasReassess && (
              <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
                <AlertTriangle size={14} /> Skills marked for reassessment will not generate official registry entries.
              </div>
            )}
            <div className="flex justify-end">
              <Button size="sm" disabled={!allActioned} onClick={() => setConfirmFinalize(true)} className="gap-1.5"><Send size={14} /> Finalize Review</Button>
            </div>
            {!allActioned && <p className="text-xs text-muted-foreground text-right">Action required on all skills before finalizing.</p>}
          </div>
        )}

        {isCompleted && review.overall_comment && (
          <div className="px-5 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground"><span className="font-medium">Manager Notes:</span> "{review.overall_comment}"</p>
          </div>
        )}

        {isCompleted && (
          <div className="px-5 py-3 border-t border-border bg-success/5">
            <p className="text-xs text-success font-medium">✓ Review finalized · Official registry entries generated · Completed {review.completed_at ? new Date(review.completed_at).toLocaleDateString() : ''}</p>
          </div>
        )}
      </div>

      <AlertDialog open={confirmFinalize} onOpenChange={setConfirmFinalize}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize Review?</AlertDialogTitle>
            <AlertDialogDescription>This will generate official skill registry entries for {review.employee_name}. Approved and adjusted skills will be recorded. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalize}>Confirm & Finalize</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Reviewer</DialogTitle>
            <DialogDescription>Select a new reviewer for {review.employee_name}'s assessment. The new reviewer will be notified.</DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Label className="text-xs text-muted-foreground mb-2 block">Select Reviewer</Label>
            <SearchableSelect
              options={tenantUsers}
              value={selectedReviewer}
              onValueChange={setSelectedReviewer}
              placeholder="Search users..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReassignOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleReassign}>Assign Reviewer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
