import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAssignmentStore, assignmentStatusConfig } from '@/stores/assignmentStore';
import { AssessmentTemplate } from '@/stores/templateStore';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: AssessmentTemplate | null;
}

export default function TemplateAssignmentsSheet({ open, onOpenChange, template }: Props) {
  const navigate = useNavigate();
  const { assignments, fetchAssignments, getAssignmentsForTemplate, revokeAssignment } = useAssignmentStore();
  const [names, setNames] = useState<Record<string, string>>({});

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

  const handleRevoke = async (id: string) => {
    try {
      await revokeAssignment(id);
      toast.success('Assignment revoked');
    } catch {
      toast.error('Failed to revoke');
    }
  };

  return (
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
                    {a.status === 'new' && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleRevoke(a.id)}
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
  );
}
