import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSkillStore, Skill } from '@/stores/skillStore';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import SkillFormDialog from '@/components/skills/SkillFormDialog';
import SkillDetailDrawer from '@/components/skills/SkillDetailDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
import { ArrowLeft, Plus, Search, Pencil, ToggleLeft, ToggleRight, Tag, MoreHorizontal, Trash2, Brain, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function CategoryDetailPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { skills, categories, topics, fetchSkills, toggleSkillStatus, deleteSkill, loading, initialized } = useSkillStore();
  const { currentRole } = useAuth();
  const isAdmin = currentRole === 'admin';

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const category = categories.find((c) => c.id === categoryId);

  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const categorySkills = useMemo(() => {
    if (!category) return [];
    return skills.filter((s) => s.skill_category === category.name);
  }, [skills, category]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    categorySkills.forEach((s) => (s.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [categorySkills]);

  const filtered = useMemo(() => {
    return categorySkills.filter((s) => {
      const matchesSearch =
        s.skill_name.toLowerCase().includes(search.toLowerCase()) ||
        s.skill_description.toLowerCase().includes(search.toLowerCase());
      const matchesTag = tagFilter === 'all' || (s.tags || []).includes(tagFilter);
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesTag && matchesStatus;
    });
  }, [categorySkills, search, tagFilter, statusFilter]);

  const topicCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const skillId of Object.keys(topics)) {
      map[skillId] = (topics[skillId] || []).length;
    }
    return map;
  }, [topics]);

  const handleCreateSkill = () => { setEditingSkill(null); setSkillDialogOpen(true); };
  const handleEditSkill = (skill: Skill) => { setEditingSkill(skill); setSkillDialogOpen(true); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteSkill(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (!loading && initialized && !category) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/skill-library')} className="gap-1.5">
          <ArrowLeft size={14} /> Back to Skill Library
        </Button>
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Category not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/skill-library')} className="gap-1.5 mb-3 -ml-2">
          <ArrowLeft size={14} /> Skill Library
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{category?.name || 'Loading...'}</h2>
            {category?.description && (
              <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
            )}
          </div>
          {isAdmin && (
            <Button size="sm" onClick={handleCreateSkill} className="gap-1.5">
              <Plus size={14} /> Add Skill
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            maxLength={100}
          />
        </div>
        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Skills Table */}
      {loading && !initialized ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Brain size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {categorySkills.length === 0
              ? 'No skills in this category yet. Add your first skill to get started.'
              : 'No skills match your filters.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skill Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="hidden sm:table-cell">Tags</TableHead>
                <TableHead className="w-[80px] text-center">Topics</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                {isAdmin && <TableHead className="w-[70px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((skill) => {
                const topicCount = topicCountMap[skill.id] ?? '—';
                return (
                  <TableRow
                    key={skill.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${skill.status === 'disabled' ? 'opacity-60' : ''}`}
                    onClick={() => setSelectedSkill(skill)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Brain size={14} className="text-primary shrink-0" />
                        <span className="font-medium text-foreground">{skill.skill_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-sm text-muted-foreground line-clamp-1">{skill.skill_description || '—'}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(skill.tags || []).slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[11px] font-normal">
                            <Tag size={10} className="mr-1" />{tag}
                          </Badge>
                        ))}
                        {(skill.tags || []).length > 3 && (
                          <Badge variant="outline" className="text-[11px] font-normal">+{skill.tags.length - 3}</Badge>
                        )}
                        {(!skill.tags || skill.tags.length === 0) && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <BookOpen size={12} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{topicCount}</span>
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
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget({ id: skill.id, name: skill.skill_name })}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 size={14} className="mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <SkillFormDialog
        open={skillDialogOpen}
        onOpenChange={setSkillDialogOpen}
        editSkill={editingSkill}
        categoryName={category?.name}
      />

      <SkillDetailDrawer
        skill={selectedSkill}
        onClose={() => setSelectedSkill(null)}
        isAdmin={isAdmin}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Skill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>?
              Skills mapped to domains or used in questions cannot be deleted.
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
