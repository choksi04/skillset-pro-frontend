import { useState, useMemo, useEffect } from 'react';
import { useReviewStore, ManagerReview, ReviewAction, SkillReviewEntry } from '@/stores/reviewStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { useRegistryStore, ratingLabels, RatingLevel } from '@/stores/registryStore';
import { useCycleStore } from '@/stores/cycleStore';
import { useAuth } from '@/contexts/AuthContext';
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
import { toast } from 'sonner';
import {
  ClipboardCheck, CheckCircle, XCircle, RefreshCw, MessageSquare,
  ChevronDown, ChevronUp, Bell, Eye, Send, Shield, AlertTriangle,
} from 'lucide-react';

const levelLabels: Record<number, string> = {
  1: 'L1 – Basic Awareness', 2: 'L2 – Working Knowledge', 3: 'L3 – Independent', 4: 'L4 – Advanced', 5: 'L5 – Expert',
};
const levelColors: Record<number, string> = {
  1: 'bg-muted text-muted-foreground', 2: 'bg-info/15 text-info', 3: 'bg-accent/15 text-accent', 4: 'bg-warning/15 text-warning', 5: 'bg-success/15 text-success',
};
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

function SkillReviewRow({ entry, skillName, reviewId, isCompleted }: { entry: SkillReviewEntry; skillName: string; reviewId: string; isCompleted: boolean }) {
  const { setSkillAction, setSkillComment } = useReviewStore();
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
        <td className="py-3 px-4 text-center"><Badge variant="outline" className="text-xs">L{entry.self_rating} – {ratingLabels[entry.self_rating]}</Badge></td>
        <td className="py-3 px-4">
          <div className="flex flex-col items-center gap-1">
            <Badge className={`text-xs ${levelColors[entry.ai_calculated_level]}`}>L{entry.ai_calculated_level}</Badge>
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
              <SelectContent>{[1, 2, 3, 4, 5].map((l) => <SelectItem key={l} value={String(l)}>{levelLabels[l]}</SelectItem>)}</SelectContent>
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

function ReviewCard({ review }: { review: ManagerReview }) {
  const { skills } = useSkillStore();
  const { domains } = useDomainStore();
  const { completeReview } = useReviewStore();
  const { activeCycle } = useCycleStore();
  const currentCycle = activeCycle?.name || useRegistryStore.getState().currentCycle;
  const { getAttemptForAssessment } = useAttemptStore();
  const { assessments } = useAssessmentStore();

  const [expanded, setExpanded] = useState(review.status !== 'completed');
  const [overallComment, setOverallComment] = useState(review.overall_comment);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const domain = domains.find((d) => d.id === review.domain_id);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const attempt = getAttemptForAssessment(review.assessment_id);
  const assessment = assessments.find((a) => a.id === review.assessment_id);

  const isCompleted = review.status === 'completed';
  const allActioned = review.skill_reviews.every((sr) => sr.manager_action !== null);
  const hasReassess = review.skill_reviews.some((sr) => sr.manager_action === 'reassess');

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
        <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setExpanded(!expanded)}>
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">{review.employee_name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {domain?.name ?? 'Unknown Domain'} · {review.skill_reviews.length} skills · {attempt?.total_ai_score != null && `AI Score: ${attempt.total_ai_score}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              Submitted: {attempt?.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : 'N/A'}
              {review.completed_at && ` · Reviewed: ${new Date(review.completed_at).toLocaleString()}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge[review.status]}
            {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border">
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
    </>
  );
}

function NotificationPanel() {
  const { notifications, markNotificationRead } = useReviewStore();
  const { currentRole } = useAuth();
  const [open, setOpen] = useState(false);
  const roleNotifications = notifications.filter((n) => n.target_role === currentRole);
  const unread = roleNotifications.filter((n) => !n.read);
  if (roleNotifications.length === 0) return null;

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)} className="gap-1.5 relative">
        <Bell size={14} /> Notifications
        {unread.length > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 text-[10px] flex items-center justify-center">{unread.length}</span>}
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border"><span className="text-xs font-medium text-popover-foreground">Notifications</span></div>
          <div className="max-h-60 overflow-y-auto">
            {roleNotifications.length === 0 ? <p className="text-xs text-muted-foreground p-3">No notifications.</p> : roleNotifications.map((n) => (
              <div key={n.id} className={`px-3 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 ${!n.read ? 'bg-primary/5' : ''}`} onClick={() => markNotificationRead(n.id)}>
                <p className="text-xs text-popover-foreground">{n.message}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  const { reviews, fetchReviews } = useReviewStore();
  const { currentRole, user } = useAuth();
  const { fetchAssessments } = useAssessmentStore();
  const { fetchAttempts } = useAttemptStore();
  const { fetchSkills } = useSkillStore();
  const { fetchDomains } = useDomainStore();
  const { fetchRegistry } = useRegistryStore();

  useEffect(() => {
    fetchAssessments(); fetchAttempts(); fetchReviews(); fetchSkills(); fetchDomains(); fetchRegistry();
  }, [fetchAssessments, fetchAttempts, fetchReviews, fetchSkills, fetchDomains, fetchRegistry]);

  const isManager = currentRole === 'manager' || currentRole === 'admin';

  // Filter reviews: managers see only their domain's reviews, admins see all
  const filteredReviews = useMemo(() => {
    if (currentRole === 'admin') return reviews;
    if (currentRole === 'manager') {
      return reviews.filter((r) => r.reviewer_id === user?.id || r.domain_id === user?.domain_id);
    }
    return [];
  }, [reviews, currentRole, user]);

  const pendingReviews = filteredReviews.filter((r) => r.status !== 'completed');
  const completedReviews = filteredReviews.filter((r) => r.status === 'completed');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Review AI-evaluated assessment results, adjust skill levels, and generate official registry entries.</p>
      </div>

      {!isManager && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Shield size={32} className="mx-auto text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold text-card-foreground">Manager Access Required</h2>
          <p className="text-sm text-muted-foreground mt-1">Only managers and admins can access reviews.</p>
        </div>
      )}

      {isManager && filteredReviews.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <ClipboardCheck size={32} className="text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-1">No Reviews Pending</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">Reviews appear here when employees complete their assessments.</p>
        </div>
      )}

      {isManager && pendingReviews.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Bell size={14} className="text-warning" /> Pending Reviews ({pendingReviews.length})</h2>
          {pendingReviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}

      {isManager && completedReviews.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><CheckCircle size={14} className="text-success" /> Completed Reviews ({completedReviews.length})</h2>
          {completedReviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}
    </div>
  );
}
