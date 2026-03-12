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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Pencil, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  // Form state
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
    users.filter((u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    ), [users, search]);

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

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error('Name and email are required.');
      return;
    }

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
      <p className="text-sm text-muted-foreground">Manage users, roles, and domain assignments.</p>

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus size={14} /> Add User
        </Button>
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
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">No users found.</TableCell></TableRow>
            ) : (
              filtered.map((u) => {
                const domain = domains.find((d) => d.id === u.domain_id);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{roleLabels[u.role] ?? u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{domain?.name ?? '—'}</TableCell>
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
              <Label className="text-xs">Domain</Label>
              <Select value={form.domain_id || 'none'} onValueChange={(v) => setForm({ ...form, domain_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="No domain" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No domain</SelectItem>
                  {domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
