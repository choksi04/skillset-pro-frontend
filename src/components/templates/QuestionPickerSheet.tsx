import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import SearchableSelect from "@/components/ui/searchable-select";
import { Search, ChevronDown, ChevronRight, ChevronLeft, Check, X } from "lucide-react";
import { Question, useQuestionStore } from "@/stores/questionStore";
import { useSkillStore } from "@/stores/skillStore";
import {
  useCompetencyLevelStore,
  getLevelLabelsByIdMap,
} from "@/stores/competencyLevelStore";
import { formatQuestionForDisplay } from "@/lib/questionFormat";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelectedIds: string[];
  onSave: (ids: string[]) => void;
}

export default function QuestionPickerSheet({
  open,
  onOpenChange,
  initialSelectedIds,
  onSave,
}: Props) {
  const { fetchQuestionPage, fetchQuestionsByIds } = useQuestionStore();
  const { skills } = useSkillStore();
  const { levels: competencyLevels } = useCompetencyLevelStore();

  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageItems, setPageItems] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 20;

  // Reset buffered state when sheet opens. Questions are loaded page-by-page.
  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelectedIds));
      setSearch("");
      setSkillFilter("all");
      setLevelFilter("all");
      setTypeFilter("all");
      setExpanded(new Set());
      setPage(1);
      if (initialSelectedIds.length > 0) {
        fetchQuestionsByIds(initialSelectedIds);
      }
    }
  }, [open, initialSelectedIds, fetchQuestionsByIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);


  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, skillFilter, levelFilter, typeFilter]);

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s.skill_name])), [skills]);
  const levelLabels = useMemo(() => getLevelLabelsByIdMap(competencyLevels), [competencyLevels]);

  const skillOptions = useMemo(() => skills.filter((s) => s.status === "active"), [skills]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, total);

  const loadPage = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    const result = await fetchQuestionPage({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      skillId: skillFilter,
      levelId: levelFilter,
      questionType: typeFilter as any,
      status: "published",
      sortOrder: "recent",
    });
    setPageItems(result.questions);
    setTotal(result.total);
    setLoading(false);
  }, [open, fetchQuestionPage, page, debouncedSearch, skillFilter, levelFilter, typeFilter]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const reset = () => {
    setSearch("");
    setSkillFilter("all");
    setLevelFilter("all");
    setTypeFilter("all");
  };

  const handleSave = () => {
    onSave(Array.from(selected));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SheetTitle>Add Questions</SheetTitle>
              <SheetDescription>
                Choose published questions to include in this template.
              </SheetDescription>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {selected.size} selected
            </Badge>
          </div>
        </SheetHeader>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-border space-y-2 bg-muted/20">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by question text or skill…"
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SearchableSelect
              value={skillFilter}
              onValueChange={setSkillFilter}
              placeholder="Skill"
              className="h-8 text-xs"
              options={[
                { value: "all", label: "All skills" },
                ...skillOptions.map((s) => ({ value: s.id, label: s.skill_name })),
              ]}
            />
            <SearchableSelect
              value={levelFilter}
              onValueChange={setLevelFilter}
              placeholder="Level"
              className="h-8 text-xs"
              options={[
                { value: "all", label: "All levels" },
                ...competencyLevels
                  .filter((l) => l.status === "active")
                  .map((l) => ({ value: l.id, label: l.label })),
              ]}
            />
            <SearchableSelect
              value={typeFilter}
              onValueChange={setTypeFilter}
              placeholder="Type"
              className="h-8 text-xs"
              options={[
                { value: "all", label: "All types" },
                { value: "mcq", label: "MCQ" },
                { value: "scenario", label: "Scenario" },
                { value: "coding", label: "Coding" },
              ]}
            />
          </div>
          {(search || skillFilter !== "all" || levelFilter !== "all" || typeFilter !== "all") && (
            <button
              onClick={reset}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X size={10} /> Reset filters
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-12">Loading questions…</p>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No published questions match these filters.
            </p>
          ) : (
            <div className="space-y-2">
              {pageItems.map((q) => {
                const isOpen = expanded.has(q.id);
                const isChecked = selected.has(q.id);
                const formatted = formatQuestionForDisplay(q);
                return (
                  <div
                    key={q.id}
                    className={cn(
                      "rounded-md border transition-colors",
                      isChecked ? "border-primary/40 bg-primary/5" : "border-border bg-card",
                    )}
                  >
                    <div className="flex items-start gap-2 p-3">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggle(q.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground line-clamp-2">{formatted.display}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {skillMap.get(q.skill_id) || q.skill_id}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {levelLabels[q.competency_level] || q.competency_level}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-normal capitalize">
                            {q.question_type}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => toggleExpand(q.id)}
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </Button>
                    </div>
                    {isOpen && (
                      <div className="border-t border-border bg-background/50 px-3 py-3 space-y-2">
                        <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                          {formatted.problemStatement || formatted.scenario || formatted.display}
                        </div>
                        {formatted.options && formatted.options.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                              Options
                            </p>
                            <ul className="space-y-1">
                              {formatted.options.map((opt, i) => (
                                <li
                                  key={i}
                                  className={cn(
                                    "flex items-start gap-2 rounded px-2 py-1.5 text-xs",
                                    opt.correct
                                      ? "bg-success/10 text-foreground border border-success/30"
                                      : "bg-muted/30 text-foreground/80",
                                  )}
                                >
                                  <span className="font-medium shrink-0">
                                    {String.fromCharCode(65 + i)}.
                                  </span>
                                  <span className="flex-1">{opt.text}</span>
                                  {opt.correct && (
                                    <Check size={12} className="text-success shrink-0 mt-0.5" />
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between gap-2 px-6 py-2 border-t border-border bg-muted/20">
            <span className="text-[11px] text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={13} />
              </Button>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                Page {safePage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        )}

        <SheetFooter className="px-6 py-3 border-t border-border bg-card">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              {total} match · {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save ({selected.size})
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
