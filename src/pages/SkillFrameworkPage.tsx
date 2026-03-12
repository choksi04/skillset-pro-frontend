import { useState, useMemo, useEffect, useRef } from 'react';
import { useSkillStore, Skill, SkillCategory } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import SkillFormDialog from '@/components/skills/SkillFormDialog';
import CategoryFormDialog from '@/components/skills/CategoryFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, Brain, FolderOpen, Tag, MoreHorizontal, Settings, Trash2, ChevronsDownUp } from 'lucide-react';
import { toast } from 'sonner';

export default function SkillFrameworkPage() {
  const { skills, categories, toggleSkillStatus, deleteSkill, deleteCategory, fetchSkills, loading, initialized } = useSkillStore();
  const { currentRole } = useAuth();
  const isAdmin = currentRole === 'admin' || currentRole === 'hr';
  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<SkillCategory | null>(null);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    skills.forEach((s) => (s.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [skills]);

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      const matchesSearch = s.skill_name.toLowerCase().includes(search.toLowerCase()) || s.skill_description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || s.skill_category === categoryFilter;
      const matchesTag = tagFilter === 'all' || (s.tags || []).includes(tagFilter);
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesCategory && matchesTag && matchesStatus;
    });
  }, [skills, search, categoryFilter, tagFilter, statusFilter]);

  // Group filtered skills by category
  const grouped = useMemo(() => {
    const map = new Map<string, Skill[]>();
    filtered.forEach((s) => {
      const cat = s.skill_category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [filtered]);

  const stats = useMemo(() => ({
    total: skills.length,
    active: skills.filter((s) => s.status === 'active').length,
    disabled: skills.filter((s) => s.status === 'disabled').length,
    categories: categories.length,
  }), [skills, categories]);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'skill' | 'category'; id: string; name: string } | null>(null);

  const handleEditSkill = (skill: Skill) => { setEditingSkill(skill); setSkillDialogOpen(true); };
  const handleCreateSkill = () => { setEditingSkill(null); setSkillDialogOpen(true); };
  const handleEditCat = (cat: SkillCategory) => { setEditingCat(cat); setCatDialogOpen(true); };
  const handleCreateCat = () => { setEditingCat(null); setCatDialogOpen(true); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'skill') {
      await deleteSkill(deleteTarget.id);
      toast.success(`Skill "${deleteTarget.name}" deleted`);
    } else {
      const skillsInCat = skills.filter((s) => s.skill_category === deleteTarget.name);
      if (skillsInCat.length > 0) {
        toast.error(`Cannot delete category with ${skillsInCat.length} skill(s). Remove or reassign them first.`);
        setDeleteTarget(null);
        return;
      }
      await deleteCategory(deleteTarget.id);
      toast.success(`Category "${deleteTarget.name}" deleted`);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Skills', value: stats.total, icon: <Brain size={18} /> },
          { label: 'Active', value: stats.active, color: 'text-success' },
          { label: 'Disabled', value: stats.disabled, color: 'text-muted-foreground' },
          { label: 'Categories', value: stats.categories, icon: <FolderOpen size={18} /> },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${(s as any).color ?? 'text-card-foreground'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search skills..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" maxLength={100} />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.filter((c) => c.status === 'active').map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCreateCat} className="gap-1.5">
              <Settings size={14} /> Manage Categories
            </Button>
            <Button size="sm" onClick={handleCreateSkill} className="gap-1.5">
              <Plus size={14} /> Add Skill
            </Button>
          </div>
        )}
      </div>

      {/* Grouped accordion table */}
      {loading && !initialized ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="space-y-2">
                {[1, 2].map((j) => (
                  <div key={j} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No skills found matching your filters.
        </div>
      ) : (
        <>
          {openAccordions.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setOpenAccordions([])} className="gap-1.5 text-xs text-muted-foreground">
                <ChevronsDownUp size={14} /> Collapse All
              </Button>
            </div>
          )}
          <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="space-y-3">
            {Array.from(grouped.entries()).map(([catName, catSkills]) => {
              const catObj = categories.find((c) => c.name === catName);
              return (
                <AccordionItem key={catName} value={catName} className="rounded-xl border border-border bg-card overflow-hidden">
                  <AccordionTrigger className="px-5 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <FolderOpen size={16} className="text-primary shrink-0" />
                      <div>
                        <span className="font-semibold text-card-foreground">{catName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({catSkills.length} skill{catSkills.length !== 1 ? 's' : ''})</span>
                      </div>
                      {isAdmin && catObj && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditCat(catObj); }}
                          className="ml-2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Edit category"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Skill & Description</TableHead>
                          <TableHead className="w-[200px]">Tags</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          {isAdmin && <TableHead className="w-[80px] text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catSkills.map((skill) => (
                          <TableRow key={skill.id} className={skill.status === 'disabled' ? 'opacity-60' : ''}>
                            <TableCell>
                              <p className="font-medium text-foreground">{skill.skill_name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{skill.skill_description}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(skill.tags || []).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-[11px] font-normal">
                                    <Tag size={10} className="mr-1" />{tag}
                                  </Badge>
                                ))}
                                {(!skill.tags || skill.tags.length === 0) && (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
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
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                      <MoreHorizontal size={14} />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditSkill(skill)}>
                                      <Pencil size={14} className="mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toggleSkillStatus(skill.id)}>
                                      {skill.status === 'active' ? <ToggleLeft size={14} className="mr-2" /> : <ToggleRight size={14} className="mr-2" />}
                                      {skill.status === 'active' ? 'Disable' : 'Enable'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setDeleteTarget({ type: 'skill', id: skill.id, name: skill.skill_name })} className="text-destructive focus:text-destructive">
                                      <Trash2 size={14} className="mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </>
      )}

      {/* Category management overview */}
      {isAdmin && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-card-foreground">Categories</h3>
            <Button size="sm" variant="ghost" onClick={handleCreateCat} className="gap-1 h-7 text-xs">
              <Plus size={12} /> New
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const count = skills.filter((s) => s.skill_category === cat.name).length;
              return (
                <div
                  key={cat.id}
                  className={`group relative rounded-lg border px-3 py-2 text-left transition-colors ${
                    cat.status === 'disabled' ? 'opacity-50 border-border' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <button onClick={() => handleEditCat(cat)} className="text-left">
                    <p className="text-sm font-medium text-foreground">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{count} skill{count !== 1 ? 's' : ''} · {cat.status}</p>
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ type: 'category', id: cat.id, name: cat.name })}
                    className="absolute top-1.5 right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete category"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SkillFormDialog open={skillDialogOpen} onOpenChange={setSkillDialogOpen} editSkill={editingSkill} />
      <CategoryFormDialog open={catDialogOpen} onOpenChange={setCatDialogOpen} editCategory={editingCat} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'category' ? 'Category' : 'Skill'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>? This action can be undone by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
