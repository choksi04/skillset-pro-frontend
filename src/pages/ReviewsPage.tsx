import { useState, useMemo, useEffect } from 'react';
import { useReviewStore, ManagerReview, SkillReviewEntry } from '@/stores/reviewStore';
import { useSkillStore } from '@/stores/skillStore';
import { useDomainStore } from '@/stores/domainStore';
import { useAttemptStore } from '@/stores/attemptStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
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
  ClipboardCheck, CheckCircle, MessageSquare,
  ChevronDown, ChevronUp, Bell, Eye, ShieldCheck, Shield, UserCog,
} from 'lucide-react';

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
  const { setVerifiedLevel, setSkillComment } = useReviewStore();
  const { levels } = useCompetencyLevelStore();
  const ratingLabels = getRatingLabels(levels);
  const [commentOpen, setCommentOpen] = useState(false);

  const isAdjusted = entry.verified_level !== entry.ai_calculated_level;

  const handleLevelChange = (val: string) => {
    const level = Number(val);
    setVerifiedLevel(reviewId, entry.skill_id, level);
    if (level !== entry.ai_calculated_level) {
      toast.success(`${skillName}: Level adjusted to L${level}`);
    }
  };

  const saveComment = (comment: string) => {
    setSkillComment(reviewId, entry.skill_id, comment);
    setCommentOpen(false);
    toast.success('Comment saved');
  };

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
          {isCompleted ? (
            <div className="flex flex-col items-center gap-1">
              <Badge className={`text-xs ${getLevelColorClass(entry.verified_level)}`}>L{entry.verified_level}</Badge>
              {isAdjusted && <span className="text-[10px] text-muted-foreground">adjusted</span>}
            </div>
          ) : (
            <Select value={String(entry.verified_level)} onValueChange={handleLevelChange}>
              <SelectTrigger className="h-8 w-[140px] mx-auto text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((l) => (
                  <SelectItem key={l} value={String(l)} className="text-xs">{getFormattedLevelLabel(levels, l)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </td>
        <td className="py-3 px-4">
          {!isCompleted ? (
            <div className="flex items-center gap-1 justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setCommentOpen(true)}>
                <MessageSquare size={12} /> {entry.manager_comment ? 'Edit Comment' : 'Add Comment'}
              </Button>
            </div>
          ) : entry.manager_comment ? (
            <p className="text-xs text-muted-foreground italic text-right">"{entry.manager_comment}"</p>
          ) : (
            <span className="text-xs text-muted-foreground flex justify-end">—</span>
          )}
        </td>
      </tr>

      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Comment — {skillName}</DialogTitle><DialogDescription>Add your review notes for this skill.</DialogDescription></DialogHeader>
          <CommentInput initial={entry.manager_comment} onSave={saveComment} onCancel={() => setCommentOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReviewCard({ review }: { review: ManagerReview }) {
  const { skills } = useSkillStore();
  const { domains } = useDomainStore();
  const { verifyReview, reassignReviewer } = useReviewStore();
  const { currentRole } = useAuth();
  const currentCycle = useRegistryStore.getState().currentCycle || '';
  const { getAttemptForAssessment } = useAttemptStore();
  const { assessments } = useAssessmentStore();

  const [expanded, setExpanded] = useState(review.status !== 'completed');
  const [overallComment, setOverallComment] = useState(review.overall_comment);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<{ value: string; label: string }[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [reviewerName, setReviewerName] = useState<string | null>(null);

  const domain = domains.find((d) => d.id === review.domain_id);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const attempt = getAttemptForAssessment(review.assessment_id);
  const assessment = assessments.find((a) => a.id === review.assessment_id);

  const isCompleted = review.status === 'completed';
  const isAdmin = currentRole === 'admin';

  useEffect(() => {
    const loadReviewerName = async () => {
      const { data } = await supabase.from('users').select('full_name').eq('id', review.reviewer_id).single();
      if (data) setReviewerName(data.full_name);
    };
    loadReviewerName();
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

  const handleVerify = () => {
    const { setOverallComment: setComment } = useReviewStore.getState();
    setComment(review.id, overallComment);
    verifyReview(review.id, currentCycle);
    setConfirmVerify(false);
    toast.success('Review verified. Official skill registry entries generated.');
  };

  const statusBadge = {
    pending: <Badge className="bg-warning/15 text-warning border-warning/20 text-xs gap-1"><Bell size={10} /> Pending Review</Badge>,
    in_progress: <Badge className="bg-info/15 text-info border-info/20 text-xs gap-1"><Eye size={10} /> In Progress</Badge>,
    completed: <Badge className="bg-success/15 text-success border-success/20 text-xs gap-1"><Shield size={10} /> Verified</Badge>,
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
              Reviewer: {reviewerName ?? '...'}{review.reviewer_id === review.employee_id && ' (Self-Review)'}
              {' · '}Submitted: {attempt?.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : 'N/A'}
              {review.completed_at && ` · Verified: ${new Date(review.completed_at).toLocaleString()}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && !isCompleted && (
              <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={(e) => { e.stopPropagation(); openReassignDialog(); }}>
                <UserCog size={12} /> Change Reviewer
              </Button>
            )}
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
                    <th className="py-2.5 px-4 text-center font-medium">Verified Level</th>
                    <th className="py-2.5 px-4 text-right font-medium">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {review.skill_reviews.map((sr) => (
                    <SkillReviewRow key={sr.skill_id} entry={sr} skillName={skillMap.get(sr.skill_id)?.skill_name ?? 'Unknown'} reviewId={review.id} isCompleted={isCompleted} />
                  ))}
                </tbody>
              </table>
            </div>



            {!isCompleted && (
              <div className="px-5 py-4 border-t border-border space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Overall Comment</Label>
                  <Textarea value={overallComment} onChange={(e) => setOverallComment(e.target.value)} rows={3} placeholder="Add overall review notes..." className="text-sm" />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setConfirmVerify(true)} className="gap-1.5"><ShieldCheck size={14} /> Mark Verified</Button>
                </div>
              </div>
            )}

            {isCompleted && review.overall_comment && (
              <div className="px-5 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground"><span className="font-medium">Manager Notes:</span> "{review.overall_comment}"</p>
              </div>
            )}

            {isCompleted && (
              <div className="px-5 py-3 border-t border-border bg-success/5">
                <p className="text-xs text-success font-medium">✓ Review verified · Official registry entries generated · {review.completed_at ? new Date(review.completed_at).toLocaleDateString() : ''}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={confirmVerify} onOpenChange={setConfirmVerify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Review as Verified?</AlertDialogTitle>
            <AlertDialogDescription>This will record the verified levels for {review.employee_name} as official skill registry entries. The verified score becomes the final score for each skill. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVerify}>Confirm & Verify</AlertDialogAction>
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
        <p className="text-sm text-muted-foreground">Review AI-evaluated assessment results, adjust skill levels, and mark reviews as verified to record official registry entries.</p>
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
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><CheckCircle size={14} className="text-success" /> Verified Reviews ({completedReviews.length})</h2>
          {completedReviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}
    </div>
  );
}
