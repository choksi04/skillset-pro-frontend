import { eligibleDomainSkillIds } from "@/lib/domainSkillCount";
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDomainStore } from '@/stores/domainStore';
import { useSkillStore } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SearchableSelect from '@/components/ui/searchable-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import DomainFormDialog from '@/components/domains/DomainFormDialog';
import DomainSkillManager from '@/components/domains/DomainSkillManager';
import {
  ArrowLeft, Pencil, Users, UserCircle, FolderOpen, Settings2, Crown,
  Search, Plus, UserMinus, X, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUserId } from '@/lib/audit';

interface DomainUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
}

export default function DomainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { domains, mappings, fetchDomains, updateDomain, removeMapping, checkDomainDeletable, deleteDomain } = useDomainStore();
  const { skills, categories, fetchSkills, initialized: skillsInitialized } = useSkillStore();
  const initialized = skillsInitialized;
  const { currentRole, user: authUser, refreshUser } = useAuth();
  const isAdmin = currentRole === 'admin';

  const [editOpen, setEditOpen] = useState(false);
  const [manageSkillsOpen, setManageSkillsOpen] = useState(false);
  const [domainUsers, setDomainUsers] = useState<DomainUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [removeTarget, setRemoveTarget] = useState<DomainUser | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [unassignedUsers, setUnassignedUsers] = useState<DomainUser[]>([]);
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [addingUsers, setAddingUsers] = useState(false);
  const [removeSkillTarget, setRemoveSkillTarget] = useState<{ mappingId: string; skillName: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCheck, setDeleteCheck] = useState<{ deletable: boolean; reason?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [leadChangeOpen, setLeadChangeOpen] = useState(false);
  const [pendingLeadChange, setPendingLeadChange] = useState<string | null>(null);

  useEffect(() => { fetchDomains(); fetchSkills(); }, [fetchDomains, fetchSkills]);

  const fetchDomainUsers = useCallback(async () => {
    if (!id) return;
    setUsersLoading(true);
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, role, status')
      .eq('domain_id', id)
      .is('deleted_on', null)
      .order('full_name');
    setDomainUsers((data as unknown as DomainUser[]) || []);
    setUsersLoading(false);
  }, [id]);

  useEffect(() => { fetchDomainUsers(); }, [fetchDomainUsers]);

  const domain = domains.find((d) => d.id === id);
  const currentMappings = useMemo(() => mappings.filter((m) => m.domain_id === id), [mappings, id]);
  // Count = active, non-deleted linked skills (shared rule); disabled ones stay listed with their status.
  const eligibleCount = useMemo(() => eligibleDomainSkillIds(id ?? '', mappings, skills).size, [id, mappings, skills]);

  const mappedByCategory = useMemo(() => {
    const q = skillSearch.toLowerCase();
    const catNameById = new Map(categories.map((c) => [c.id, c.name]));
    const map = new Map<string, { name: string; skills: Array<typeof skills[0] & { mappingId: string }> }>();
    currentMappings.forEach((m) => {
      const skill = skills.find((s) => s.id === m.skill_id);
      if (!skill) return;
      const catId = skill.category_id || '__uncategorised__';
      const catName = catNameById.get(skill.category_id) || 'Uncategorized';
      if (q && !skill.skill_name.toLowerCase().includes(q) && !catName.toLowerCase().includes(q)) return;
      if (!map.has(catId)) map.set(catId, { name: catName, skills: [] });
      map.get(catId)!.skills.push({ ...skill, mappingId: m.id });
    });
    return map;
  }, [currentMappings, skills, categories, skillSearch]);

  const domainLead = useMemo(() => {
    if (!domain?.domain_lead_id) return null;
    return domainUsers.find((u) => u.id === domain.domain_lead_id) || null;
  }, [domain?.domain_lead_id, domainUsers]);

  const eligibleLeads = useMemo(
    () => domainUsers.filter((u) => u.status === 'active'),
    [domainUsers]
  );

  const isDomainLead = !!authUser && !!domain?.domain_lead_id && authUser.id === domain.domain_lead_id;
  const canManage = isAdmin || isDomainLead;

  const filteredDomainUsers = useMemo(() => {
    if (!userSearch) return domainUsers;
    const q = userSearch.toLowerCase();
    return domainUsers.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [domainUsers, userSearch]);

  const handleSetLead = async (userId: string) => {
    const leadId = userId === 'none' ? null : userId;
    const previousLeadId = domain?.domain_lead_id ?? null;
    await updateDomain(id!, { domain_lead_id: leadId } as any);

    // Auto-promote newly assigned lead to manager role if currently employee
    if (leadId) {
      const target = domainUsers.find((u) => u.id === leadId);
      if (target && target.role === 'employee') {
        const auditId = getCurrentUserId();
        await supabase.from('users').update({
          role: 'manager', modified_by: auditId, modified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', leadId);
        await fetchDomainUsers();
        if (authUser?.id === leadId) await refreshUser();
      }
    }

    // Auto-demote previous lead back to employee if they no longer lead ANY domain
    // and their role was auto-promoted to manager (i.e. currently 'manager').
    if (previousLeadId && previousLeadId !== leadId) {
      const { data: stillLeads } = await supabase
        .from('domains')
        .select('id')
        .eq('domain_lead_id', previousLeadId)
        .is('deleted_on', null)
        .limit(1);
      const hasOtherDomains = (stillLeads?.length ?? 0) > 0;
      if (!hasOtherDomains) {
        const { data: prevUser } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', previousLeadId)
          .maybeSingle();
        if (prevUser && prevUser.role === 'manager') {
          const auditId = getCurrentUserId();
          await supabase.from('users').update({
            role: 'employee',
            modified_by: auditId,
            modified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', previousLeadId);
          await fetchDomainUsers();
          if (authUser?.id === previousLeadId) await refreshUser();
          toast.info('Previous domain lead was demoted to Employee (no other domains led).');
        }
      }
    }

    toast.success(leadId ? 'Domain lead assigned.' : 'Domain lead removed.');
  };

  const handleConfirmLeadChange = async () => {
    if (!pendingLeadChange) return;
    await handleSetLead(pendingLeadChange);
    setPendingLeadChange(null);
    setLeadChangeOpen(false);
  };

  const handleRemoveUser = async () => {
    if (!removeTarget) return;
    const userId = getCurrentUserId();
    const { error } = await supabase.from('users').update({
      domain_id: null, modified_by: userId, modified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', removeTarget.id);
    if (error) { toast.error('Failed to remove user.'); }
    else { toast.success(`${removeTarget.full_name} removed from domain.`); }
    setRemoveTarget(null);
    fetchDomainUsers();
  };

  const fetchUnassigned = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, role, status')
      .is('domain_id', null)
      .is('deleted_on', null)
      .eq('status', 'active')
      .order('full_name');
    setUnassignedUsers((data as unknown as DomainUser[]) || []);
  };

  const handleOpenAddUser = () => {
    setSelectedUserIds(new Set());
    setUnassignedSearch('');
    fetchUnassigned();
    setAddUserOpen(true);
  };

  const handleAddUsers = async () => {
    if (selectedUserIds.size === 0) return;
    setAddingUsers(true);
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    try {
      for (const uid of selectedUserIds) {
        await supabase.from('users').update({
          domain_id: id, modified_by: userId, modified_at: now, updated_at: now,
        }).eq('id', uid);
      }
      toast.success(`${selectedUserIds.size} user(s) added to domain.`);
      setAddUserOpen(false);
      fetchDomainUsers();
    } finally {
      setAddingUsers(false);
    }
  };

  const handleRemoveSkill = async () => {
    if (!removeSkillTarget) return;
    try {
      await removeMapping(removeSkillTarget.mappingId);
      await fetchDomains({ force: true });
      toast.success(`Skill "${removeSkillTarget.skillName}" removed from domain.`);
      setRemoveSkillTarget(null);
    } catch (err) {
      console.error('Failed to remove skill mapping:', err);
      toast.error('Failed to remove skill from domain. Please try again.');
    }
  };

  const handleOpenDelete = async () => {
    const result = await checkDomainDeletable(id!);
    setDeleteCheck(result);
    setDeleteOpen(true);
  };

  const handleDeleteDomain = async () => {
    setDeleting(true);
    const success = await deleteDomain(id!);
    setDeleting(false);
    if (success) {
      toast.success('Domain deleted successfully.');
      navigate('/domains');
    } else {
      toast.error('Failed to delete domain.');
    }
    setDeleteOpen(false);
  };

  const filteredUnassigned = useMemo(() => {
    if (!unassignedSearch) return unassignedUsers;
    const q = unassignedSearch.toLowerCase();
    return unassignedUsers.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [unassignedUsers, unassignedSearch]);

  // Not found
  if (!domain && initialized) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/domains')} className="gap-1.5">
          <ArrowLeft size={14} /> Back to Domains
        </Button>
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Domain not found.
        </div>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header — matches CategoryDetailPage pattern */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/domains')} className="gap-1.5 mb-3 -ml-2">
          <ArrowLeft size={14} /> Domains
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-foreground">{domain.name}</h2>
              <Badge
                variant={domain.status === 'active' ? 'default' : 'outline'}
                className={`text-xs capitalize ${domain.status === 'active' ? 'bg-success/15 text-success border-success/20' : 'text-muted-foreground'}`}
              >
                {domain.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {domain.description || 'No description provided.'}
            </p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
                <Pencil size={14} /> Edit
              </Button>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={handleOpenDelete} className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30">
                  <Trash2 size={14} /> Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Domain Lead */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Crown size={14} className="text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Domain Lead:</span>
        </div>
        {domainLead ? (
          <span className="text-sm font-medium text-card-foreground">{domainLead.full_name}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">No lead assigned</span>
        )}
        {canManage && (
          <SearchableSelect
            value={domain.domain_lead_id ?? 'none'}
            onValueChange={(val) => {
              const current = domain.domain_lead_id ?? 'none';
              if (val !== current) {
                setPendingLeadChange(val);
                setLeadChangeOpen(true);
              }
            }}
            placeholder="Assign lead…"
            className="h-7 text-xs w-[200px] ml-auto"
            options={[
              { value: 'none', label: 'No lead' },
              ...eligibleLeads.map((u) => ({ value: u.id, label: `${u.full_name} (${u.role})` })),
            ]}
          />
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <Users size={14} /> Users ({domainUsers.length})
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1.5">
            <FolderOpen size={14} /> Skills ({eligibleCount})
          </TabsTrigger>
        </TabsList>

        {/* ─── Users Tab ─── */}
        <TabsContent value="users">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-b border-border">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              {canManage && (
                <Popover open={addUserOpen} onOpenChange={setAddUserOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" className="gap-1.5" onClick={handleOpenAddUser}>
                      <Plus size={14} /> Add User
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-3 border-b border-border">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search unassigned users..."
                          value={unassignedSearch}
                          onChange={(e) => setUnassignedSearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredUnassigned.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No unassigned users found.</p>
                      ) : (
                        filteredUnassigned.map((u) => (
                          <label
                            key={u.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedUserIds.has(u.id)}
                              onCheckedChange={(checked) => {
                                setSelectedUserIds((prev) => {
                                  const next = new Set(prev);
                                  checked ? next.add(u.id) : next.delete(u.id);
                                  return next;
                                });
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{u.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] capitalize shrink-0">{u.role}</Badge>
                          </label>
                        ))
                      )}
                    </div>
                    {selectedUserIds.size > 0 && (
                      <div className="p-3 border-t border-border">
                        <Button size="sm" className="w-full" onClick={handleAddUsers} disabled={addingUsers}>
                          {addingUsers ? 'Adding...' : `Add ${selectedUserIds.size} User(s)`}
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {usersLoading ? (
              <div className="p-4"><Skeleton className="h-20 w-full rounded-lg" /></div>
            ) : filteredDomainUsers.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <UserCircle size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                <p>{userSearch ? 'No matching users.' : 'No users assigned to this domain yet.'}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[100px]">Role</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    {canManage && <TableHead className="w-[70px] text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDomainUsers.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium text-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {u.id === domain.domain_lead_id && <Crown size={12} className="text-primary" />}
                          {u.full_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${u.status === 'active' ? 'text-success border-success/30' : 'text-muted-foreground'}`}
                        >
                          {u.status}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <button
                            onClick={() => setRemoveTarget(u)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors ml-auto"
                            title="Remove from domain"
                          >
                            <UserMinus size={14} />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ─── Skills Tab ─── */}
        <TabsContent value="skills">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-b border-border">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search skills..." value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setManageSkillsOpen(true)} className="gap-1.5">
                  <Settings2 size={14} /> Manage Skills
                </Button>
              )}
            </div>

            {currentMappings.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <FolderOpen size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                <p>No skills mapped yet.</p>
                {canManage && <p className="mt-1">Click "Manage Skills" to start mapping.</p>}
              </div>
            ) : !skillsInitialized ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : mappedByCategory.size === 0 && skillSearch ? (
              <div className="text-center py-10 text-sm text-muted-foreground">No matching skills.</div>
            ) : mappedByCategory.size === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">Skills data unavailable. Try refreshing.</div>
            ) : (
              <div className="p-4 space-y-4">
                {Array.from(mappedByCategory.entries()).map(([catId, { name: catName, skills: catSkills }]) => (
                  <div key={catId}>
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen size={14} className="text-primary shrink-0" />
                      <h3 className="text-sm font-semibold text-card-foreground">{catName}</h3>
                      <Badge variant="secondary" className="text-xs">{catSkills.length}</Badge>
                    </div>
                    <div className="ml-6 border border-border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Skill Name</TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead className="w-[80px]">Status</TableHead>
                            {canManage && <TableHead className="w-[70px] text-right">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catSkills.map((skill) => (
                            <TableRow key={skill.id} className="hover:bg-muted/50 transition-colors">
                              <TableCell className="font-medium text-foreground whitespace-nowrap">{skill.skill_name}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  {skill.tags && skill.tags.length > 0 ? skill.tags.slice(0, 3).map((t) => (
                                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                                  )) : <span className="text-xs text-muted-foreground">—</span>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] ${skill.status === 'active' ? 'text-success border-success/30' : 'text-muted-foreground'}`}>
                                  {skill.status}
                                </Badge>
                              </TableCell>
                              {canManage && (
                                <TableCell className="text-right">
                                  <button
                                    onClick={() => setRemoveSkillTarget({ mappingId: skill.mappingId, skillName: skill.skill_name })}
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors ml-auto"
                                    title="Remove skill"
                                  >
                                    <X size={14} />
                                  </button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <DomainFormDialog open={editOpen} onOpenChange={setEditOpen} editDomain={domain} />
      <DomainSkillManager domainId={id!} open={manageSkillsOpen} onOpenChange={setManageSkillsOpen} />

      {/* Remove User Confirm */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User from Domain</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{removeTarget?.full_name}</strong> from this domain?
              They will no longer have access to domain-specific features until reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveUser}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Skill Confirm */}
      <AlertDialog open={!!removeSkillTarget} onOpenChange={(open) => { if (!open) setRemoveSkillTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Skill from Domain</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unmap <strong>{removeSkillTarget?.skillName}</strong> from this domain?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveSkill}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Domain Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!open) setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Domain</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCheck?.deletable
                ? <>Are you sure you want to delete <strong>{domain?.name}</strong>? This action cannot be undone.</>
                : deleteCheck?.reason || 'Cannot delete this domain.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteCheck?.deletable && (
              <AlertDialogAction
                onClick={handleDeleteDomain}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Domain Lead Confirm */}
      <AlertDialog open={leadChangeOpen} onOpenChange={(open) => { if (!open) { setLeadChangeOpen(false); setPendingLeadChange(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingLeadChange === 'none' ? 'Remove Domain Lead?' : 'Change Domain Lead?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingLeadChange === 'none'
                ? 'Are you sure you want to remove the current domain lead?'
                : (
                    <>
                      Are you sure you want to assign{' '}
                      <strong>
                        {eligibleLeads.find((u) => u.id === pendingLeadChange)?.full_name || 'this user'}
                      </strong>{' '}
                      as the domain lead?
                    </>
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingLeadChange(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeadChange}>
              {pendingLeadChange === 'none' ? 'Remove Lead' : 'Assign Lead'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
