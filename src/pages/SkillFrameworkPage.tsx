import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSkillStore, SkillCategory } from "@/stores/skillStore";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import CategoryFormDialog from "@/components/skills/CategoryFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import SearchableSelect from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, FolderOpen, MoreHorizontal, Trash2 } from "lucide-react";

export default function SkillFrameworkPage() {
  const { skills, categories, fetchSkills, deleteCategory, toggleCategoryStatus, loading, initialized } =
    useSkillStore();
  const { currentRole } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentRole === "admin";

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<SkillCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = useMemo(() => {
    return categories.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const skillCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    skills.forEach((s) => {
      const cat = s.skill_category || "";
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [skills]);

  const handleCreateCat = () => {
    setEditingCat(null);
    setCatDialogOpen(true);
  };
  const handleEditCat = (cat: SkillCategory) => {
    setEditingCat(cat);
    setCatDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteCategory(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleCategoryCreated = (categoryId: string) => {
    navigate(`/skill-library/${categoryId}`);
  };

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "active", label: "Active" },
    { value: "disabled", label: "Disabled" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Skill Library</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Organize skills into categories. Click a category to manage its skills and topics.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={handleCreateCat} className="gap-1.5">
            <Plus size={14} /> Create Category
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            maxLength={100}
          />
        </div>
        <SearchableSelect
          options={statusOptions}
          value={statusFilter}
          onValueChange={setStatusFilter}
          placeholder="Status"
          className="w-[130px] h-9 text-sm"
        />
      </div>

      {/* Category Table */}
      {loading && !initialized ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <FolderOpen size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {categories.length === 0
              ? "No categories yet. Create your first category to get started."
              : "No categories match your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="w-[100px] text-center">Skills</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                {isAdmin && <TableHead className="w-[70px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cat) => {
                const count = skillCountMap[cat.name] || 0;
                return (
                  <TableRow
                    key={cat.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${cat.status === "disabled" ? "opacity-60" : ""}`}
                    onClick={() => navigate(`/skill-library/${cat.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div>
                          <FolderOpen size={16} className="text-primary shrink-0" />
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{cat.name}</span>
                          <p className="text-sm text-muted-foreground line-clamp-1">{cat.description || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs font-normal">
                        {count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cat.status === "active" ? "default" : "outline"}
                        className={`text-xs ${cat.status === "active" ? "bg-success/15 text-success border-success/20 hover:bg-success/20" : ""}`}
                      >
                        {cat.status}
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
                            <DropdownMenuItem onClick={() => handleEditCat(cat)}>
                              <Pencil size={14} className="mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleCategoryStatus(cat.id)}>
                              {cat.status === "active" ? (
                                <ToggleLeft size={14} className="mr-2" />
                              ) : (
                                <ToggleRight size={14} className="mr-2" />
                              )}
                              {cat.status === "active" ? "Disable" : "Enable"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget({ id: cat.id, name: cat.name })}
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

      <CategoryFormDialog
        open={catDialogOpen}
        onOpenChange={setCatDialogOpen}
        editCategory={editingCat}
        onCreated={handleCategoryCreated}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>? Categories with skills cannot
              be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
