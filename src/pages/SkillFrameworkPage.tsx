import { useState, useMemo, useEffect } from 'react';
import { useSkillStore, Skill } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import SkillFormDialog from '@/components/skills/SkillFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, Brain } from 'lucide-react';

export default function SkillFrameworkPage() {
  const { skills, categories, toggleSkillStatus } = useSkillStore();
  const { currentRole } = useAuth();
  const isAdmin = currentRole === 'admin' || currentRole === 'hr';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      const matchesSearch =
        s.skill_name.toLowerCase().includes(search.toLowerCase()) ||
        s.skill_description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || s.skill_category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [skills, search, categoryFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: skills.length,
    active: skills.filter((s) => s.status === 'active').length,
    disabled: skills.filter((s) => s.status === 'disabled').length,
    categories: new Set(skills.map((s) => s.skill_category)).size,
  }), [skills]);

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingSkill(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Skills', value: stats.total, icon: <Brain size={18} /> },
          { label: 'Active', value: stats.active, color: 'text-success' },
          { label: 'Disabled', value: stats.disabled, color: 'text-muted-foreground' },
          { label: 'Categories', value: stats.categories },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${(s as any).color ?? 'text-card-foreground'}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              maxLength={100}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={handleCreate} className="gap-1.5">
            <Plus size={14} />
            Add Skill
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Skill Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              {isAdmin && <TableHead className="w-[100px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-sm text-muted-foreground py-10">
                  No skills found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((skill) => (
                <TableRow key={skill.id} className={skill.status === 'disabled' ? 'opacity-60' : ''}>
                  <TableCell className="font-medium text-foreground">{skill.skill_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                    {skill.skill_description}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {skill.skill_category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={skill.status === 'active' ? 'default' : 'outline'}
                      className={`text-xs ${skill.status === 'active' ? 'bg-success/15 text-success border-success/20 hover:bg-success/20' : ''}`}
                    >
                      {skill.status}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(skill)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Edit skill"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleSkillStatus(skill.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title={skill.status === 'active' ? 'Disable skill' : 'Enable skill'}
                        >
                          {skill.status === 'active' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Category overview */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-card-foreground mb-3">Categories</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const count = skills.filter((s) => s.skill_category === cat.name).length;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.name === categoryFilter ? 'all' : cat.name)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  categoryFilter === cat.name
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <p className="text-sm font-medium text-foreground">{cat.name}</p>
                <p className="text-xs text-muted-foreground">{count} skill{count !== 1 ? 's' : ''}</p>
              </button>
            );
          })}
        </div>
      </div>

      <SkillFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editSkill={editingSkill}
      />
    </div>
  );
}
