import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTemplateStore, AssessmentTemplate } from '@/stores/templateStore';
import { useDomainStore } from '@/stores/domainStore';
import { useAssignmentStore } from '@/stores/assignmentStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect from '@/components/ui/searchable-select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertCircle, Loader2, Search, UserCheck, UsersRound } from 'lucide-react';
import { toast } from 'sonner';

interface UserLite {
  id: string;
  full_name: string;
  email: string;
  domain_id: string | null;
  role: string;
}

interface AssignTemplateDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: AssessmentTemplate | null;
  /** Pre-select a specific template via picker if this is null */
  showTemplatePicker?: boolean;
}

export default function AssignTemplateDialog({
  open, onOpenChange, template: initialTemplate, showTemplatePicker,
}: AssignTemplateDialogProps) {
  const { templates, fetchTemplates } = useTemplateStore();
  const { domains, fetchDomains } = useDomainStore();
  const { assignments, fetchAssignments, getActiveAssignmentsForEmployee, createAssignments } = useAssignmentStore();
  const { user, currentRole } = useAuth();

  const [templateId, setTemplateId] = useState<string>('');
  const [mode, setMode] = useState<'domain' | 'users'>('domain');
  const [pickedDomain, setPickedDomain] = useState<string>('');
  const [pickedUsers, setPickedUsers] = useState<Set<string>>(new Set());
  const [overrideDuplicates, setOverrideDuplicates] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const template = useMemo(() => {
    if (initialTemplate && !showTemplatePicker) return initialTemplate;
    return templates.find((t) => t.id === templateId) ?? null;
  }, [initialTemplate, showTemplatePicker, templates, templateId]);

  // Init when sheet opens
  useEffect(() => {
    if (!open) return;
    fetchTemplates();
    fetchDomains();
    fetchAssignments();
    setSearch('');
    setOverrideDuplicates(false);
    setPickedUsers(new Set());
    if (initialTemplate) {
      setTemplateId(initialTemplate.id);
      setPickedDomain(initialTemplate.domain_id ?? '');
      setMode(initialTemplate.type === 'adaptive' ? 'domain' : 'users');
    } else {
      setTemplateId('');
      setPickedDomain('');
      setMode('domain');
    }
    // Fetch users (managers only see their domain). Self IS included.
    (async () => {
      const q = supabase.from('users').select('id, full_name, email, domain_id, role').eq('status', 'active');
      const { data } = await q;
      let rows = (data || []) as UserLite[];
      if (currentRole === 'manager' && user?.domain_id) {
        rows = rows.filter((u) => u.domain_id === user.domain_id);
      }
      setUsers(rows);
    })();
  }, [open, initialTemplate?.id]);

  const activeTemplates = useMemo(() => templates.filter((t) => t.status === 'active'), [templates]);

  const candidateUsers = useMemo(() => {
    let list = users;
    if (mode === 'domain') {
      if (!pickedDomain) return [];
      list = list.filter((u) => u.domain_id === pickedDomain);
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return list;
  }, [users, mode, pickedDomain, search]);

  const toggleUser = (id: string) => {
    setPickedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visibleIds = useMemo(() => candidateUsers.map((u) => u.id), [candidateUsers]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => pickedUsers.has(id));

  const toggleSelectAll = () => {
    setPickedUsers((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Duplicate detection
  const duplicates = useMemo(() => {
    if (!template) return new Set<string>();
    const dup = new Set<string>();
    for (const uid of pickedUsers) {
      if (getActiveAssignmentsForEmployee(template.id, uid)) dup.add(uid);
    }
    return dup;
  }, [pickedUsers, template, assignments]);

  const newCount = pickedUsers.size - duplicates.size;
  const skippedCount = overrideDuplicates ? 0 : duplicates.size;

  const blocker = useMemo(() => {
    if (!template) return 'Select a template';
    if (template.status !== 'active') return 'Template must be activated before assigning';
    if (pickedUsers.size === 0) return 'Pick at least one employee';
    return null;
  }, [template, pickedUsers]);

  const handleAssign = async () => {
    if (!template || blocker) return;
    setSubmitting(true);
    const result = await createAssignments({
      template_id: template.id,
      employee_ids: [...pickedUsers],
      domain_id: mode === 'domain' ? pickedDomain : null,
      overrideDuplicates,
    });
    setSubmitting(false);

    const parts: string[] = [];
    if (result.created.length) parts.push(`${result.created.length} assigned`);
    if (result.skipped.length) parts.push(`${result.skipped.length} skipped`);
    if (result.failed.length) parts.push(`${result.failed.length} failed`);

    if (result.created.length > 0) toast.success(parts.join(' · '));
    else toast.error(parts.join(' · ') || 'No assignments created');

    if (result.failed.length > 0) {
      console.warn('Failed assignments:', result.failed);
      const reasons = [...new Set(result.failed.map((f) => f.reason))];
      reasons.slice(0, 2).forEach((r) => toast.error(r));
    }

    if (result.created.length > 0) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[560px] p-0 flex flex-col h-full"
      >
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <UserCheck size={16} className="text-primary" /> Assign Assessment
          </SheetTitle>
          <SheetDescription className="text-xs">
            Send an assessment to selected employees. Each one will be notified and the assessment will appear in their list.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {showTemplatePicker && (
            <div className="space-y-1.5">
              <Label className="text-xs">Template *</Label>
              <SearchableSelect
                value={templateId}
                onValueChange={setTemplateId}
                placeholder="Select an active template"
                className="w-full h-10"
                options={activeTemplates.map((t) => ({ value: t.id, label: t.name }))}
              />
              {activeTemplates.length === 0 && (
                <p className="text-xs text-muted-foreground">No active templates available.</p>
              )}
            </div>
          )}

          {template && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{template.name}</span>
                <Badge variant="outline" className="text-[10px] capitalize">{template.type}</Badge>
                <Badge variant="outline" className="text-[10px]">{template.duration_minutes} min</Badge>
                <Badge variant="outline" className="text-[10px]">max {template.max_attempts} attempt{template.max_attempts > 1 ? 's' : ''}</Badge>
              </div>
              {template.type === 'adaptive' && (
                <p className="text-[11px] text-muted-foreground">
                  Adaptive — uses the employee's latest registry submission when available, otherwise falls back to domain skills.
                </p>
              )}
            </div>
          )}

          {template && template.status !== 'active' && (
            <div className="flex items-start gap-2 rounded-md bg-warning/10 border border-warning/20 p-2.5">
              <AlertCircle size={14} className="text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-warning">This template is in draft. Activate it before you can assign.</p>
            </div>
          )}

          {template && template.status === 'active' && (
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'domain' | 'users')}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="domain" className="text-xs gap-1.5">
                  <UsersRound size={13} /> By Domain
                </TabsTrigger>
                <TabsTrigger value="users" className="text-xs gap-1.5">
                  <UserCheck size={13} /> Specific Users
                </TabsTrigger>
              </TabsList>

              <TabsContent value="domain" className="space-y-3 mt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Domain</Label>
                  <SearchableSelect
                    value={pickedDomain}
                    onValueChange={setPickedDomain}
                    placeholder="Select a domain"
                    className="w-full h-10"
                    options={domains.map((d) => ({ value: d.id, label: d.name }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="users" className="space-y-3 mt-3">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </TabsContent>

              {/* Select All toolbar */}
              <div className="flex items-center justify-between mt-3 px-1">
                <span className="text-[11px] text-muted-foreground">
                  {pickedUsers.size} of {candidateUsers.length} selected
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={candidateUsers.length === 0}
                  onClick={toggleSelectAll}
                >
                  {allVisibleSelected ? 'Deselect all' : 'Select all'}
                </Button>
              </div>

              {/* Candidate list */}
              <div className="rounded-lg border border-border mt-2">
                {candidateUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-4 text-center">
                    {mode === 'domain' && !pickedDomain ? 'Select a domain to see candidates.' : 'No matching users.'}
                  </p>
                ) : (
                  candidateUsers.map((u) => {
                    const isDup = !!getActiveAssignmentsForEmployee(template.id, u.id);
                    const isSelf = u.id === user?.id;
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                      >
                        <Checkbox
                          checked={pickedUsers.has(u.id)}
                          onCheckedChange={() => toggleUser(u.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
                            {u.full_name}
                            {isSelf && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/30 text-primary">
                                You
                              </Badge>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        {isDup && (
                          <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                            Already assigned
                          </Badge>
                        )}
                      </label>
                    );
                  })
                )}
              </div>

              {duplicates.size > 0 && (
                <label className="flex items-center gap-2 text-xs text-foreground mt-3">
                  <Checkbox checked={overrideDuplicates} onCheckedChange={(v) => setOverrideDuplicates(!!v)} />
                  Re-assign even if employee already has an active assignment ({duplicates.size})
                </label>
              )}
            </Tabs>
          )}

          {template && pickedUsers.size > 0 && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{newCount}</span> new assignment{newCount === 1 ? '' : 's'} will be created
              {skippedCount > 0 && <> · <span className="text-warning">{skippedCount} skipped</span></>}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="border-t bg-background px-6 py-3 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!!blocker || submitting}>
            {submitting ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
            Assign
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
