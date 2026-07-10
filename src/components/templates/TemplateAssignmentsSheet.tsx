import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAssignmentStore, assignmentStatusConfig } from '@/stores/assignmentStore';
import { AssessmentTemplate } from '@/stores/templateStore';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ExternalLink, Loader2, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: AssessmentTemplate | null;
}

export default function TemplateAssignmentsSheet({ open, onOpenChange, template }: Props) {
  const navigate = useNavigate();
  const { assignments, fetchAssignments, getAssignmentsForTemplate, revokeAssignment, revokeAssessment } =
    useAssignmentStore();
  const [names, setNames] = useState<Record<string, string>>({});
  const [revokeFor, setRevokeFor] = useState<{ id: string; assessmentId: string | null; name: string; started: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (open) fetchAssignments();
  }, [open]);

  const list = useMemo(() => template ? getAssignmentsForTemplate(template.id) : [], [assignments, template]);

  useEffect(() => {
    const ids = [...new Set(list.map((a) => a.employee_id))];
    if (ids.length === 0) return;
    supabase.from('users').select('id, full_name').in('id', ids).then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((u: any) => { map[u.id] = u.full_name; });
      setNames(map);
    });
  }, [list]);

  const submitRevoke = async () => {
    if (!revokeFor) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    setRevoking(true);
    try {
      if (revokeFor.assessmentId) {
        await revokeAssessment(revokeFor.assessmentId, trimmed);
      } else {
        await revokeAssignment(revokeFor.id, trimmed);
      }
      toast.success('Assignment revoked. The template can be re-assigned to this employee.');
      setRevokeFor(null);
      setReason('');
      await fetchAssignments();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base">
              <Users size={15} /> Assignments
            </SheetTitle>
            <SheetDescription>
              {template?.name} — {list.length} assignment{list.length === 1 ? '' : 's'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No assignments yet.</p>
            ) : (
              list.map((a) => {
                const cfg = assignmentStatusConfig[a.status];
                const revoked = a.status === 'revoked';
                return (
                  <div key={a.id} className="rounded-lg border border-border p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {names[a.employee_id] ?? a.employee_id}
                      </p>
                      <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Attempt {a.attempt_count}/{a.max_attempts} · Assigned {new Date(a.assigned_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-1 pt-1">
                      {a.assessment_id && (
                        <Button
                          size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                          onClick={() => { navigate(`/team-assessments/${a.assessment_id}`); onOpenChange(false); }}
                        >
                          <ExternalLink size={11} /> View
                        </Button>
                      )}
                      {!revoked && (
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            setRevokeFor({
                              id: a.id,
                              assessmentId: a.assessment_id ?? null,
                              name: names[a.employee_id] ?? a.employee_id,
                              started: !!a.assessment_id,
                            });
                            setReason('');
                          }}
                        >
                          <Trash2 size={11} /> Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!revokeFor}
        onOpenChange={(o) => { if (!o && !revoking) { setRevokeFor(null); setReason(''); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke assignment?</DialogTitle>
            <DialogDescription>
              {revokeFor?.started
                ? `This soft-deletes ${revokeFor?.name}'s assessment, its attempts, and answers. Progress will be lost. The template can then be re-assigned.`
                : `This removes ${revokeFor?.name}'s assignment for this template so it can be re-assigned.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this assignment being revoked? (e.g. wrong template, buggy questions, stuck in progress)"
            rows={3}
            disabled={revoking}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeFor(null)} disabled={revoking}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={submitRevoke}
              disabled={revoking || !reason.trim()}
              className="gap-1.5"
            >
              {revoking ? <><Loader2 size={14} className="animate-spin" /> Revoking…</> : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
