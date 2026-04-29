import { useMemo, useState, useEffect } from "react";
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
import { Search } from "lucide-react";
import { useQuestionStore, Question } from "@/stores/questionStore";
import { useSkillStore } from "@/stores/skillStore";
import {
  useCompetencyLevelStore,
  getLevelLabelsByIdMap,
} from "@/stores/competencyLevelStore";
import { formatQuestionForDisplay } from "@/lib/questionFormat";
import SelectedQuestionRow from "./SelectedQuestionRow";
import QuestionDetailSheet from "@/components/questions/QuestionDetailSheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onRemove: (id: string) => void;
}

export default function SelectedQuestionsSheet({
  open,
  onOpenChange,
  selectedIds,
  onRemove,
}: Props) {
  const { questions } = useQuestionStore();
  const { skills } = useSkillStore();
  const { levels: competencyLevels } = useCompetencyLevelStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s.skill_name])), [skills]);
  const levelLabels = useMemo(() => getLevelLabelsByIdMap(competencyLevels), [competencyLevels]);
  const qMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return selectedIds
      .map((id) => ({ id, q: qMap.get(id) }))
      .filter(({ q }) => {
        if (!term) return true;
        if (!q) return false;
        const display = formatQuestionForDisplay(q).display.toLowerCase();
        const skillName = (skillMap.get(q.skill_id) || "").toLowerCase();
        return display.includes(term) || skillName.includes(term);
      });
  }, [selectedIds, qMap, search, skillMap]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-border">
          <SheetTitle>Selected Questions ({selectedIds.length})</SheetTitle>
          <SheetDescription>Search, review, or remove questions from your template.</SheetDescription>
        </SheetHeader>

        <div className="px-6 py-3 border-b border-border bg-muted/20">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search selected questions…"
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {selectedIds.length === 0
                ? "No questions selected yet."
                : "No selected questions match your search."}
            </p>
          ) : (
            filtered.map(({ id, q }, idx) => (
              <SelectedQuestionRow
                key={id}
                index={idx}
                question={q}
                fallbackId={id}
                skillName={q ? skillMap.get(q.skill_id) : undefined}
                levelLabel={q ? levelLabels[q.competency_level] : undefined}
                onRemove={() => onRemove(id)}
              />
            ))
          )}
        </div>

        <SheetFooter className="px-6 py-3 border-t border-border bg-card">
          <Button size="sm" onClick={() => onOpenChange(false)} className="ml-auto">
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
