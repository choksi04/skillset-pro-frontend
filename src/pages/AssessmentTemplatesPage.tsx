import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTemplateStore, AssessmentTemplate } from "@/stores/templateStore";
import { useDomainStore } from "@/stores/domainStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  LayoutTemplate,
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Layers,
  ListChecks,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import AssignTemplateDialog from "@/components/templates/AssignTemplateDialog";
import TemplateAssignmentsSheet from "@/components/templates/TemplateAssignmentsSheet";
import { useAssignmentStore } from "@/stores/assignmentStore";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export default function AssessmentTemplatesPage() {
  const navigate = useNavigate();
  const { templates, fetchTemplates, deleteTemplate, setTemplateStatus, loading, initialized } = useTemplateStore();
  const { domains, fetchDomains } = useDomainStore();
  const { assignments, fetchAssignments, getAssignmentsForTemplate } = useAssignmentStore();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AssessmentTemplate | null>(null);
  const [assignFor, setAssignFor] = useState<AssessmentTemplate | null>(null);
  const [viewAssignmentsFor, setViewAssignmentsFor] = useState<AssessmentTemplate | null>(null);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTemplates();
    fetchDomains();
    fetchAssignments();
    supabase
      .from("users")
      .select("id, full_name")
      .is("deleted_on", null)
      .then(({ data }) => {
        const m: Record<string, string> = {};
        (data || []).forEach((u: any) => {
          m[u.id] = u.full_name;
        });
        setUserMap(m);
      });
  }, []);

  const userName = (id: string | null) => (id && userMap[id]) || "Unknown";
  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch {
      return "—";
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }, [templates, search]);

  const handleToggleStatus = async (t: AssessmentTemplate) => {
    const next = t.status === "active" ? "draft" : "active";
    await setTemplateStatus(t.id, next);
    toast.success(`Template ${next === "active" ? "activated" : "moved to draft"}`);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteTemplate(confirmDelete.id);
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    }
    setConfirmDelete(null);
  };

  const getDomainName = (id: string | null) =>
    id ? (domains.find((d) => d.id === id)?.name ?? "Unknown domain") : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Assessment Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define how assessments are generated. Adaptive templates pick questions per skill level; fixed templates use
            a hand-picked question list.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => navigate("/assessment-templates/new")}>
          <Plus size={14} /> New Template
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {loading && !initialized ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                      <Skeleton className="h-4 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-12" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="p-8 flex flex-col items-center text-center">
            <LayoutTemplate size={32} className="text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No templates yet</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Create your first assessment template to start generating assessments for your team.
            </p>
            <Button size="sm" className="gap-1.5" onClick={() => navigate("/assessment-templates/new")}>
              <Plus size={13} /> Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <Card
              key={t.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("button, a, [role=button]")) return;
                navigate(`/assessment-templates/${t.id}`);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">{t.name}</h3>
                      <Badge
                        variant="outline"
                        className={`text-[10px] gap-1 ${
                          t.type === "adaptive" ? "border-primary/30 text-primary" : "border-info/30 text-info"
                        }`}
                      >
                        {t.type === "adaptive" ? <Layers size={10} /> : <ListChecks size={10} />}
                        {t.type === "adaptive" ? "Adaptive" : "Fixed"}
                      </Badge>
                      <Badge
                        className={`text-[10px] ${
                          t.status === "active"
                            ? "bg-success/15 text-success border-success/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.status === "active" ? "Active" : "Draft"}
                      </Badge>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.type === "adaptive"
                        ? `${getDomainName(t.domain_id)} · ${t.skills_per_assessment} skills · ${t.questions_per_skill} questions/skill`
                        : "Fixed question list"}
                      {" · "}
                      {t.duration_minutes} min · max {t.max_attempts} attempt{t.max_attempts > 1 ? "s" : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 mt-1.5">
                      Created by <span className="font-medium text-muted-foreground">{userName(t.created_by)}</span>{" "}
                      {fmtDate(t.created_at)}
                      {t.modified_at && (
                        <>
                          {" · "}Last updated by{" "}
                          <span className="font-medium text-muted-foreground">{userName(t.modified_by)}</span>{" "}
                          {fmtDate(t.modified_at)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {t.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5 text-xs text-primary hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignFor(t);
                        }}
                      >
                        <UserCheck size={13} /> Assign
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewAssignmentsFor(t);
                      }}
                    >
                      <Users size={13} /> {getAssignmentsForTemplate(t.id).length}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(t);
                      }}
                    >
                      {t.status === "active" ? <PowerOff size={13} /> : <Power size={13} />}
                      {t.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/assessment-templates/${t.id}`);
                      }}
                    >
                      <Pencil size={13} /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(t);
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" will be removed. Existing assessments already generated from it will not be
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AssignTemplateDialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)} template={assignFor} />

      <TemplateAssignmentsSheet
        open={!!viewAssignmentsFor}
        onOpenChange={(o) => !o && setViewAssignmentsFor(null)}
        template={viewAssignmentsFor}
      />
    </div>
  );
}
