import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDomainStore } from '@/stores/domainStore';
import { UserRole } from '@/types/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import SearchableSelect from '@/components/ui/searchable-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Pencil, Shield, Users, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUserId } from '@/lib/audit';

interface UserRow {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string;
  role: string;
  domain_id: string | null;
  department: string;
  designation: string;
  status: string;
  created_at: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
};

export default function UsersPage() {
  const { currentRole, user: authUser } = useAuth();
  const { domains, fetchDomains } = useDomainStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const [form, setForm] = useState({
    full_name: '', email: '', role: 'employee' as string,
    domain_id: '' as string, department: '', designation: '', status: 'active',
  });

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: true });
    if (data) setUsers(data as unknown as UserRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); fetchDomains(); }, [fetchDomains]);

  const filtered = useMemo(() =>
    users.filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchesDomain =
        domainFilter === 'all' ||
        (domainFilter === 'none' ? !u.domain_id : u.domain_id === domainFilter);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesDomain && matchesRole && matchesStatus;
    }), [users, search, domainFilter, roleFilter, statusFilter]);

  const hasActiveFilters = domainFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all';
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  useEffect(() => { setPage(1); }, [search, domainFilter, roleFilter, statusFilter, pageSize]);

  const clearFilters = () => {
    setDomainFilter('all');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: '', email: '', role: 'employee', domain_id: '', department: '', designation: '', status: 'active' });
    setDialogOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      full_name: u.full_name, email: u.email, role: u.role,
      domain_id: u.domain_id ?? '', department: u.department, designation: u.designation, status: u.status,
    });
    setDialogOpen(true);
  };

  const isDomainRequired = form.role === 'employee' || form.role === 'manager';
  const domainMissing = isDomainRequired && !form.domain_id;

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    if (domainMissing) {
      toast.error('Domain is required for employees and managers.');
      return;
    }

    const userId = getCurrentUserId();
    if (editing) {
      const { error } = await supabase.from('users').update({
        full_name: form.full_name.trim(),
        email: form.email.toLowerCase().trim(),
        role: form.role,
        domain_id: form.domain_id || null,
        department: form.department.trim(),
        designation: form.designation.trim(),
        status: form.status,
        updated_at: new Date().toISOString(),
        modified_by: userId,
        modified_at: new Date().toISOString(),
      }).eq('id', editing.id);
      if (error) { toast.error('Failed to update user.'); return; }
      toast.success('User updated.');
    } else {
      const id = `user-${Date.now()}`;
      const { error } = await supabase.from('users').insert({
        id,
        tenant_id: authUser?.tenant_id ?? 'tenant-001',
        full_name: form.full_name.trim(),
        email: form.email.toLowerCase().trim(),
        role: form.role,
        domain_id: form.domain_id || null,
        department: form.department.trim(),
        designation: form.designation.trim(),
        status: form.status,
        created_by: userId,
      });
      if (error) {
        if (error.code === '23505') toast.error('Email already exists.');
        else toast.error('Failed to create user.');
        return;
      }
      toast.success('User created.');
    }
    setDialogOpen(false);
    fetchUsers();
  };

  if (currentRole !== 'admin') {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Shield size={32} className="mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold text-card-foreground">Admin Access Required</h2>
        <p className="text-sm text-muted-foreground mt-1">Only admins can manage users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage users, roles, and domain assignments.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus size={14} /> Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Users', value: users.length, icon: <Users size={18} /> },
          { label: 'Admins', value: users.filter((u) => u.role === 'admin').length },
          { label: 'Managers', value: users.filter((u) => u.role === 'manager').length },
          { label: 'Employees', value: users.filter((u) => u.role === 'employee').length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-semibold mt-1 text-card-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" maxLength={100} />
        </div>
        <SearchableSelect
          value={domainFilter}
          onValueChange={setDomainFilter}
          placeholder="Domain"
          className="w-[180px] h-9 text-sm"
          options={[
            { value: 'all', label: 'All Domains' },
            { value: 'none', label: 'No domain' },
            ...domains.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
        <SearchableSelect
          value={roleFilter}
          onValueChange={setRoleFilter}
          placeholder="Role"
          className="w-[140px] h-9 text-sm"
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'admin', label: 'Admin' },
            { value: 'manager', label: 'Manager' },
            { value: 'employee', label: 'Employee' },
          ]}
        />
        <SearchableSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          placeholder="Status"
          className="w-[140px] h-9 text-sm"
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'disabled', label: 'Disabled' },
          ]}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
            <X size={12} /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="w-[100px]">Role</TableHead>
              <TableHead className="w-[160px]">Domain</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[70px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-40 mb-1.5" />
                    <Skeleton className="h-3 w-56" />
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-7 w-7 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">No users found.</TableCell></TableRow>
            ) : (
              paged.map((u) => {
                const domain = domains.find((d) => d.id === u.domain_id);
                const needsDomain = (u.role === 'employee' || u.role === 'manager') && !u.domain_id;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{roleLabels[u.role] ?? u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {domain ? (
                        <span className="text-muted-foreground">{domain.name}</span>
                      ) : needsDomain ? (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle size={12} /> No domain
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.status === 'active' ? 'default' : 'outline'}
                        className={`text-xs ${u.status === 'active' ? 'bg-success/15 text-success border-success/20' : 'text-muted-foreground'}`}
                      >
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => openEdit(u)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-auto"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — sticky bottom */}
      {!loading && filtered.length > 0 && (
        <div className="sticky -bottom-6 border-t border-border bg-background py-3 flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} users
            </p>
            <SearchableSelect
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
              className="h-8 w-[90px] text-xs"
              options={[
                { value: '10', label: '10' },
                { value: '20', label: '20' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
              ]}
            />
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </Button>
              {(() => {
                const pages: (number | 'ellipsis')[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (currentPage > 3) pages.push('ellipsis');
                  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                    pages.push(i);
                  }
                  if (currentPage < totalPages - 2) pages.push('ellipsis');
                  pages.push(totalPages);
                }
                return pages.map((p, idx) =>
                  p === 'ellipsis' ? (
                    <span key={`e-${idx}`} className="px-2 text-muted-foreground text-sm">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={currentPage === p ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  )
                );
              })()}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@company.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Domain {isDomainRequired && <span className="text-destructive">*</span>}
              </Label>
              <Select value={form.domain_id || 'none'} onValueChange={(v) => setForm({ ...form, domain_id: v === 'none' ? '' : v })}>
                <SelectTrigger className={domainMissing ? 'border-destructive' : ''}>
                  <SelectValue placeholder="No domain" />
                </SelectTrigger>
                <SelectContent>
                  {!isDomainRequired && <SelectItem value="none">No domain</SelectItem>}
                  {domains.filter((d) => d.status === 'active').map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {domainMissing && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle size={12} /> Domain is required for {form.role}s.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Engineering" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Designation</Label>
                <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Senior Developer" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Save Changes' : 'Create User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
